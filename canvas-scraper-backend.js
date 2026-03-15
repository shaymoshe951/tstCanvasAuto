// Canvas.io Scan Fetcher - Backend Server
// Install dependencies: npm install playwright express cors fs-extra

const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const WORKING_FOLDER = path.join(__dirname, 'canvas_data');
const CANVAS_URL = 'https://app.twindo.com/login';
// Note: Headless mode is now controlled by user via frontend checkbox

// Middleware
app.use(cors());
app.use(express.json());

// Ensure working folder exists
fs.ensureDirSync(WORKING_FOLDER);


// Helper function to wait for network idle
async function waitForNetworkIdle(page) {
    try {
        await page.waitForLoadState('networkidle', { timeout: 30000 });
    } catch (error) {
        console.log('Timeout reached, continuing...');
    }
    await page.waitForTimeout(1000);
}


// Serve frontend
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'canvas-scraper.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend server is running' });
});

// Parse date text from project card e.g. "Mar 11, 2026, 4:44 PM"
function parseProjectDate(dateText) {
    return new Date(dateText);
}

// Main scraping endpoint with SSE (Server-Sent Events)
app.get('/fetch-scans', async (req, res) => {
    const { email, password, headless, screenshots, days } = req.query;
    const isHeadless = headless === 'true';
    const enableScreenshots = screenshots === 'true';
    const daysBack = days ? parseInt(days, 10) : null; // null = fetch all projects

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    // Set up SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    function sendUpdate(type, data) {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    }

    async function sendScreenshot(page, caption) {
        try {
            const screenshot = await page.screenshot({ type: 'png' });
            sendUpdate('screenshot', { screenshot: screenshot.toString('base64'), caption });
        } catch (error) {
            console.error('Error taking screenshot:', error);
        }
    }

    let browser = null;
    let context = null;

    try {
        sendUpdate('progress', { progress: 2, message: 'Initializing browser...' });

        let allScans = [];

        browser = await chromium.launch({
            headless: isHeadless,
            args: ['--no-first-run', '--no-default-browser-check', '--disable-session-crashed-bubble', '--disable-infobars']
        });
        context = await browser.newContext();
        const page = await context.newPage();

        // --- Login ---
        sendUpdate('progress', { progress: 5, message: 'Navigating to Twindo...' });
        await page.goto(CANVAS_URL);
        await waitForNetworkIdle(page);

        sendUpdate('progress', { progress: 10, message: 'Logging in...' });
        await page.waitForSelector('input[name="username"]', { timeout: 10000 });
        await page.fill('input[name="username"]', email);
        await page.fill('input[name="password"]', password);
        await Promise.all([
            page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 }).catch(() => {}),
            page.click('button[type="submit"]')
        ]);
        await waitForNetworkIdle(page);

        if (enableScreenshots) await sendScreenshot(page, 'Logged in');

        // --- Projects page ---
        sendUpdate('progress', { progress: 15, message: 'Loading projects list...' });
        await page.goto('https://app.twindo.com/projects');
        await waitForNetworkIdle(page);
        await page.waitForSelector('[data-test-id="project-card"]', { timeout: 15000 });
        await page.waitForTimeout(2000);

        if (enableScreenshots) await sendScreenshot(page, 'Projects page');

        // Collect all project cards
        const projectCards = await page.evaluate(() => {
            const cards = document.querySelectorAll('[data-test-id="project-card"]');
            return Array.from(cards).map(card => {
                const nameEl = card.querySelector('p');
                const dateEl = card.querySelector('p.css-1t6s7gc') || [...card.querySelectorAll('p')].pop();
                return {
                    name: nameEl ? nameEl.innerText.trim() : '',
                    dateText: dateEl ? dateEl.innerText.trim() : ''
                };
            });
        });

        // Filter by recency
        const cutoffDate = daysBack ? new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000) : null;
        const filteredProjects = projectCards.filter(p => {
            if (!cutoffDate) return true;
            const d = parseProjectDate(p.dateText);
            return !isNaN(d) && d >= cutoffDate;
        });

        const filterMsg = daysBack
            ? `Found ${filteredProjects.length} project(s) updated in the past ${daysBack} days (out of ${projectCards.length} total)`
            : `Found ${projectCards.length} project(s)`;
        sendUpdate('progress', { progress: 20, message: filterMsg });
        console.log(filterMsg);
        filteredProjects.forEach(p => console.log(` - ${p.name}: ${p.dateText}`));

        if (filteredProjects.length === 0) {
            sendUpdate('progress', { progress: 100, message: 'No projects match the date filter.' });
            sendUpdate('complete', { message: 'No projects found in the given date range.' });
            return;
        }

        const progressIncrement = 75 / filteredProjects.length;
        let progressUpdate = 20;

        // --- Process each filtered project ---
        for (const project of filteredProjects) {
            sendUpdate('progress', { progress: progressUpdate, message: `Processing project: ${project.name}` });

            // Click the matching project card
            await page.goto('https://app.twindo.com/projects');
            await waitForNetworkIdle(page);
            await page.waitForSelector('[data-test-id="project-card"]', { timeout: 15000 });
            await page.waitForTimeout(2000);

            // Find and click the card by name
            const clicked = await page.evaluate((projectName) => {
                const cards = document.querySelectorAll('[data-test-id="project-card"]');
                for (const card of cards) {
                    const nameEl = card.querySelector('p');
                    if (nameEl && nameEl.innerText.trim() === projectName) {
                        card.click();
                        return true;
                    }
                }
                return false;
            }, project.name);

            if (!clicked) {
                console.log(`Could not find card for project: ${project.name}, skipping`);
                continue;
            }

            await waitForNetworkIdle(page);
            await page.waitForTimeout(3000);

            if (enableScreenshots) await sendScreenshot(page, `Project: ${project.name}`);

            // Extract all scans from this project
            const scans = await page.evaluate(() => {
                const results = [];
                const links = document.querySelectorAll('a[href*="viewer/obtain/scangroup"]');
                for (const link of links) {
                    // Walk up to find the container with p[title]
                    let el = link.parentElement;
                    for (let i = 0; i < 6; i++) {
                        if (!el) break;
                        const nameEl = el.querySelector('p[title]');
                        if (nameEl) {
                            results.push({
                                name: nameEl.getAttribute('title'),
                                url: link.getAttribute('href')
                            });
                            break;
                        }
                        el = el.parentElement;
                    }
                }
                return results;
            });

            console.log(`Project "${project.name}": ${scans.length} scans`);

            for (const scan of scans) {
                allScans.push({
                    account_name: email,
                    group: project.name,
                    scan_text: scan.name,
                    scan_url: scan.url
                });
            }

            sendUpdate('data', { scans: allScans });
            progressUpdate += progressIncrement;
        }

        // Final update
        sendUpdate('progress', { progress: 100, message: `Completed! ${allScans.length} scans collected.` });
        sendUpdate('data', { scans: allScans });
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
