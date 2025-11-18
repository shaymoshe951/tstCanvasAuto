# Canvas.io Scan Fetcher

A modern web-based tool to fetch and download scans from Canvas.io with a beautiful, user-friendly interface.

## ⚡ Version 2.0 - Now 5-10x Faster!

The latest version uses an optimized clipboard-based method to extract URLs, making the entire process dramatically faster than before. No more waiting for new tabs to open - just fast, efficient scanning!

## 🌟 Features

- **Modern UI**: Beautiful gradient design with smooth animations
- **Real-time Progress**: Live progress updates during scanning
- **Headless Mode Control**: Choose whether to show the browser window or run hidden 🖥️
- **Browser Preview**: See live screenshots of what's happening (optional toggle!) 📸
- **Data Export**: Download results as CSV or JSON
- **Caching**: Automatically caches results to avoid duplicate fetching
- **Statistics**: View scan counts and group statistics
- **Responsive Design**: Works on desktop and mobile devices

## 🆕 What's New in Version 2.0

- ⚡ **5-10x Faster**: New clipboard-based URL extraction (no more opening new tabs!)
- 📸 **Browser Preview**: See live screenshots of the automation process (with ON/OFF toggle!)
- 🎯 **Updated Navigation**: Now uses "Projects" instead of "Uploaded Scans"
- 💾 **Reduced Memory**: Much lower memory footprint during scanning
- 🔒 **More Reliable**: Better error handling and stability
- 📋 **Clipboard Permissions**: Automatically handles clipboard access for faster operation

See [CHANGELOG.md](CHANGELOG.md), [BROWSER_PREVIEW_GUIDE.txt](BROWSER_PREVIEW_GUIDE.txt), and [BROWSER_PREVIEW_TOGGLE.txt](BROWSER_PREVIEW_TOGGLE.txt) for full details.

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

## 🚀 Installation

1. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

2. **Install Playwright browser**:
   ```bash
   npm run install-browser
   ```

## 🎯 Usage

### Step 1: Start the Backend Server

Run the Node.js backend server:

```bash
npm start
```

Or:

```bash
node canvas-scraper-backend.js
```

You should see:
```
=================================
Canvas.io Scan Fetcher Backend
=================================
Server running on: http://localhost:3000
Health check: http://localhost:3000/health
=================================
```

### Step 2: Open the Frontend

Open `canvas-scraper.html` in your web browser:

- **Option 1**: Double-click the file
- **Option 2**: Right-click → Open With → Your Browser
- **Option 3**: Drag and drop into browser window

### Step 3: Login and Fetch

1. Enter your Canvas.io email and password
2. **Choose your preferences:**
   - ☑/☐ "Show browser window": Toggle to control headless mode
     - Checked: Browser window visible on desktop
     - Unchecked: Runs hidden in background (faster, cleaner)
   - ☑/☐ "Show browser preview": Toggle to control screenshots
     - Checked: See live screenshots in the web interface
     - Unchecked: Faster processing without screenshots
3. Click "Start Fetching"
4. Watch the progress bar as it collects your scans
5. View results in the data table
6. Download as CSV or JSON

**Recommended:** ☐☑ (headless + preview) for the best experience!

## 📁 File Structure

```
.
├── canvas-scraper.html          # Frontend interface (HTML/CSS/JS)
├── canvas-scraper-backend.js    # Backend server (Node.js + Playwright)
├── package.json                 # Node.js dependencies
├── canvas_data/                 # Data storage folder (auto-created)
│   ├── cache_[user].json       # Cached scan data
│   └── [account_name]/         # Account-specific files
└── README.md                    # This file
```

## ⚙️ Configuration

### Backend Server (canvas-scraper-backend.js)

```javascript
const PORT = 3000;                    // Server port
const CANVAS_URL = 'https://...';     // Canvas.io login URL
const SHOW_BROWSER = true;            // Set to false for headless mode
```

### Frontend (canvas-scraper.html)

```javascript
const BACKEND_URL = 'http://localhost:3000';  // Backend server URL
```

## 🔧 Troubleshooting

### Backend Not Connected

**Problem**: Frontend shows "Backend server not available"

**Solution**: 
1. Make sure the backend server is running (`npm start`)
2. Check that PORT 3000 is not in use
3. Verify BACKEND_URL in canvas-scraper.html matches your server

### Browser Not Opening

**Problem**: Backend runs but browser doesn't open

**Solution**:
1. Reinstall Playwright browser: `npm run install-browser`
2. Check that Chromium installed correctly
3. Try setting `SHOW_BROWSER = false` for headless mode

### Login Fails

**Problem**: Login not working or timing out

**Solution**:
1. Verify your Canvas.io credentials
2. Check the CANVAS_URL is correct
3. Update the login selectors in the backend code if Canvas.io changed their UI
4. Check for CAPTCHA or 2FA requirements

### Scans Not Appearing

**Problem**: Progress completes but no scans show

**Solution**:
1. Check browser console for errors (F12 → Console)
2. Verify Canvas.io page structure hasn't changed
3. Check the cache file in `canvas_data/` folder
4. Clear cache and try again

## 🎨 Customization

### Change Colors

Edit the CSS in `canvas-scraper.html`:

```css
/* Primary gradient */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Change to your colors */
background: linear-gradient(135deg, #YOUR_COLOR1 0%, #YOUR_COLOR2 100%);
```

### Add More Data Fields

1. Update the data structure in backend:
```javascript
tableDict = {
    account_name: [],
    group: [],
    scan_text: [],
    scan_url: [],
    your_new_field: []  // Add here
};
```

2. Add table column in HTML:
```html
<th>Your New Field</th>
```

3. Add data cell:
```javascript
<td>${scan.your_new_field}</td>
```

## 📊 Data Format

### JSON Output
```json
[
  {
    "account_name": "John Doe",
    "group": "Medical Records",
    "scan_text": "Lab_Results_2024",
    "scan_url": "https://canvas.io/view/..."
  }
]
```

### CSV Output
```csv
Account Name,Group,Scan Text,Scan URL
John Doe,Medical Records,Lab_Results_2024,https://canvas.io/view/...
```

## 🔒 Security Notes

- **Never commit your credentials** to version control
- The cache file contains URLs but not passwords
- Run backend on localhost only (not publicly accessible)
- Consider using environment variables for sensitive data

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review browser console for errors (F12)
3. Check Node.js console for backend errors
4. Verify Canvas.io hasn't changed their website structure

## 📝 License

MIT License - Feel free to modify and use as needed

## 🙏 Credits

Built with:
- [Playwright](https://playwright.dev/) - Browser automation
- [Express.js](https://expressjs.com/) - Backend server
- Vanilla JavaScript - Frontend interactivity

---

**Note**: This tool is for personal use only. Make sure you comply with Canvas.io's terms of service when using this tool.
