# Device Mapping Feature Guide

## Overview

The Canvas Scraper now supports uploading an Excel or CSV file containing device information (Device IDs and Serial Numbers) mapped to suite names. This allows you to automatically enrich your scan data with device information.

## How It Works

1. **Upload**: Before starting a scan, upload an Excel/CSV file with your device mapping
2. **Parse**: The system parses the file and creates a mapping of suite names to devices
3. **Match**: During the scan, each suite name is automatically matched with its devices
4. **Export**: The final output includes Device IDs and Device S/Ns columns

## File Format

### Required Columns

Your Excel or CSV file must have these columns (exact names):

- `Device id` - The unique identifier for each device
- `Suite name` - The name/number of the suite (e.g., "Ensuite 07", "10", "07")
- `Room name` - Room name (optional, not used for matching)
- `Room Type` - Type of room (optional, not used for matching)
- `Device S/N` - The serial number of the device

### Example Format

| Device id | Suite name | Room name | Room Type | Device S/N |
|-----------|-----------|-----------|-----------|------------|
| id_Qjg6RC_07 | Ensuite 07 | Bathroom | VXTBB230 | VXTBB230_SN_001 |
| id_MEMC6C_07 | Ensuite 07 | Bedroom | VXTBB230 | VXTBB230_SN_002 |
| id_Qjg6RC_08 | 08 | Bedroom | VXTBB230 | VXTBB230_SN_003 |
| id_MEMC6C_08 | Ensuite 08 | Bathroom | VXTBB230 | VXTBB230_SN_004 |

### Supported File Types

- `.csv` - Comma-separated values
- `.xlsx` - Microsoft Excel (2007+)
- `.xls` - Microsoft Excel (97-2003)

## Suite Name Matching

The system uses intelligent matching to connect scan names with suite names from your file:

### Exact Match
If the scan text exactly matches a suite name in your file, it uses that mapping.

**Example:**
- Scan: "Ensuite 07 Bathroom"
- File: "Ensuite 07" → ✅ Matches!

### Pattern Matching

If no exact match is found, the system tries several patterns:

1. **Ensuite patterns**: `Ensuite 07`, `07 Ensuite`
2. **Leading numbers**: `10 Bedroom`
3. **Suite prefix**: `Suite 07`

### Flexible Matching

The system also tries variations:
- With/without leading zeros: `7` vs `07`
- Different formats: `Suite 7`, `07`, `7`
- Partial matches: If your file has "07" and the scan has "Ensuite 07 Bathroom", it will match

### Examples

| Scan Text | Suite Name in File | Match? |
|-----------|-------------------|--------|
| "Ensuite 07 Bathroom" | "Ensuite 07" | ✅ Yes (exact) |
| "Ensuite 07 Bathroom" | "07" | ✅ Yes (pattern) |
| "10 Bedroom . Bedroom" | "10" | ✅ Yes (pattern) |
| "11 Ensuite 11 Bathroom" | "11" | ✅ Yes (pattern) |
| "Suite A123" | "A123" | ✅ Yes (partial) |
| "Random Text" | "07" | ❌ No match |

## Step-by-Step Usage

### Step 1: Prepare Your File

1. Create an Excel or CSV file
2. Add the required columns: `Device id`, `Suite name`, `Room name`, `Room Type`, `Device S/N`
3. Fill in your data
4. Save the file

**Tip**: Use the provided `device_mapping_template.csv` as a starting point!

### Step 2: Upload to Canvas Scraper

1. Open `canvas-scraper.html` in your browser
2. Look for the "📁 Upload Device Mapping (Optional)" section
3. Click "Choose File"
4. Select your Excel or CSV file
5. Wait for the success message: "✅ Processed X rows, found Y unique suites"

### Step 3: Run the Scan

1. Enter your Canvas.io credentials
2. Configure your preferences (headless mode, browser preview)
3. Click "Start Fetching"
4. The scan will automatically include device information

### Step 4: View Results

The data table will now show:
- Account Name
- Group
- Scan Text
- **Device IDs** ← New!
- **Device S/Ns** ← New!
- Scan URL

### Step 5: Export

Download as CSV or JSON - device information is included automatically!

## Output Format

### Multiple Devices Per Suite

If a suite has multiple devices, they are comma-separated:

**Device IDs**: `id_Qjg6RC_07, id_MEMC6C_07`
**Device S/Ns**: `VXTBB230_SN_001, VXTBB230_SN_002`

### No Match Found

If no matching suite is found in your uploaded file:

**Device IDs**: (empty)
**Device S/Ns**: (empty)

## Tips & Best Practices

### 1. Consistent Suite Names

Try to keep suite names consistent between your file and Canvas.io:
- If Canvas shows "Ensuite 07", use "Ensuite 07" or "07" in your file
- Avoid extra spaces or special characters

### 2. Upload Before Each Session

The device mapping is stored in memory on the backend server. If you restart the server, you'll need to upload the file again.

### 3. Update Your File

Keep your device mapping file up to date. Add new devices as they're deployed.

### 4. Check the Preview

After uploading, check the browser console (F12) to see the parsed mapping:
```javascript
console.log('Device mapping uploaded:', result.preview);
```

### 5. Test with a Small File First

Start with a few entries to ensure the format is correct before uploading a large file.

## Troubleshooting

### File Upload Fails

**Problem**: Error message when uploading file

**Solutions**:
1. Check file format (must be .csv, .xlsx, or .xls)
2. Ensure all required columns are present
3. Check for special characters in column names
4. Verify file size is under 10MB
5. Make sure backend server is running

### No Device Information in Results

**Problem**: Scan completes but Device IDs and S/Ns are empty

**Solutions**:
1. Check that you uploaded the file before starting the scan
2. Verify suite names in your file match the scan text patterns
3. Check browser console for matching logs
4. Try using simpler suite names (e.g., just numbers: "07", "08")

### Incorrect Matches

**Problem**: Wrong devices assigned to suites

**Solutions**:
1. Make suite names more specific in your file
2. Avoid duplicate suite numbers
3. Use the exact format from Canvas.io scan names
4. Check the pattern matching logic in the backend

### Backend Console Logs

Check the Node.js backend console for helpful debugging info:
```
Device mapping created: { 
  "Ensuite 07": { 
    "deviceIds": ["id_Qjg6RC_07", "id_MEMC6C_07"], 
    "deviceSNs": ["VXTBB230_SN_001", "VXTBB230_SN_002"] 
  } 
}
```

## Advanced: Customizing the Matching Logic

If you need to customize how suite names are matched, edit the `findMatchingSuite()` function in `canvas-scraper-backend.js`:

```javascript
// Helper function to find matching suite in device mapping
function findMatchingSuite(scanText) {
    // Add your custom matching logic here
    
    // Example: Add custom pattern
    const customPattern = /YourPattern(\d+)/i;
    const match = scanText.match(customPattern);
    if (match) {
        const suiteNum = match[1];
        if (deviceMapping[suiteNum]) {
            return deviceMapping[suiteNum];
        }
    }
    
    // ... rest of the function
}
```

## Example Workflow

**Scenario**: You have 50 suites with 2 devices each, and you want to track which devices are in each scan.

1. **Prepare data**:
   - Export device inventory to Excel
   - Ensure columns match required format
   - Save as `my_devices.xlsx`

2. **Upload**:
   - Open Canvas Scraper
   - Upload `my_devices.xlsx`
   - See confirmation: "✅ Processed 100 rows, found 50 unique suites"

3. **Scan**:
   - Enter credentials
   - Start scan
   - Watch as scans are enriched with device info in real-time

4. **Export**:
   - Download CSV with all device information
   - Import to your database or inventory system
   - Use for maintenance tracking, warranty management, etc.

## API Reference

### Upload Endpoint

**URL**: `POST /upload-devices`

**Content-Type**: `multipart/form-data`

**Body**:
```javascript
FormData {
    file: File (CSV/Excel)
}
```

**Response** (Success):
```json
{
    "success": true,
    "message": "Processed 100 rows, found 50 unique suites",
    "suites": ["Ensuite 07", "08", "09", ...],
    "preview": {
        "Ensuite 07": {
            "deviceIds": ["id_Qjg6RC_07"],
            "deviceSNs": ["VXTBB230_SN_001"]
        }
    }
}
```

**Response** (Error):
```json
{
    "error": "Error message here"
}
```

## Security Considerations

1. **File Size Limit**: Maximum 10MB per file
2. **Memory Storage**: Device mapping stored in server memory (cleared on restart)
3. **No Persistence**: Uploaded files are not saved to disk
4. **Local Only**: Upload endpoint accessible only on localhost (not exposed to network)

## Future Enhancements

Potential improvements for future versions:

- [ ] Persistent storage of device mappings
- [ ] Multiple mapping files per user
- [ ] Edit device mappings in the UI
- [ ] Import from database
- [ ] Export device mapping reports
- [ ] Device status tracking
- [ ] Automatic mapping suggestions

---

**Need help?** Check the main README.md or open an issue on the repository.

