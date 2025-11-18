// Canvas.io Scan Fetcher - Backend Server
// Install dependencies: npm install playwright express cors fs-extra

const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = 3000;

// Configuration
const WORKING_FOLDER = path.join(__dirname, 'canvas_data');
const CANVAS_URL = 'https://canvas.io/account/login'; // Update with actual URL
const SHOW_BROWSER = true; // Set to false for headless mode

// Middleware
app.use(cors());
app.use(express.json());

// Ensure working folder exists
fs.ensureDirSync(WORKING_FOLDER);

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

// Main scraping endpoint with SSE (Server-Sent Events)
app.get('/fetch-scans', async (req, res) => {
    const { email, password } = req.query;

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

    let browser = null;
    let context = null;

    try {
        sendUpdate('progress', { progress: 2, message: 'Initializing browser...' });

        // Load cached data
        let tableDict = loadCache(email, password);
        if (!tableDict) {
            tableDict = {
                account_name: [],
                group: [],
                scan_text: [],
                scan_url: []
            };
        }

        // Launch browser
        browser = await chromium.launch({
            headless: !SHOW_BROWSER,
            args: [
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-session-crashed-bubble',
                '--disable-infobars'
            ]
        });
        context = await browser.newContext();
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

        // Navigate to Projects
        sendUpdate('progress', { progress: 15, message: 'Accessing Projects...' });
        await page.click('a:has-text("Projects")');
        await waitForNetworkIdle(page);

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

                    const scanLinks = await scanGroupSection.locator('a[href]').all();
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

                    // Process each scan link
                    for (const scanLink of scanLinks) {
                        const [newPage] = await Promise.all([
                            context.waitForEvent('page'),
                            scanLink.click()
                        ]);

                        await waitForNetworkIdle(newPage);
                        const scanUrl = newPage.url();

                        console.log(`${groupText} =====> ${text} =====> ${scanUrl}`);

                        // Add to data
                        tableDict.account_name.push(accountName);
                        tableDict.group.push(groupText);
                        tableDict.scan_text.push(text);
                        tableDict.scan_url.push(scanUrl);

                        // Close new page
                        await newPage.close();
                        await waitForNetworkIdle(page);

                        // Save cache and send update
                        saveCache(email, password, tableDict);
                        
                        // Convert to array format for frontend
                        const scans = tableDict.account_name.map((_, i) => ({
                            account_name: tableDict.account_name[i],
                            group: tableDict.group[i],
                            scan_text: tableDict.scan_text[i],
                            scan_url: tableDict.scan_url[i]
                        }));

                        sendUpdate('data', { scans });

                        await page.waitForTimeout(1000);
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
            scan_url: tableDict.scan_url[i]
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
