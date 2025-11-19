// Canvas.io Scan Fetcher - Backend Server
// Install dependencies: npm install playwright express cors fs-extra multer xlsx

const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');

const app = express();
const PORT = 3000;

// Configuration
const WORKING_FOLDER = path.join(__dirname, 'canvas_data');
const CANVAS_URL = 'https://canvas.io/account/login'; // Update with actual URL
// Note: Headless mode is now controlled by user via frontend checkbox

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Ensure working folder exists
fs.ensureDirSync(WORKING_FOLDER);

// Global variable to store device mapping
let deviceMapping = {};

// Helper function to create valid filename
function toValidFilename(filename) {
    filename = filename.replace(/[<>:"/\\|?*]/g, '');
    filename = filename.replace(/ /g, '_');
    filename = filename.trim('. ');
    return filename || 'unnamed';
}

// Helper function to wait for network idle
async function waitForNetworkIdle(page) {
    try {
        await page.waitForLoadState('networkidle', { timeout: 30000 });
    } catch (error) {
        console.log('Timeout reached, continuing...');
    }
    await page.waitForTimeout(1000);
}

// Helper function to find matching suite in device mapping
function findMatchingSuite(scanText) {
    // Extract potential suite number from scan text
    // Scan text format examples: "Ensuite 07 Bathroom", "10 Bedroom . Bedroom", "11 Ensuite 11 Bathroom"
    
    // Try to find exact match first
    if (deviceMapping[scanText]) {
        return deviceMapping[scanText];
    }
    
    // Try to match by suite number patterns
    const suitePatterns = [
        /(\d+)\s*Ensuite/i,        // "07 Ensuite", "Ensuite 07"
        /Ensuite\s*(\d+)/i,
        /^(\d+)\s+/,                // "10 Bedroom"
        /Suite\s*(\d+)/i            // "Suite 07"
    ];
    
    for (const pattern of suitePatterns) {
        const match = scanText.match(pattern);
        if (match) {
            const suiteNum = match[1];
            
            // Try to find in device mapping with different formats
            const possibleKeys = [
                `${suiteNum}`,
                `Suite ${suiteNum}`,
                `0${suiteNum}`,
                suiteNum.padStart(2, '0')
            ];
            
            for (const key of possibleKeys) {
                if (deviceMapping[key]) {
                    return deviceMapping[key];
                }
            }
            
            // Try partial match
            for (const mappingKey of Object.keys(deviceMapping)) {
                if (mappingKey.includes(suiteNum)) {
                    return deviceMapping[mappingKey];
                }
            }
        }
    }
    
    // No match found
    return { deviceIds: [], deviceSNs: [] };
}

// Load cached data
function loadCache(user, password) {
    const cacheFile = path.join(WORKING_FOLDER, `cache_${toValidFilename(user)}.json`);
    if (fs.existsSync(cacheFile)) {
        try {
            return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        } catch (error) {
            console.error('Error loading cache:', error);
            return null;
        }
    }
    return null;
}

// Save cache
function saveCache(user, password, data) {
    const cacheFile = path.join(WORKING_FOLDER, `cache_${toValidFilename(user)}.json`);
    try {
        fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving cache:', error);
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend server is running' });
});

// File upload endpoint for Excel/CSV
app.post('/upload-devices', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const buffer = req.file.buffer;
        const filename = req.file.originalname;
        
        let data;
        
        // Parse Excel or CSV
        if (filename.endsWith('.csv')) {
            // Parse CSV
            const csvText = buffer.toString('utf8');
            const workbook = XLSX.read(csvText, { type: 'string' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            data = XLSX.utils.sheet_to_json(sheet);
        } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
            // Parse Excel
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            data = XLSX.utils.sheet_to_json(sheet);
        } else {
            return res.status(400).json({ error: 'Unsupported file format. Please upload CSV or Excel file.' });
        }

        // Process the data to create suite name -> device info mapping
        // Expected columns: "Device id", "Suite name", "Room name", "Room Type", "Device S/N"
        deviceMapping = {};
        
        data.forEach(row => {
            const suiteName = row['Suite name'] || row['Suite nam'] || '';
            const deviceId = row['Device id'] || '';
            const deviceSN = row['Device S/N'] || '';
            
            if (!suiteName) return;
            
            // Initialize suite if not exists
            if (!deviceMapping[suiteName]) {
                deviceMapping[suiteName] = {
                    deviceIds: [],
                    deviceSNs: []
                };
            }
            
            // Add device ID if present and not duplicate
            if (deviceId && !deviceMapping[suiteName].deviceIds.includes(deviceId)) {
                deviceMapping[suiteName].deviceIds.push(deviceId);
            }
            
            // Add device S/N if present and not duplicate
            if (deviceSN && !deviceMapping[suiteName].deviceSNs.includes(deviceSN)) {
                deviceMapping[suiteName].deviceSNs.push(deviceSN);
            }
        });

        console.log('Device mapping created:', JSON.stringify(deviceMapping, null, 2));

        res.json({ 
            success: true, 
            message: `Processed ${data.length} rows, found ${Object.keys(deviceMapping).length} unique suites`,
            suites: Object.keys(deviceMapping),
            preview: deviceMapping
        });

    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).json({ error: 'Error processing file: ' + error.message });
    }
});

// Main scraping endpoint with SSE (Server-Sent Events)
app.get('/fetch-scans', async (req, res) => {
    const { email, password, headless, screenshots } = req.query;
    const isHeadless = headless === 'true'; // Convert string to boolean
    const enableScreenshots = screenshots === 'true'; // Convert string to boolean

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    // Set up SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // Helper to send SSE message
    function sendUpdate(type, data) {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    }

    // Helper to send screenshot
    async function sendScreenshot(page, caption) {
        try {
            const screenshot = await page.screenshot({ type: 'png' });
            const base64Screenshot = screenshot.toString('base64');
            sendUpdate('screenshot', { screenshot: base64Screenshot, caption });
        } catch (error) {
            console.error('Error taking screenshot:', error);
        }
    }

    let browser = null;
    let context = null;

    try {
        sendUpdate('progress', { progress: 2, message: 'Initializing browser...' });

        // Start fresh (cache disabled as per updated Python code)
        let tableDict = {
            account_name: [],
            group: [],
            scan_text: [],
            scan_url: [],
            device_ids: [],
            device_sns: []
        };

        // Launch browser with clipboard permissions
        browser = await chromium.launch({
            headless: isHeadless,
            args: [
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-session-crashed-bubble',
                '--disable-infobars'
            ]
        });
        context = await browser.newContext({
            permissions: ['clipboard-read', 'clipboard-write']
        });
        const page = await context.newPage();

        // Navigate to login page
        sendUpdate('progress', { progress: 5, message: 'Navigating to Canvas.io...' });
        await page.goto(CANVAS_URL);
        await waitForNetworkIdle(page);

        // Login
        sendUpdate('progress', { progress: 10, message: 'Logging in...' });
        await page.fill('input[type="text"], input[type="email"]', email);
        await page.fill('input[type="password"]', password);
        
        // Check for "remember me" checkbox and check it
        const checkbox = await page.locator('input[type="checkbox"]').first();
        if (await checkbox.isVisible()) {
            await checkbox.check();
        }
        
        await page.click('button:has-text("Login")');
        await waitForNetworkIdle(page);
        
        // Take screenshot after login (if enabled)
        if (enableScreenshots) {
            await sendScreenshot(page, 'Logged in successfully');
        }

        // Navigate to Projects (updated from "Uploaded Scans")
        sendUpdate('progress', { progress: 15, message: 'Accessing projects...' });
        await page.click('a:has-text("Projects")');
        await waitForNetworkIdle(page);
        
        // Additional wait time for projects to fully load
        await page.waitForTimeout(6000);
        
        // Take screenshot of Projects page (if enabled)
        if (enableScreenshots) {
            await sendScreenshot(page, 'Projects page loaded');
        }

        // Get account name
        const accountHeader = await page.locator('#account-header h1').textContent();
        const accountName = accountHeader.replace('Hi,', '').replace('!', '').trim();
        const accountFolder = path.join(WORKING_FOLDER, toValidFilename(accountName));
        fs.ensureDirSync(accountFolder);

        sendUpdate('progress', { progress: 20, message: `Account: ${accountName}` });

        // Get all sidebar groups
        const sidebarElements = await page.locator('aside[class]').all();
        let progressUpdate = 20;
        const progressIncrement = 70 / sidebarElements.length;

        for (const element of sidebarElements) {
            const links = await element.locator('a[href]').all();
            
            for (const link of links) {
                const groupText = await link.textContent();
                await link.click();
                await waitForNetworkIdle(page);

                sendUpdate('progress', { 
                    progress: progressUpdate, 
                    message: `Processing group: ${groupText}` 
                });
                
                // Take screenshot of the group (if enabled)
                if (enableScreenshots) {
                    await sendScreenshot(page, `Group: ${groupText}`);
                }

                // Get all scan groups
                const scanGroupSections = await page.locator('div[class="scangroup"]').all();
                
                for (const scanGroupSection of scanGroupSections) {
                    try {
                        // Wait for scan links
                        await scanGroupSection.locator('a[href]').first().waitFor({ timeout: 3000 });
                    } catch (error) {
                        console.log('Timeout waiting for scan group section, skipping...');
                        continue;
                    }

                    const infoElement = await scanGroupSection.locator('.info');
                    let text = await infoElement.innerText();
                    
                    // Clean up text
                    text = text.replace('Colorized', '').replace(/\xa0/g, '');
                    text = text.trim().replace(/\n/g, '_');

                    // Skip if already exists
                    if (tableDict.scan_text.includes(text)) {
                        console.log(`Scan text '${text}' already exists, skipping...`);
                        continue;
                    }

                    // Use clipboard method to get URL (more efficient than opening new tabs)
                    try {
                        // Click the copy link button
                        const copyButton = await scanGroupSection.locator('.info > .name > .prevent-popup-close').first();
                        await copyButton.click();
                        await waitForNetworkIdle(page);
                        
                        // Click "Copy Link" text
                        await page.click('text=Copy Link');
                        await waitForNetworkIdle(page);
                        await page.waitForTimeout(500);
                        
                        // Read from clipboard
                        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
                        await page.waitForTimeout(500);

                        console.log(`${groupText} =====> ${text} =====> ${clipboardText}`);
                        
                        // Take screenshot of the scan (if enabled)
                        if (enableScreenshots) {
                            await sendScreenshot(page, `Scan: ${text}`);
                        }

                        // Find matching device information
                        const deviceInfo = findMatchingSuite(text);
                        const deviceIdsStr = deviceInfo.deviceIds.join(', ');
                        const deviceSNsStr = deviceInfo.deviceSNs.join(', ');

                        // Add to data
                        tableDict.account_name.push(accountName);
                        tableDict.group.push(groupText);
                        tableDict.scan_text.push(text);
                        tableDict.scan_url.push(clipboardText);
                        tableDict.device_ids.push(deviceIdsStr);
                        tableDict.device_sns.push(deviceSNsStr);

                        await waitForNetworkIdle(page);

                        // Save cache and send update
                        saveCache(email, password, tableDict);
                        
                        // Convert to array format for frontend
                        const scans = tableDict.account_name.map((_, i) => ({
                            account_name: tableDict.account_name[i],
                            group: tableDict.group[i],
                            scan_text: tableDict.scan_text[i],
                            scan_url: tableDict.scan_url[i],
                            device_ids: tableDict.device_ids[i],
                            device_sns: tableDict.device_sns[i]
                        }));

                        sendUpdate('data', { scans });

                        await page.waitForTimeout(1000);
                    } catch (error) {
                        console.error(`Error processing scan: ${error.message}`);
                        // Continue with next scan even if this one fails
                    }
                }

                progressUpdate += progressIncrement;
            }
        }

        // Final update
        sendUpdate('progress', { progress: 100, message: 'Completed!' });
        
        const finalScans = tableDict.account_name.map((_, i) => ({
            account_name: tableDict.account_name[i],
            group: tableDict.group[i],
            scan_text: tableDict.scan_text[i],
            scan_url: tableDict.scan_url[i],
            device_ids: tableDict.device_ids[i],
            device_sns: tableDict.device_sns[i]
        }));
        
        sendUpdate('data', { scans: finalScans });
        sendUpdate('complete', { message: 'Scan fetching completed successfully' });

    } catch (error) {
        console.error('Error:', error);
        sendUpdate('error', { message: error.message });
    } finally {
        if (context) await context.close();
        if (browser) await browser.close();
        res.end();
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`\n=================================`);
    console.log(`Canvas.io Scan Fetcher Backend`);
    console.log(`=================================`);
    console.log(`Server running on: http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`\nOpen canvas-scraper.html in your browser to use the interface`);
    console.log(`=================================\n`);
});
