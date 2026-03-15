// Twindo Scan Fetcher - Backend Server
// Uses Twindo REST API directly - no browser needed

const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const API_BASE = 'https://api.twindo.com/v3';

// Read HTML files at startup — crashes immediately if files are missing (easier to debug)
const SCRAPER_HTML = fs.readFileSync(path.join(__dirname, 'canvas-scraper.html'), 'utf8');
const MERGER_HTML  = fs.readFileSync(path.join(__dirname, 'canvas-device-merger.html'), 'utf8');

console.log(`HTML files loaded. Scraper: ${SCRAPER_HTML.length} chars, Merger: ${MERGER_HTML.length} chars`);

app.use(cors());
app.use(express.json());

// --- API helpers ---

function apiPost(endpoint, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const url = new URL(API_BASE + endpoint);
        const req = https.request({
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        }, res => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => {
                try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('Invalid JSON: ' + raw.substring(0, 200))); }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function apiGet(url, token) {
    return new Promise((resolve, reject) => {
        const u = new URL(url.startsWith('http') ? url : API_BASE + url);
        const req = https.request({
            hostname: u.hostname,
            path: u.pathname + (u.search || ''),
            headers: { 'Authorization': 'JWT ' + token }
        }, res => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => {
                try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('Invalid JSON: ' + raw.substring(0, 200))); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// Fetch all pages of a paginated endpoint
async function fetchAllPages(firstUrl, token) {
    const results = [];
    let url = firstUrl;
    while (url) {
        const page = await apiGet(url, token);
        results.push(...page.results);
        url = page.next || null;
    }
    return results;
}

// --- Routes ---

app.get('/', (_req, res) => res.type('html').send(SCRAPER_HTML));
app.get('/merger', (_req, res) => res.type('html').send(MERGER_HTML));

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', message: 'Backend server is running' });
});

// Main endpoint with SSE
app.get('/fetch-scans', async (req, res) => {
    const { email, password, days } = req.query;
    const daysBack = days ? parseInt(days, 10) : null;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    function sendUpdate(type, data) {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    }

    try {
        sendUpdate('progress', { progress: 5, message: 'Authenticating...' });

        // Login
        const { token } = await apiPost('/user/token/', { username: email, password });
        if (!token) throw new Error('Login failed — check your credentials');

        sendUpdate('progress', { progress: 15, message: 'Fetching projects list...' });

        // Fetch all projects ordered by most recently modified
        const cutoffDate = daysBack ? new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000) : null;
        const allProjects = [];
        let url = `${API_BASE}/projects/?page=1&page_size=40&ordering=-modified_on`;
        let done = false;

        while (url && !done) {
            const page = await apiGet(url, token);
            for (const project of page.results) {
                if (cutoffDate && new Date(project.modified_on) < cutoffDate) {
                    done = true; // Projects are sorted newest-first, so we can stop early
                    break;
                }
                allProjects.push(project);
            }
            url = done ? null : (page.next || null);
        }

        const filterMsg = daysBack
            ? `Found ${allProjects.length} project(s) updated in the past ${daysBack} days`
            : `Found ${allProjects.length} project(s)`;
        sendUpdate('progress', { progress: 20, message: filterMsg });
        console.log(filterMsg);

        if (allProjects.length === 0) {
            sendUpdate('progress', { progress: 100, message: 'No projects match the date filter.' });
            sendUpdate('complete', { message: 'No projects found in the given date range.' });
            return;
        }

        const allScans = [];
        const progressIncrement = 75 / allProjects.length;
        let progressUpdate = 20;

        for (const project of allProjects) {
            sendUpdate('progress', { progress: Math.round(progressUpdate), message: `Processing: ${project.name}` });
            console.log(`Project "${project.name}" (modified: ${project.modified_on})`);

            // Fetch all scan groups for this project
            const scanGroups = await fetchAllPages(
                `${API_BASE}/web-platform/scangroups/?project=${project.uuid}&page=1&page_size=40`,
                token
            );

            console.log(`  ${scanGroups.length} scans`);

            for (const scan of scanGroups) {
                allScans.push({
                    account_name: email,
                    group: project.name,
                    scan_text: scan.name,
                    scan_url: scan.sharing_url || `https://api.twindo.com/viewer/obtain/scangroup/${scan.id}?redirect=1`
                });
            }

            sendUpdate('data', { scans: allScans });
            progressUpdate += progressIncrement;
        }

        sendUpdate('progress', { progress: 100, message: `Completed! ${allScans.length} scans collected.` });
        sendUpdate('data', { scans: allScans });
        sendUpdate('complete', { message: 'Scan fetching completed successfully' });

    } catch (error) {
        console.error('Error:', error);
        sendUpdate('error', { message: error.message });
    } finally {
        res.end();
    }
});

app.listen(PORT, () => {
    console.log(`\n=================================`);
    console.log(`Twindo Scan Fetcher Backend`);
    console.log(`=================================`);
    console.log(`Server running on: http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`\nOpen http://localhost:${PORT} in your browser`);
    console.log(`=================================\n`);
});
