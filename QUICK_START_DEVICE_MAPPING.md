# Quick Start - Device Mapping Feature

## 5-Minute Setup Guide

### Prerequisites
✅ Canvas Scraper already installed and working
✅ Excel or CSV file with device data

### Step 1: Install New Dependencies (30 seconds)

```bash
npm install
```

This installs `multer` and `xlsx` libraries.

### Step 2: Prepare Your Device File (2 minutes)

**Option A**: Use the template
1. Open `device_mapping_template.csv`
2. Replace with your data
3. Save

**Option B**: Create from scratch
1. Create Excel or CSV file
2. Add these columns:
   - `Device id`
   - `Suite name`
   - `Room name`
   - `Room Type`
   - `Device S/N`
3. Fill in your devices
4. Save

**Example Row**:
```
id_Qjg6RC_07, Ensuite 07, Bathroom, VXTBB230, VXTBB230_SN_001
```

### Step 3: Start the Server (5 seconds)

```bash
npm start
```

### Step 4: Upload Your File (30 seconds)

1. Open `canvas-scraper.html` in browser
2. Click "Choose File" under "Upload Device Mapping"
3. Select your file
4. Wait for ✅ success message

### Step 5: Run a Scan (Normal process)

1. Enter Canvas.io credentials
2. Configure settings
3. Click "Start Fetching"
4. Watch the scan run with device info!

### Step 6: View Results (10 seconds)

The table now shows:
- Account Name
- Group
- Scan Text
- **Device IDs** ← Your devices!
- **Device S/Ns** ← Your serial numbers!
- Scan URL

### Step 7: Export (5 seconds)

Click "📥 Download CSV" or "📥 Download JSON"

Device information is automatically included! 🎉

---

## Common Suite Name Formats

Your "Suite name" column should match what Canvas.io shows:

| Canvas.io Shows | Use in Your File |
|----------------|------------------|
| "Ensuite 07 Bathroom" | "Ensuite 07" or "07" |
| "10 Bedroom . Bedroom" | "10" |
| "11 Ensuite 11 Bathroom" | "11" or "Ensuite 11" |
| "Suite A123 Kitchen" | "Suite A123" or "A123" |

**Tip**: When in doubt, use just the number! Example: `07`, `10`, `11`

---

## Troubleshooting (30 seconds)

### Upload fails?
- ✅ Check file is .csv, .xlsx, or .xls
- ✅ Ensure column names are exact
- ✅ Server must be running

### No device info in results?
- ✅ Upload file BEFORE scanning
- ✅ Check suite names match
- ✅ Try using just numbers (07, 08, etc.)

### Wrong devices showing?
- ✅ Make suite names more specific
- ✅ Check for duplicates in your file
- ✅ Review the matching in console (F12)

---

## Example Workflow

**Real-world example**: 20 suites, 2 devices each

1. **Export** your device inventory → Excel
2. **Format** to match required columns (2 min)
3. **Save** as `devices.xlsx`
4. **Start** Canvas Scraper backend (`npm start`)
5. **Open** frontend in browser
6. **Upload** `devices.xlsx` (wait for ✅)
7. **Login** to Canvas.io
8. **Scan** as usual
9. **Download** enriched CSV with device info
10. **Done!** Use the data for inventory, maintenance, etc.

**Total time**: ~5 minutes after first setup

---

## Tips for Success

### 1. Keep It Simple
Start with just suite numbers: `07`, `08`, `09`

### 2. Test Small
Upload 3-5 suites first to verify format

### 3. Check the Preview
After upload, open browser console (F12):
```javascript
// You'll see your mapping:
Device mapping uploaded: {
  "07": { deviceIds: [...], deviceSNs: [...] }
}
```

### 4. Update Regularly
Keep your device file current as devices are added/removed

### 5. Reupload After Restart
If you restart the backend server, upload the file again

---

## That's It! 🎉

You're now enriching your Canvas scans with device information automatically.

**Need more details?** See:
- `DEVICE_MAPPING_GUIDE.md` - Full documentation
- `README.md` - General usage
- `CHANGELOG_DEVICE_MAPPING.md` - Technical details

**Questions?** Check the troubleshooting sections in the guides above.

---

**Happy Scanning!** 🚀

