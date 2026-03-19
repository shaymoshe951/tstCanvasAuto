// Twindo Scan Fetcher - Backend Server
// Uses Twindo REST API directly - no browser needed

console.log('Starting canvas-scraper-backend.js, __dirname:', __dirname);

const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { Writable } = require('stream');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const API_BASE = 'https://api.twindo.com/v3';

// Log all files in __dirname to debug Nixpacks file layout
try {
    console.log('Files in __dirname:', fs.readdirSync(__dirname).join(', '));
} catch (e) {
    console.log('Could not list __dirname:', e.message);
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

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

// Follow a single redirect (302/301) and return the Location URL
function followRedirect(url, token) {
    return new Promise((resolve) => {
        const u = new URL(url);
        const req = https.request({
            hostname: u.hostname,
            path: u.pathname + (u.search || ''),
            headers: { 'Authorization': 'JWT ' + token }
        }, res => {
            res.resume();
            if (res.statusCode === 301 || res.statusCode === 302) {
                resolve(res.headers.location || null);
            } else {
                resolve(null);
            }
        });
        req.on('error', () => resolve(null));
        req.end();
    });
}

// Get the S3 mesh download URL for a scan group (returns null if unavailable)
async function getMeshUrl(scanUuid, token) {
    try {
        const detail = await apiGet(`https://api.twindo.com/v3/scangroups/${scanUuid}/`, token);
        const assets = detail.assets || [];

        // Fetch all asset details in parallel
        const assetDetails = await Promise.all(
            assets.map(id => apiGet(`https://api.twindo.com/v3/assets/${id}/`, token).catch(() => null))
        );

        // Prefer reprocessed mesh, fall back to odp_mesh
        const mesh = assetDetails.find(a => a && a.type === 'mesh')
                  || assetDetails.find(a => a && a.type === 'odp_mesh');

        if (!mesh || !mesh.download_url) return null;
        return await followRedirect(mesh.download_url, token);
    } catch {
        return null;
    }
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

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'canvas-scraper.html'), err => {
    if (err) res.status(500).send('Error loading page: ' + err.message + ' | __dirname: ' + __dirname);
}));
app.get('/merger', (_req, res) => res.sendFile(path.join(__dirname, 'canvas-device-merger.html'), err => {
    if (err) res.status(500).send('Error loading page: ' + err.message + ' | __dirname: ' + __dirname);
}));

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', message: 'Backend server is running' });
});

// Main endpoint with SSE
app.get('/fetch-scans', async (req, res) => {
    const { email, password, days, includeMesh } = req.query;
    const daysBack = days ? parseInt(days, 10) : null;
    const fetchMesh = includeMesh === 'true';

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
                const mesh_url = fetchMesh ? await getMeshUrl(scan.uuid, token) : null;
                allScans.push({
                    account_name: email,
                    group: project.name,
                    scan_text: scan.name,
                    scan_url: scan.sharing_url || `https://api.twindo.com/viewer/obtain/scangroup/${scan.id}?redirect=1`,
                    ...(fetchMesh && { mesh_url: mesh_url || '' })
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

// --- Mesh bulk download ---

const meshJobs = new Map(); // jobId → { status, progress, total, message, zip, error }

function safeName(name) {
    return (name || 'unnamed').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'unnamed';
}

function downloadBuffer(url) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        https.get({ hostname: u.hostname, path: u.pathname + (u.search || ''), headers: { 'User-Agent': 'node' } }, res => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return downloadBuffer(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

// POST /start-mesh-download — starts async job, returns jobId immediately
app.post('/start-mesh-download', (req, res) => {
    const scans = (req.body.scans || []).filter(s => s.mesh_url);
    if (!scans.length) return res.status(400).json({ error: 'No mesh URLs found in scan data' });

    const jobId = crypto.randomUUID();
    meshJobs.set(jobId, { status: 'running', progress: 0, total: scans.length, message: 'Starting...', zip: null, error: null });
    res.json({ jobId });

    // Run download in background
    (async () => {
        const job = meshJobs.get(jobId);
        try {
            const chunks = [];
            const output = new Writable({ write(chunk, _, cb) { chunks.push(chunk); cb(); } });
            const archive = archiver('zip', { zlib: { level: 0 } }); // store only — mesh zips are already compressed
            const done = new Promise((resolve, reject) => {
                archive.on('error', reject);
                output.on('finish', resolve);
            });
            archive.pipe(output);

            // Build CSV rows (all scans, with local path for those that have mesh)
            const csvRows = [['Account Name', 'Group', 'Scan Text', 'Scan URL', 'Local Mesh Path'].join(',')];

            for (let i = 0; i < scans.length; i++) {
                const scan = scans[i];
                job.progress = i;
                job.message = `Downloading ${i + 1}/${scans.length}: ${scan.group} / ${scan.scan_text}`;
                console.log(job.message);

                const localPath = `${safeName(scan.group)}/${safeName(scan.scan_text)}.zip`;
                csvRows.push([scan.account_name, scan.group, scan.scan_text, scan.scan_url, localPath]
                    .map(f => `"${String(f).replace(/"/g, '""')}"`).join(','));

                try {
                    const buffer = await downloadBuffer(scan.mesh_url);
                    archive.append(buffer, { name: localPath });
                } catch (e) {
                    console.error(`  Failed to download mesh for ${scan.scan_text}:`, e.message);
                }
            }

            archive.append(csvRows.join('\n'), { name: 'scans.csv' });
            archive.finalize();
            await done;

            job.zip = Buffer.concat(chunks);
            job.progress = scans.length;
            job.status = 'done';
            job.message = `Done! ${scans.length} meshes packaged.`;
        } catch (e) {
            console.error('Mesh job error:', e);
            job.status = 'error';
            job.error = e.message;
        }
    })();
});

// GET /mesh-progress/:jobId — SSE progress stream
app.get('/mesh-progress/:jobId', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

    const timer = setInterval(() => {
        const job = meshJobs.get(req.params.jobId);
        if (!job) { clearInterval(timer); return res.end(); }
        const pct = job.total ? Math.round((job.progress / job.total) * 100) : 0;
        res.write(`data: ${JSON.stringify({ status: job.status, progress: pct, message: job.message, error: job.error })}\n\n`);
        if (job.status === 'done' || job.status === 'error') { clearInterval(timer); res.end(); }
    }, 500);

    req.on('close', () => clearInterval(timer));
});

// GET /mesh-zip/:jobId — serve the final ZIP
app.get('/mesh-zip/:jobId', (req, res) => {
    const job = meshJobs.get(req.params.jobId);
    if (!job || job.status !== 'done' || !job.zip) return res.status(404).json({ error: 'ZIP not ready' });
    const filename = `meshes_${new Date().toISOString().split('T')[0]}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(job.zip);
    meshJobs.delete(req.params.jobId);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n=================================`);
    console.log(`Twindo Scan Fetcher Backend`);
    console.log(`=================================`);
    console.log(`Server running on: http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`\nOpen http://localhost:${PORT} in your browser`);
    console.log(`=================================\n`);
});
