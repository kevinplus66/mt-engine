# PANEL Testing Checklist

**Date**: 2026-01-26
**Version**: 1.0
**Status**: Ready for Testing

## Pre-Testing Requirements

- [ ] Docker environment properly configured
- [ ] `.env` file contains all required variables:
  - `MT_TOKEN`
  - `MT_USER_ID`
  - `QBITTORRENT_URL`
  - `QBITTORRENT_USER`
  - `QBITTORRENT_PASSWORD`
- [ ] qBittorrent has at least one torrent with M-Team tags
- [ ] Application started and running for at least 6 minutes (to collect initial data)

## Code Verification (Automated)

### Backend
- [x] Python syntax validation passed (panel_db.py, panel_collector.py, panel.py)
- [x] Database schema created correctly (traffic_stats, user_stats tables)
- [x] Database indexes created (idx_traffic_time, idx_traffic_source, idx_user_time)
- [x] Data collection integration added to main.py
- [x] Daily cleanup task scheduled
- [x] PANEL router registered in main.py

### Frontend
- [x] HTML template created (panel.html)
- [x] CSS styles created (panel.css)
- [x] JavaScript components created:
  - [x] chart.js (276 lines, 7 functions)
  - [x] stats-card.js (153 lines, 5 functions)
  - [x] panel.js (263 lines, 11 functions)
- [x] Chart.js CDN included (v4.4.0)
- [x] All 8 stat cards present in template
- [x] All 3 canvas elements present (traffic-chart, daily-chart, ratio-chart)

### Configuration
- [x] .gitignore updated (panel.db, panel.db-journal)
- [x] Database file NOT staged in git
- [x] data/ directory exists with .gitkeep

## Database Verification

- [x] traffic_stats table exists
- [x] user_stats table exists
- [x] Data is being collected (verified 2 traffic rows, 1 user row)
- [x] Timestamps are UTC integers
- [ ] Data retention cleanup working (verify after 31 days)

## Manual Testing Checklist

### Page Access
- [ ] Navigate to `http://localhost:8000/panel`
- [ ] Page loads without errors
- [ ] No 404 or 500 errors in browser console
- [ ] All static assets load (CSS, JavaScript)

### Stat Cards (Top Section)
- [ ] Share Ratio card displays value (format: X.XX)
- [ ] Share Ratio card shows mini trend line (SVG sparkline)
- [ ] Share Ratio card shows 24h change (↑/↓ with value)
- [ ] Uploaded card displays value (format: X.XX GB/TB)
- [ ] Downloaded card displays value (format: X.XX GB/TB)
- [ ] Bonus card displays value (魔力值)
- [ ] Seeding Count card displays value (做种数)
- [ ] Leeching Count card displays value (下载数)
- [ ] User Level card displays text (等级)
- [ ] Last Update card displays Beijing time (Asia/Shanghai)

### Traffic Trend Chart (First Chart)
- [ ] Chart renders without errors
- [ ] 4 lines visible:
  - [ ] qBittorrent upload (gray solid)
  - [ ] M-Team upload (red dashed)
  - [ ] qBittorrent download (gray dotted)
  - [ ] M-Team download (red dot-dash)
- [ ] X-axis shows time labels
- [ ] Y-axis shows size labels (GB/TB)
- [ ] Hovering shows tooltip with values
- [ ] Legend displays correctly

### Daily Bar Chart (Second Chart)
- [ ] Chart renders without errors
- [ ] Bars visible for each day
- [ ] Upload and download bars grouped
- [ ] X-axis shows dates
- [ ] Y-axis shows size labels
- [ ] Hovering shows tooltip

### Share Ratio Chart (Third Chart)
- [ ] Chart renders without errors
- [ ] Line shows trend over time
- [ ] Highest/lowest points annotated
- [ ] X-axis shows time labels
- [ ] Y-axis shows ratio values

### Time Range Switching
- [ ] 24H button active by default
- [ ] Clicking 7D button:
  - [ ] Button becomes active
  - [ ] Charts update with 7-day data
  - [ ] Data aggregation changes (hourly)
- [ ] Clicking 30D button:
  - [ ] Button becomes active
  - [ ] Charts update with 30-day data
  - [ ] Data aggregation changes (daily)
- [ ] Clicking 24H again returns to 5-minute data

### Auto-Refresh
- [ ] Wait 5 minutes after page load
- [ ] Verify charts update automatically
- [ ] Verify stat cards update automatically
- [ ] Last update time changes
- [ ] No errors in browser console

### Responsive Design
#### Desktop (>1024px)
- [ ] 4-column stat card grid
- [ ] Charts display full width
- [ ] All elements visible

#### Tablet (768-1024px)
- [ ] 3-column stat card grid
- [ ] Charts display full width

#### Mobile (<768px)
- [ ] 2-column stat card grid
- [ ] Charts may require horizontal scroll (acceptable)
- [ ] Touch interactions work

### Dark/Light Theme
- [ ] Switch to dark theme
- [ ] All text readable
- [ ] Charts use correct colors
- [ ] Borders visible
- [ ] Switch back to light theme
- [ ] Everything displays correctly

## API Testing

### GET /api/panel/stats
- [ ] Returns 200 status
- [ ] Returns JSON with `mteam`, `qbittorrent`, `last_update` keys
- [ ] `mteam` object contains: share_ratio, uploaded, downloaded, uploaded_display, downloaded_display, seeding_count, leeching_count
- [ ] `qbittorrent` object contains: uploaded, downloaded, upload_speed, download_speed
- [ ] Numeric values are integers/floats
- [ ] Display strings use decimal units (1KB=1000)

### GET /api/panel/history?range=24h
- [ ] Returns 200 status
- [ ] Returns JSON with `range`, `data_points`, `aggregation` keys
- [ ] `data_points` array not empty
- [ ] Each point has: timestamp, mteam, qbittorrent objects
- [ ] `aggregation` is "5min"

### GET /api/panel/history?range=7d
- [ ] Returns data aggregated by hour
- [ ] `aggregation` is "1hour"

### GET /api/panel/history?range=30d
- [ ] Returns data aggregated by day
- [ ] `aggregation` is "1day"

### GET /api/panel/share-ratio?range=24h
- [ ] Returns 200 status
- [ ] Returns JSON with `data_points`, `current`, `highest`, `lowest`, `change_24h` keys
- [ ] `data_points` array contains timestamp and share_ratio values
- [ ] Statistics calculated correctly

## Error Handling

### No qBittorrent Connection
- [ ] Stats API returns zeros for qbittorrent data
- [ ] Page still loads
- [ ] No uncaught exceptions

### No M-Team API Access
- [ ] Stats API returns nulls or defaults for mteam data
- [ ] Page still loads
- [ ] No uncaught exceptions

### Empty Database (First 5 Minutes)
- [ ] Page shows "暂无数据" message
- [ ] Charts display empty state gracefully
- [ ] No JavaScript errors

### API Timeout
- [ ] Toast notification appears (if implemented)
- [ ] Old data remains visible
- [ ] Retry possible

## Performance

- [ ] Page loads in <2 seconds
- [ ] Chart rendering smooth (<500ms)
- [ ] Time range switching instant (<300ms)
- [ ] Auto-refresh doesn't cause UI lag
- [ ] Memory usage stable (no leaks)

## Known Limitations

### Incomplete Data Fields
- **Bonus (魔力值)**: Not collected (M-Team API `fetch_user_profile()` doesn't return bonus)
  - Card will show "N/A" or 0
  - Database field exists but remains NULL
  - Future enhancement needed: Call additional M-Team API endpoint

- **User Level (等级)**: Not collected (M-Team API `fetch_user_profile()` doesn't return user_level)
  - Card will show "N/A" or empty
  - Database field exists but remains NULL
  - Future enhancement needed: Call additional M-Team API endpoint

### Expected Behavior
- These two cards will not display real data until M-Team API integration is enhanced
- This is **not a bug** - it's a known limitation documented in the design phase
- All other 6 stat cards should display correctly

## Log Verification

Check application logs for:
- [ ] "PANEL 数据库初始化成功" (on startup)
- [ ] "采集 qBittorrent 数据成功" (every 5 minutes)
- [ ] "采集 M-Team 数据成功" (every 5 minutes)
- [ ] No exceptions in panel_db.py
- [ ] No exceptions in panel_collector.py
- [ ] No exceptions in panel.py routes

## Docker Testing

- [ ] Build Docker image succeeds
- [ ] Container starts without errors
- [ ] Volume mapping works (data/ persists)
- [ ] Health check endpoint responds
- [ ] Logs accessible via `docker logs`

## Deployment Checklist

- [ ] All tests above passed
- [ ] No critical bugs found
- [ ] Documentation updated (see Task 12)
- [ ] .gitignore verified (no sensitive data)
- [ ] Docker compose tested
- [ ] Ready for production deployment

---

**Testing completed by**: ________________
**Date**: ________________
**Result**: ☐ PASS  ☐ FAIL (describe issues below)

**Notes**:
