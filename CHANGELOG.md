# Changelog

All notable changes to M-Team Engine.

## [5.2.0] - 2026-01 - UI 优化与权限修复

### Frontend Enhancements
**PANEL 面板优化**:
- 图表交互优化：桌面设备悬停显示数据标签，触屏设备点击切换
- 图表数据点标签增加容错（触屏点击误差处理）
- 图例复选框视觉改进：选中显示 ✓，未选中显示 ✕
- 时间范围选项扩展：新增 1H、6H、12H 选项

**表格样式统一（SONAR/RADAR/PANEL）**:
- 移除触屏设备蓝色高亮（-webkit-tap-highlight-color）
- 移除链接点击时的红色激活态（仅保留桌面悬停效果）
- 统一触屏交互体验

**PILOT 页面优化**:
- 优化 Dry Run 结果显示格式
- 调整表单标签样式（干净简洁）

### Bug Fixes
**图表修复**:
- 修复 `getNothingOSChartOptions()` 缺少 return 语句导致的问题
- 修复流量图表 Y 轴显示原始字节数（现正确显示如 "100 GB"）
- 修复分享率图表完全空白（TypeError 崩溃）

### System Improvements
**权限配置化**:
- 新增 `PUID` 和 `PGID` 环境变量支持
- docker-compose.yml 支持通过环境变量配置容器用户 UID/GID
- 解决不同 NAS 系统（Synology、FNOS、UGREEN）的权限问题
- 启动时自动检测数据目录写入权限，提供明确错误提示
- README 新增权限问题排查章节

### Documentation
- 更新 agent.md：说明支持多种 NAS 系统部署
- 更新 .env.example：添加 PUID/PGID 配置说明

---

## [5.1.0] - 2026-01 - PILOT 优化与性能提升

### Architecture Optimization
**PILOT 前后端分离优化**:
- 前端移除所有 config 数据转换逻辑，所有数值由后端统一提供
- 百分比字段整数化：`disk_usage_threshold` 和 `elimination_ratio` 改为整数存储 (90 而非 0.90)
- 自动配置迁移：旧配置文件自动迁移到新格式，无需手动处理

### New Features
- 僵尸种子检测：新增 `dead_seed_minutes` 和 `dead_seed_max_ratio` 配置项
- 末位淘汰优化：基于综合评分（速度、体积、做种人数）智能清理

### Performance Optimization
- 后端 M-Team API 刷新间隔：10分钟 → 5分钟
- SONAR 前端轮询优化：1分钟 → 5分钟 (与后端同步)
- PILOT stats 轮询优化：10秒 → 1分钟
- 减少无效请求，降低系统负载

---

## [5.0.0] - 2026-01 - PILOT (领航) Module

### New Feature: PILOT
Fully-automated torrent management system for M-Team free torrents.

**Core Components**:
- `app/core/rules.py`: Scoring engine with normalized 0-1 weighted scoring
- `app/core/pilot.py`: PilotManager with background loop
- `app/routes/pilot.py`: Pilot API endpoints

**Features**:
- Rule-based scoring: Size, free time, age, seeders weights
- Disk space check: Stops downloads above threshold
- Duplicate prevention: Pending downloads set
- Zombie detection: Auto-deletes stuck downloads
- H&R protection: Minimum seed time before cleanup
- Path isolation: Downloads to configurable `save_path` with `PILOT` tag
- Config persisted to JSON

**Frontend**: New `/pilot` page with Dashboard and Rules tabs

### Bug Fixes (2026-01-24)

**Table CSS Improvements**:
- Fixed table column disappearing with long content (added min-width to columns)
- Added name column max-width: 1100px (desktop), 400px (tablet)
- Fixed arrow and title on separate lines (flexbox layout for .torrent-name)
- Added title ellipsis for overflow handling
- Shortened English status text ("Downloading" → "DL", "Not Downloaded" → "None")
- Centered peer count "/" separator

---

## [4.0.0] - 2026-01

### Major Code Modularization

**Backend Refactor**: Complete modularization of main.py (~2000 lines → 19 modules, 2289 total lines)
- `main.py` reduced from 2000 lines to 237 lines (88% reduction)
- Created organized module structure: config, models, utils, constants, state
- Service layer: http_client, mteam_api, qbittorrent, pushplus
- Core logic: torrent processing, alerts & auto-delete
- Routes layer: pages, torrents API, search API

**Frontend Refactor**: Complete modularization of HTML templates
- CSS extracted to 11 modular files (variables, base, layout, components + 6 modules)
- JavaScript extracted to 12 ES6 modules (config, utils, i18n, api + 7 components + 2 pages)
- Jinja2 template inheritance with `base.html`
- `index.html` reduced from 3751 to 226 lines (94% reduction)
- `seeder.html` reduced from 2062 to 305 lines (85% reduction)
- BEM naming convention for CSS classes

**Benefits**:
- Maintainability: Each module has single responsibility, clearer code organization
- Testability: Modular structure enables easier unit testing
- Extensibility: New features can be added to appropriate modules without affecting others
- Collaboration: Multiple developers can work on different modules simultaneously
- No Functional Changes: All existing features preserved, API endpoints unchanged

### Bug Fixes (2026-01-22)

Post-modularization code review and fixes:

**Backend**:
- Fixed Pydantic deprecation: `@validator` → `@field_validator` with `@classmethod`
- Added `asyncio.Lock()` to prevent race conditions in HTTP client initialization
- Added `asyncio.Lock()` to prevent race conditions in qBittorrent session cache
- Removed duplicate `_safe_int` function (now imported from utils.py)

**Frontend JavaScript**:
- Fixed `toggleAutoDelete()` API call not passing `enable` parameter
- Fixed `currentLang` reactivity issue (ES6 import binding not updating)
- Fixed `filterState` variable shadowing in search.js filter handlers
- Added 18 missing i18n translation keys for both Chinese and English

**Frontend CSS**:
- Added 28 missing CSS class definitions for seeder.html components
- New styles for: toggle switches, status indicators, badges, filter buttons

---

## [3.0.2] - 2026-01

### API Call Optimization & Caching

**Backend Optimization**:
- **Added 1-hour cache** for user status data (seeding/leeching/collection/profile/rival)
- **Added 24-hour cache** for categories list
- Implemented timestamp-based cache invalidation system

**Performance Impact**:
- Reduced API calls from **10 to 4** when cache is valid (60% reduction)
- First refresh: 10 API calls (cold cache)
- Subsequent refreshes within 1 hour: **4 API calls** (only torrent searches)
- Subsequent refreshes within 24 hours: 4-5 API calls

**Developer Experience**:
- Added detailed cache logging: "✓ 用户状态已刷新" vs "→ 用户状态使用缓存"
- Logs show elapsed time since last cache refresh

**Rationale**: User status and categories rarely change, fetching them on every refresh wastes API quota and risks rate limiting.

---

## [3.0.1] - 2026-01

### UI/UX Refinement & API Protection

**UI/UX Changes**:
- **REMOVED: Pull-to-Refresh gesture** from both index.html and seeder.html to prevent accidental API calls
- **REMOVED: 'R' key refresh shortcut** from seeder.html to prevent unintentional triggering
- Added tablet scrolling support for seeder table (769px-1200px breakpoint, min-width: 950px)

**Rationale**: Users frequently triggered accidental refreshes (pull-to-refresh on mobile, R key on desktop), causing M-Team API rate limit issues. Each manual refresh triggers 9-10 sequential API calls, which compounds quickly with accidental triggers.

**Code Reduction**: Removed 211 lines of PTR-related code (CSS, HTML, JavaScript)

---

## [3.0.0] - 2026-01

### Code Quality & Performance Release

**Security Fixes**:
- Fixed XSS vulnerability in seeder.html (missing `|e` escape filters on user profile data)
- Added HTTPS for PushPlus notifications
- Added strict `Literal` type validation for search mode parameter

**Reliability Improvements**:
- Added JSON parse error handling for all API responses to prevent crashes on malformed data
- Refactored rate limiting logic for better clarity and memory cleanup

**Accessibility**:
- Added comprehensive ARIA attributes for screen reader support
- `role="alert"` for toast notifications
- `role="tablist"` and `role="tab"` for mode navigation
- `role="dialog"` for mobile filter drawer
- `aria-label` for all icon-only buttons
- `aria-sort` for sortable table headers

**UI Improvements**:
- Replaced "Discount" column with "Category" column in Search Engine
- Display parent category names (Movie, TV Series, Music, etc.) with bilingual support
- Moved discount badges (Free, 2xFree, 50%) to expandable row details
- Added category mapping system (PARENT_CATEGORY_NAMES, CHILD_TO_PARENT)

**Bug Fixes**:
- Fixed undefined variables in `updateResetButtonState()` (index.html)
- Removed references to non-existent DOM elements (drawer dropdowns)
- Removed duplicate Enter key event listener causing double search execution
- Fixed rate limit store memory leak

---

## [2.8.1] - 2026-01

### UI/UX Unification & Polish

**Unified Design System**: Standardized "Nothing OS" aesthetic across Search Engine (`index.html`) and Free Hunter (`seeder.html`)
- Consistent typography (DotGothic16, Roboto Mono), monochrome palette, and brutalist layout
- Ported refined CSS variables and "Glitch" hover effects to all pages

**Navigation Upgrade**: Integrated `logo-switcher` component for seamless one-tap navigation between Search and Free Hunter

**Mobile Experience**:
- **Pill-based Drawer**: Replaced legacy dropdowns in Free Hunter with the modern pill interaction model
- **Pull to Refresh (PTR)**: Added native mobile refreshing gesture to both pages
- **Haptic Feedback**: Enabled 30ms vibration feedback for all touch interactions

**Dynamic Island Toasts**: Implemented top-center notification system with theme-adaptive high-contrast styling (Black/White)

**Stability**: Enhanced frontend initialization with robust error handling for critical UI components

---

## [2.8.0] - 2026-01

### Search First Restructure

**Project Restructure**: Search Engine is now the default landing page (`/`)
- Renamed `search.html` → `index.html` (main entry)
- Renamed `index.html` → `seeder.html` (secondary dashboard)
- Free Hunter now accessible at `/seeder` route

**Navigation Update**: Swapped logo positions
- Left logo: Search Engine (current page indicator)
- Right logo: Free Hunter (link to seeder)

**Mobile UX**: Fixed tag wrapping in expanded row details
- Changed from flex-wrap to horizontal scroll
- Hidden scrollbar for cleaner appearance
- Added padding to prevent last tag cutoff

---

## [2.7.0] - 2026-01

### Mobile Filter UX Redesign

**Mobile Filter Architecture**: Complete redesign of mobile filter experience with modern pill-based UI
- **Level 1 Navigation**: Mode tabs (综合, 电影, 影剧, 其他, 成人) moved outside drawer for quick access
- **Level 2 Navigation**: Dynamic sub-category pills that change based on selected mode
- **Level 3 Filters**: Drawer with pill buttons replacing traditional dropdowns

**Drawer Improvements**:
- Replaced all `<select>` dropdowns with touch-optimized pill buttons
- Pills for: Resolution (8K, 4K, 1080p, 720p, SD), Video Codec (H.264, H.265, AV1), Audio Codec (TrueHD, DTS-HD MA), Country (Top 8), Discount (FREE, 2xFREE)
- Sticky footer with side-by-side buttons (Reset 35% + Search 65%) for better thumb reach
- Single-select toggle logic (tap to select, tap again to deselect)

**Visual Feedback**:
- Red dot indicator on filter button (⚙️) when filters are active
- Haptic feedback (30ms vibration) on all pill interactions
- Pills support dynamic language switching (Chinese/English)

**Bug Fixes**:
- Fixed CSS responsive issue where mobile tabs appeared on desktop
- Removed drag-to-dismiss gesture (not useful in practice)
- Increased haptic feedback duration from 10ms to 30ms for better tactile response

**Architecture**:
- New state management for drawer pill selections (drawerResolution, drawerVideo, drawerAudio, drawerCountry, drawerDiscount)
- Filter options data structure (FILTER_OPTIONS) for consistent pill rendering
- Improved sync between mobile drawer pills and desktop filter selects

---

## [2.6.0] - 2026-01

### Search Filter Bug Fixes & Improvements

**Bug Fixes**: Fixed critical search filter bugs where selecting only Level 1 mode tabs returned no results
- Added fallback category arrays for all modes (normal, movie, tvshow, adult, other)
- Each mode now includes both parent and sub-category IDs for complete results

**Adult Content Filter**: Complete redesign with proper category groupings
- New pills: 有码 (Censored), 无码 (Uncensored), Gay, 写真 (IV/Gravure), 游戏 (H-Game), 动漫 (H-Anime), 漫画 (H-Comic)
- Expanded ADULT_CATEGORY_IDS from 5 to 13 sub-categories

**Others Mode**: Fixed incomplete results by including all sub-categories
- Music: Added sub-categories 434 (Lossless), 406 (MV)
- Anime: Added sub-category 405 (动画)
- Documentary: Added sub-category 404 (纪录)
- Game: Added sub-categories 423 (PC游戏), 448 (TV遊戲)
- Other: Added sub-categories 442 (有聲書), 451 (教育), 409 (Misc)

**Translation Improvements**: Removed bilingual labels (e.g., "综合 (All)" → "综合")
- All filter elements now respect language preference (Chinese/English only)
- Added missing translation keys for mode tabs and filter options
- Category pills dynamically update on language switch

**Architecture**: Enhanced pill selection logic to handle comma-separated category IDs
- Pills can now search multiple categories simultaneously (e.g., Music pill searches 110,434,406)

---

## [2.5.0] - 2026-01

### Search Filter Redesign

**Search Engine**: Redesigned filter section with 3-level hierarchical structure:
- Level 1: Mode Tabs (综合, 电影, 影剧/综艺, 其他, 成人)
- Level 2: Dynamic Category Pills based on selected mode (e.g., Movie → Remux, Blu-Ray, HD, DVD, SD)
- Level 3: Technical filters with conditional visibility per mode

**Backend**: Added `categories`, `countries`, `discount` parameters to search API

**UX**:
- Improved filter organization and discoverability
- Reset button now preserves mode selection while clearing categories and filters

---

## [2.4.1] - 2026-01

### Bug Fixes & UI Polish

**Bug Fix**: Fixed country field type mismatch causing empty country display

**UI**:
- Added Chinese translations for 120+ country names in Search Engine
- Improved IMDB/Douban link presentation with branded pill buttons (yellow/green hover)

---

## [2.4.0] - 2026-01

### Enhanced Search Quality Metadata

**Search Engine**: Completely redesigned torrent detail expansion with 8 new metadata fields:
- Resolution, Source, System Labels (badges for 中字/HDR/DoVi/etc)
- Video Codec, Audio Codec
- IMDB link (clickable), Douban link (clickable)
- Country (mapped from ID to readable name)

**Backend**:
- Added country list API integration with 165 country mappings
- Fixed M-Team API response code handling (supports "SUCCESS" string)

**UI**:
- New badge styling for system labels with high contrast
- External link styling with dotted underlines

---

## [2.3.1] - 2026-01

### qBittorrent Configuration Simplification

**Documentation**:
- Simplified qBittorrent URL configuration for Docker users
- Changed default URL from `localhost:8080` to `192.168.x.x:8080` placeholder
- Removed `host.docker.internal` references to simplify setup
- Added clear warning that `localhost` won't work in Docker environment

---

## [2.3.0] - 2026-01

### Documentation & Configuration Improvements

**Documentation**:
- Added qBittorrent environment variables to `docker-compose.yml`
- Added qBittorrent setup instructions to `README.md` (Chinese & English)
- Added Docker network configuration tips (localhost vs host.docker.internal vs host IP)

---

## [2.2.0] - 2026-01

### Major UI/UX Overhaul

**Nothing OS Design System**: Complete visual redesign with brutalist aesthetic
- Three-font hierarchy: DotGothic16 (headers), Roboto Mono (data), Inter (body)
- Dotted borders, zero border-radius, box shadows for depth
- Refined light/dark theme color palettes

**Search Engine Enhancements**:
- Added `sources` filter (Web-DL, Bluray, Remux, HDTV, DVD)
- Expandable row details showing quality metadata (resolution, codecs, source, team)
- Filter reset button with smart visibility
- Filter count badge

**Free Hunter Improvements**:
- Logo switcher for navigation between Free Hunter and Search Engine
- Industrial toggle switch for auto-delete feature
- Progress rings for download status
- Status dots with pulse animation for critical alerts

**UX Refinements**:
- Hover effects only on mouse devices (touch-optimized)
- Zebra striping removed for cleaner Nothing OS aesthetic
- Improved mobile responsiveness with card layouts
- Sticky navbar with blur backdrop

**Backend Optimizations**:
- qBittorrent session caching (30-minute TTL) to reduce login overhead
- Enhanced quality metadata extraction and display
- Improved auto-delete state tracking with detailed logging
