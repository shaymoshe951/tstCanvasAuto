# UI Changes - Device Mapping Feature

## Visual Guide to New Interface Elements

---

## 🎨 New Upload Section

### Location
**Before the Login Form** - at the top of the login section

### Design
```
┌─────────────────────────────────────────────────────────────┐
│  📁 Upload Device Mapping (Optional)                        │
│  Upload an Excel or CSV file with device IDs and S/Ns per   │
│  suite                                                       │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ [Choose File]  device_mapping.xlsx                 │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ✅ Processed 100 rows, found 50 unique suites              │
└─────────────────────────────────────────────────────────────┘
```

### Features
- Light gray background (#f8f9fa)
- Blue dashed border on file input
- Real-time status feedback
- Success/error messages with icons

### States

**Before Upload**:
```
┌────────────────────────────────────────────────────┐
│ [Choose File]  No file chosen                      │
└────────────────────────────────────────────────────┘
```

**During Upload**:
```
⏳ Uploading and processing file...
```

**After Success**:
```
✅ Processed 100 rows, found 50 unique suites
```

**On Error**:
```
❌ Error: Unsupported file format. Please upload CSV or Excel file.
```

---

## 📊 Updated Data Table

### Old Table (4 columns)
```
┌──────────────┬─────────┬──────────────┬───────────┐
│ Account Name │ Group   │ Scan Text    │ Scan URL  │
├──────────────┼─────────┼──────────────┼───────────┤
│ John Doe     │ Medical │ Ensuite 07   │ View Scan │
│ John Doe     │ Medical │ 10 Bedroom   │ View Scan │
└──────────────┴─────────┴──────────────┴───────────┘
```

### New Table (6 columns)
```
┌──────────────┬─────────┬──────────────┬─────────────┬──────────────┬───────────┐
│ Account Name │ Group   │ Scan Text    │ Device IDs  │ Device S/Ns  │ Scan URL  │
├──────────────┼─────────┼──────────────┼─────────────┼──────────────┼───────────┤
│ John Doe     │ Medical │ Ensuite 07   │ id_001,     │ SN_001,      │ View Scan │
│              │         │ Bathroom     │ id_002      │ SN_002       │           │
├──────────────┼─────────┼──────────────┼─────────────┼──────────────┼───────────┤
│ John Doe     │ Medical │ 10 Bedroom   │ id_003      │ SN_003       │ View Scan │
└──────────────┴─────────┴──────────────┴─────────────┴──────────────┴───────────┘
```

### New Columns
1. **Device IDs** - Between "Scan Text" and "Scan URL"
2. **Device S/Ns** - Between "Device IDs" and "Scan URL"

### Empty State (No Mapping)
```
┌──────────────┬─────────┬──────────────┬─────────────┬──────────────┬───────────┐
│ Account Name │ Group   │ Scan Text    │ Device IDs  │ Device S/Ns  │ Scan URL  │
├──────────────┼─────────┼──────────────┼─────────────┼──────────────┼───────────┤
│ John Doe     │ Medical │ Ensuite 07   │             │              │ View Scan │
│ John Doe     │ Medical │ 10 Bedroom   │             │              │ View Scan │
└──────────────┴─────────┴──────────────┴─────────────┴──────────────┴───────────┘
```
*Columns appear but are empty when no device mapping is uploaded*

---

## 📥 Export Updates

### CSV Export Button
**No visual change** - button looks the same

**Updated filename**:
- Old: `canvas_scans_2024-01-15.csv`
- New: `canvas_scans_2024-01-15.csv` (same)

**Updated content**:
```csv
"Account Name","Group","Scan Text","Device IDs","Device S/Ns","Scan URL"
"John Doe","Medical","Ensuite 07 Bathroom","id_001, id_002","SN_001, SN_002","https://..."
```

### JSON Export Button
**No visual change** - button looks the same

**Updated content**:
```json
[
  {
    "account_name": "John Doe",
    "group": "Medical",
    "scan_text": "Ensuite 07 Bathroom",
    "device_ids": "id_001, id_002",
    "device_sns": "SN_001, SN_002",
    "scan_url": "https://..."
  }
]
```

---

## 🎯 Complete Page Layout

```
┌────────────────────────────────────────────────────────────┐
│                     HEADER (Purple Gradient)                │
│            🎨 Canvas.io Scan Fetcher                        │
│        Fetch and download your scans with ease              │
└────────────────────────────────────────────────────────────┘
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Login to Canvas.io                                    │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │                                                        │  │
│  │  📁 UPLOAD DEVICE MAPPING (OPTIONAL)  ← NEW!          │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ [Choose File] device_mapping.xlsx              │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  ✅ Processed 100 rows, found 50 unique suites       │  │
│  │                                                        │  │
│  │  Email                                                 │  │
│  │  [_____________________________________________]       │  │
│  │                                                        │  │
│  │  Password                                              │  │
│  │  [_____________________________________________]       │  │
│  │                                                        │  │
│  │  ☑ Show browser window (uncheck for headless mode)    │  │
│  │  ☑ Show browser preview (live screenshots)            │  │
│  │                                                        │  │
│  │  [      Start Fetching      ]                         │  │
│  │                                                        │  │
│  │  Progress: ████████████░░░░░░░░░░ 60%                │  │
│  │  📸 Browser Activity                                   │  │
│  │  [Screenshot preview]                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Scans Data                                            │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │                                                        │  │
│  │  📊 Total Scans: 25        📁 Groups: 3               │  │
│  │                                                        │  │
│  │  [📥 Download CSV]  [📥 Download JSON]                │  │
│  │                                                        │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ Account │ Group │ Scan │ Device │ Device │ URL │  │  │
│  │  │  Name   │       │ Text │  IDs   │  S/Ns  │     │  │  │
│  │  │         │       │      │  ← NEW │  ← NEW │     │  │  │
│  │  ├─────────┼───────┼──────┼────────┼────────┼─────┤  │  │
│  │  │ John    │ Med   │ En07 │ id_001 │ SN_001 │ View│  │  │
│  │  │ John    │ Med   │ 10Bd │ id_002 │ SN_002 │ View│  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## 🎨 Styling Details

### Upload Section Styling
```css
background: #f8f9fa;
padding: 20px;
border-radius: 8px;
margin-bottom: 30px;
```

### File Input Styling
```css
padding: 10px;
border: 2px dashed #667eea;
border-radius: 8px;
width: 100%;
background: white;
cursor: pointer;
```

### Upload Status Styling

**Loading State**:
```css
color: #667eea;  /* Blue */
```

**Success State**:
```css
color: #2e7d32;  /* Green */
```

**Error State**:
```css
color: #c62828;  /* Red */
```

### Table Columns
- All columns have equal width
- Purple header (#667eea)
- White sticky header on scroll
- Hover effect on rows (#f5f5f5)

---

## 📱 Responsive Behavior

### Desktop (1200px+)
- Full 6-column table visible
- Upload section inline
- All features accessible

### Tablet (768px - 1200px)
- Table scrolls horizontally
- Upload section stacked
- Columns maintain size

### Mobile (< 768px)
- Table scrolls horizontally
- Upload section full width
- Touch-friendly file picker
- Compact spacing

---

## 🔄 Interactive States

### File Input Interaction

**1. Initial State**
```
┌────────────────────────────────────────────────────┐
│ [Choose File]  No file chosen                      │
└────────────────────────────────────────────────────┘
```
*Dashed blue border, white background*

**2. Hover State**
```
┌────────────────────────────────────────────────────┐
│ [Choose File]  No file chosen                      │  ← Cursor changes
└────────────────────────────────────────────────────┘
```
*Cursor: pointer*

**3. File Selected**
```
┌────────────────────────────────────────────────────┐
│ [Choose File]  device_mapping.xlsx                 │
└────────────────────────────────────────────────────┘
```
*Filename displayed*

**4. Uploading**
```
⏳ Uploading and processing file...
```
*Blue color (#667eea)*

**5. Success**
```
✅ Processed 100 rows, found 50 unique suites
```
*Green color (#2e7d32)*

**6. Error**
```
❌ Error: Unsupported file format. Please upload CSV or Excel file.
```
*Red color (#c62828)*

---

## 🎯 User Flow Visualization

```
┌─────────────────────┐
│ User opens page     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Sees upload section │  ← NEW!
│ (Optional)          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Clicks "Choose File"│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Selects Excel/CSV   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Auto-upload starts  │
│ Shows loading msg   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Success message     │  ← Feedback
│ "✅ Processed..."   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Enters credentials  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Starts scan         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Table shows with    │  ← NEW COLUMNS!
│ Device IDs & S/Ns   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Downloads enriched  │
│ CSV/JSON            │
└─────────────────────┘
```

---

## 🖼️ Before & After Comparison

### Before (Version 2.0)
```
Login Section:
┌─────────────────────────┐
│ Email: [___________]    │
│ Password: [________]    │
│ ☑ Show browser         │
│ ☑ Show preview         │
│ [Start Fetching]       │
└─────────────────────────┘

Table:
┌─────┬───────┬──────┬─────┐
│ Acc │ Group │ Scan │ URL │
└─────┴───────┴──────┴─────┘
```

### After (Version 2.1)
```
Login Section:
┌─────────────────────────┐
│ 📁 Upload Device File   │  ← NEW!
│ [Choose File]          │
│ ✅ Success message     │
│                        │
│ Email: [___________]    │
│ Password: [________]    │
│ ☑ Show browser         │
│ ☑ Show preview         │
│ [Start Fetching]       │
└─────────────────────────┘

Table:
┌─────┬───────┬──────┬────┬────┬─────┐
│ Acc │ Group │ Scan │IDs │SNs │ URL │  ← NEW COLS!
└─────┴───────┴──────┴────┴────┴─────┘
```

---

## 🎨 Color Scheme

### Existing Colors (Maintained)
- Primary gradient: `#667eea` → `#764ba2`
- Success: `#2e7d32`
- Error: `#c62828`
- Info: `#1565c0`

### New Colors (Added)
- Upload section background: `#f8f9fa`
- Upload border: `#667eea` (dashed)
- Upload status loading: `#667eea`

### Consistency
All new elements follow the existing color scheme and design language.

---

## ✅ Accessibility

### Upload Section
- ✅ Label with clear description
- ✅ Accepted file types specified
- ✅ Success/error messages with icons and text
- ✅ Keyboard accessible
- ✅ Screen reader friendly

### Table Columns
- ✅ Column headers clearly labeled
- ✅ Semantic table structure
- ✅ Sticky headers for scrolling
- ✅ Contrast ratio compliant

---

## 📏 Dimensions

### Upload Section
- Padding: 20px
- Border radius: 8px
- Margin bottom: 30px
- Full width within container

### File Input
- Padding: 10px
- Border: 2px dashed
- Border radius: 8px
- Height: auto (based on content)

### Table Columns
- Auto-width based on content
- Minimum width ensures readability
- Horizontal scroll on small screens

---

## 🎬 Animation/Transitions

### Upload Status
- Fade in: 200ms
- Message appears immediately after upload
- No animations on status changes (instant feedback)

### File Input
- Hover: Cursor change (instant)
- No border animations
- Focus: Browser default blue outline

### Table
- Row hover: 200ms transition to #f5f5f5
- Maintained from existing design

---

## 💡 Tips for Users

### Visual Cues
1. **Optional Upload**: Gray background indicates optional feature
2. **Dashed Border**: Indicates file drop zone (visual affordance)
3. **Empty Columns**: Show even without data (consistent layout)
4. **Icon Feedback**: ✅❌⏳ provide instant status understanding

### Best Practices
1. Upload file BEFORE logging in (clearer workflow)
2. Wait for success message (confirms upload)
3. Check new columns after scan (verify data)
4. Empty device columns = no match found

---

## 📸 Screenshot Locations

If creating visual documentation, capture:

1. **Upload section** - Before file selection
2. **Upload section** - With file selected
3. **Upload section** - Success state
4. **Upload section** - Error state
5. **Full table** - With device data
6. **Full table** - Without device data (empty columns)
7. **CSV export** - Showing new columns
8. **Complete page** - Full workflow view

---

## 🎉 Summary of UI Changes

### Added
- ✅ Upload section (top of login form)
- ✅ File input with styled border
- ✅ Upload status display
- ✅ Device IDs table column
- ✅ Device S/Ns table column

### Modified
- ✅ Table headers (2 new columns)
- ✅ Table rows (2 new cells per row)
- ✅ CSV export format
- ✅ JSON export format

### Maintained
- ✅ Overall design language
- ✅ Color scheme
- ✅ Responsive behavior
- ✅ Existing functionality

---

**UI Version**: 2.1.0
**Design**: Consistent with existing interface
**Accessibility**: Full compliance maintained
**Responsive**: Works on all screen sizes

