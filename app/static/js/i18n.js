/* ============================================================================
   MT-Engine - Internationalization (i18n)
   Translation system for Chinese and English
   ============================================================================ */

import { COUNTRY_TRANSLATIONS } from './config.js';
import { escapeHtml } from './utils.js';

// ============ Translations ============
export const TRANSLATIONS = {
    'zh': {
        appName: 'MT 引擎',
        pageTitle: {
            radar: '雷达',
            sonar: '声呐',
            pilot: '领航'
        },
        searchBtn: '搜索',
        resetFilters: '重置',
        resolution: '清晰度',
        videoFormat: '视频格式',
        audioFormat: '音频格式',
        source: '来源',
        contentType: '类型',
        sortBy: '排序',
        modeNormal: '综合',
        modeMovie: '电影',
        modeTvshow: '电视剧',
        modeOther: '其他',
        modeAdult: '成人',
        all: '全部',
        filterResolution: '清晰度',
        filterVideo: '视频编码',
        filterAudio: '音频编码',
        filterCountry: '国家/地区',
        filterDiscount: '优惠',
        countryChina: '中国大陆',
        countryHK: '中国香港',
        countryTW: '中国台湾',
        countryUS: '美国',
        countryJP: '日本',
        countryKR: '韩国',
        discountFree: '免费',
        discount2xFree: '2x免费',
        discount2xUp: '2x上传',
        discountHalf: '50%',
        sortDateDesc: '上传时间 ↓',
        sortDateAsc: '上传时间 ↑',
        sortSizeDesc: '大小 ↓',
        sortSizeAsc: '大小 ↑',
        sortSeedersDesc: '做种数 ↓',
        sortSeedersAsc: '做种数 ↑',
        sortLeechersDesc: '下载数 ↓',
        sortLeechersAsc: '下载数 ↑',
        showing: '显示',
        results: '个结果',
        colName: '名称',
        colSize: '大小',
        colPeers: '做种/下载',
        colCategory: '分类',
        colDate: '上传时间',
        colActions: '操作',
        filterTitle: '筛选条件',
        initialTitle: '开始搜索',
        initialText: '输入关键词并点击搜索按钮',
        emptyState: '没有找到匹配的结果',
        loadingMore: '加载更多...',
        loadMore: '加载更多',
        downloadSuccess: '已添加到下载队列',
        downloadFailed: '下载失败',
        searchFailed: '搜索失败',
        errors: {
            qb_not_configured: 'qBittorrent 未配置',
            download_link_failed: '获取下载链接失败',
            qb_connection_failed: 'qBittorrent 连接失败',
            add_torrent_failed: '添加种子失败'
        },
        statRatio: '分享率',
        statUpload: '上传',
        statDownload: '下载',
        rivalRatio: '对手分享率',
        metaQuality: '质量',
        metaTeam: '制作组',
        metaCompleted: '完成',
        metaTags: '标签',
        metaTimes: '次',
        labels: '标签',
        douban: '豆瓣',
        country: '国家和地区',
        // Table/Torrent actions
        expand_details: '展开详情',
        collapse_details: '收起详情',
        downloaded: '已下载',
        download: '下载',
        files: '文件',
        already_downloaded: '已下载',
        downloading: '下载中...',
        // Search
        enter_keyword: '请输入搜索关键词',
        search_results: '搜索结果',
        load_more_failed: '加载更多失败',
        // Seeder page
        filtersActive: '筛选已激活',
        autoDeleteEnabled: '自动删除已启用',
        autoDeleteDisabled: '自动删除已禁用',
        autoDeleteError: '切换失败',
        view_details: '查看详情',
        refreshError: '刷新失败',
        refreshSuccess: '刷新成功',
        statusSeeding: '做种中',
        statusLeeching: '下载中',
        statusNotDownloaded: '未下载',
        today: '今天',
        yesterday: '昨天',
        daysAgo: '天前',
        weeksAgo: '周前',
        monthsAgo: '月前',
        yearsAgo: '年前',
        // Seeder page - missing keys
        colDiscount: '优惠',
        filterAll: '全部',
        filterSize: '大小',
        filterSeeders: '做种',
        filterRemaining: '剩余时间',
        filterMode: '频道',
        filterNormal: '综合',
        filterAdult: '成人',
        filterLeeching: '下载中',
        filterSeeding: '做种中',
        autoDelete: '自动删除',
        autoDeleteDesc: '免费变节时删除未完成下载',
        refresh: '刷新数据',
        colRemaining: '剩余时间',
        colStatus: '状态',
        autoRefresh: '自动刷新间隔',
        minutes: '分钟',
        lastRefresh: '上次刷新',
        ratioDiff: '差距',
        // Time ranges
        timeRangeCritical: '< 1小时',
        timeRangeDanger: '1-2小时',
        timeRangeWarning: '2-6小时',
        timeRangeSafe: '6-24小时',
        timeRangePlenty: '> 24小时',
        // Quality labels
        qualityVideo: '视频',
        qualityAudio: '音频',
        qualityCodec: '编码',
        qualityResolution: '分辨率',
        qualitySource: '来源',
        qualityCountry: '国家',
        // Automation page
        autoDashboard: '仪表板',
        autoRules: '规则',
        autoActiveTasks: '活动任务',
        autoPendingDownloads: '待下载',
        autoDownloadStatus: '下载状态',
        autoCleanupStatus: '清理状态',
        autoEnableDownload: '启用下载',
        autoEnableCleanup: '启用清理',
        autoDryRun: '🔍 模拟运行',
        autoRunDownload: '⬇️ 执行下载',
        autoRunCleanup: '🗑️ 执行清理',
        autoRefreshStats: '🔄 刷新状态',
        autoActions: '操作',
        autoDryRunResults: '模拟结果',
        autoDownloadPolicy: '下载策略',
        autoFilteringRules: '过滤规则',
        autoCleanupPolicy: '清理策略',
        autoMaxActiveTasks: '最大活动任务数',
        autoInterval: '间隔 (秒)',
        autoSavePath: '保存路径',
        autoDiskThreshold: '磁盘阈值 (%)',
        autoDiskThresholdHint: '磁盘使用超过此百分比时停止下载',
        autoMinSize: '最小大小 (GB)',
        autoMaxSize: '最大大小 (GB)',
        autoIncludeKeywords: '包含关键词 (逗号分隔)',
        autoIncludeKeywordsPlaceholder: '例如: movie, series…',
        autoExcludeKeywords: '排除关键词 (逗号分隔)',
        autoExcludeKeywordsPlaceholder: '例如: cam, ts…',
        autoScoringWeights: '评分权重',
        autoWeightsHint: '调整权重以优先考虑不同因素 (-10 到 10)',
        autoWeightSize: '大小权重 (越小 = 越高分)',
        autoWeightFreeTime: '免费时间权重 (剩余越多 = 越高分)',
        autoWeightAge: '年龄权重 (越新 = 越高分)',
        autoWeightSeeders: '做种数权重 (越少 = 越高分)',
        autoDeleteOnExpired: '优惠过期时删除',
        autoMinShareRatio: '最小分享率',
        autoMinSeedTime: '最小做种时间 (小时)',
        autoMinSeedTimeHint: 'H&R 保护: 在此时间之前不会删除',
        autoMaxDownloadTime: '最大下载时间 (小时, 0=禁用)',
        autoMaxDownloadTimeHint: '僵尸任务检测: 下载超过此时间则删除',
        autoMaxSeeders: '最大做种数 (0=不限制)',
        autoMaxSeedersHint: '只下载做种人数低于此值的种子',
        autoMinLeechers: '最小下载数 (0=不限制)',
        autoMinLeechersHint: '只下载当前下载人数高于此值的种子',
        autoMinCurrentUsers: '最小当前用户数 (0=禁用)',
        autoMinCurrentUsersHint: '做种+下载人数低于此值时删除',
        autoMinUploadSpeed: '最小上传速度 (KB/s, 0=禁用)',
        autoMinUploadSpeedHint: '平均上传速度低于此值时删除',
        autoUploadSpeedCheckMinutes: '速度检查窗口 (分钟)',
        autoUploadSpeedCheckHint: '计算平均上传速度的时间窗口',
        autoSaveConfig: '💾 保存配置',
        autoCancel: '取消',
        autoEnabled: '✅ 已启用',
        autoDisabled: '⏸️ 已禁用',
        // Automation toast messages
        autoConfigSaved: '配置已保存',
        autoConfigSaveFailed: '保存配置失败',
        autoConfigLoadFailed: '加载配置失败',
        autoDryRunCompleted: '模拟运行完成',
        autoDryRunFailed: '模拟运行失败',
        autoDownloadTriggered: '下载周期已完成',
        autoDownloadTriggerFailed: '触发下载失败',
        autoCleanupTriggered: '清理周期已完成',
        autoCleanupTriggerFailed: '触发清理失败',
        autoChangesCancelled: '已取消更改',
        autoRunning: '运行中…',
        // Automation dry run results
        autoTopCandidates: '前',
        autoOfCandidates: '个候选，共',
        autoNoCandidates: '无下载候选',
        autoCleanupCount: '个任务将被清理',
        autoNoCleanup: '无清理候选',
        autoSize: '大小',
        autoScore: '评分',
        autoRatio: '分享率'
    },
    'en': {
        appName: 'MT-Engine',
        pageTitle: {
            radar: 'RADAR',
            sonar: 'SONAR',
            pilot: 'PILOT'
        },
        searchBtn: 'Search',
        resetFilters: 'Reset',
        resolution: 'Resolution',
        videoFormat: 'Video',
        audioFormat: 'Audio',
        source: 'Source',
        contentType: 'Type',
        sortBy: 'Sort',
        modeNormal: 'All',
        modeMovie: 'Movie',
        modeTvshow: 'TV Show',
        modeOther: 'Others',
        modeAdult: 'Adult',
        all: 'All',
        filterResolution: 'Resolution',
        filterVideo: 'Video Codec',
        filterAudio: 'Audio Codec',
        filterCountry: 'Country',
        filterDiscount: 'Discount',
        countryChina: 'China',
        countryHK: 'Hong Kong',
        countryTW: 'Taiwan',
        countryUS: 'USA',
        countryJP: 'Japan',
        countryKR: 'Korea',
        discountFree: 'Free',
        discount2xFree: '2x Free',
        discount2xUp: '2x Upload',
        discountHalf: '50% Off',
        sortDateDesc: 'Date ↓',
        sortDateAsc: 'Date ↑',
        sortSizeDesc: 'Size ↓',
        sortSizeAsc: 'Size ↑',
        sortSeedersDesc: 'Seeders ↓',
        sortSeedersAsc: 'Seeders ↑',
        sortLeechersDesc: 'Leechers ↓',
        sortLeechersAsc: 'Leechers ↑',
        showing: 'Showing',
        results: 'results',
        colName: 'Name',
        colSize: 'Size',
        colPeers: 'S/L',
        colCategory: 'Category',
        colDate: 'Date',
        colActions: 'Actions',
        filterTitle: 'Filters',
        initialTitle: 'Start Searching',
        initialText: 'Enter keywords and click search',
        emptyState: 'No results found',
        loadingMore: 'Loading more...',
        loadMore: 'Load More',
        downloadSuccess: 'Added to download queue',
        downloadFailed: 'Download failed',
        searchFailed: 'Search failed',
        errors: {
            qb_not_configured: 'qBittorrent not configured',
            download_link_failed: 'Failed to get download link',
            qb_connection_failed: 'qBittorrent connection failed',
            add_torrent_failed: 'Failed to add torrent'
        },
        statRatio: 'Ratio',
        statUpload: 'Upload',
        statDownload: 'Download',
        rivalRatio: 'Rival Ratio',
        metaQuality: 'Quality',
        metaTeam: 'Team',
        metaCompleted: 'Completed',
        metaTags: 'Tags',
        metaTimes: 'times',
        labels: 'Labels',
        douban: 'Douban',
        country: 'Country & Region',
        // Table/Torrent actions
        expand_details: 'Expand Details',
        collapse_details: 'Collapse Details',
        downloaded: 'Downloaded',
        download: 'Download',
        files: 'Files',
        already_downloaded: 'Downloaded',
        downloading: 'Downloading...',
        // Search
        enter_keyword: 'Enter keyword',
        search_results: 'Search Results',
        load_more_failed: 'Failed to load more',
        // Seeder page
        filtersActive: 'Filters Active',
        autoDeleteEnabled: 'Auto-delete enabled',
        autoDeleteDisabled: 'Auto-delete disabled',
        autoDeleteError: 'Toggle failed',
        view_details: 'View details',
        refreshError: 'Refresh failed',
        refreshSuccess: 'Refresh successful',
        statusSeeding: 'Seeding',
        statusLeeching: 'DL',
        statusNotDownloaded: 'None',
        today: 'Today',
        yesterday: 'Yesterday',
        daysAgo: 'days ago',
        weeksAgo: 'weeks ago',
        monthsAgo: 'months ago',
        yearsAgo: 'years ago',
        // Seeder page - missing keys
        colDiscount: 'Discount',
        filterAll: 'All',
        filterSize: 'Size',
        filterSeeders: 'Seeders',
        filterRemaining: 'Remaining',
        filterMode: 'Channel',
        filterNormal: 'Normal',
        filterAdult: 'Adult',
        filterLeeching: 'Downloading',
        filterSeeding: 'Seeding',
        autoDelete: 'Auto Delete',
        autoDeleteDesc: 'Delete incomplete when free ends',
        refresh: 'Refresh',
        colRemaining: 'Remaining',
        colStatus: 'Status',
        autoRefresh: 'Auto refresh interval',
        minutes: 'min',
        lastRefresh: 'Last refresh',
        ratioDiff: 'Diff',
        // Time ranges
        timeRangeCritical: '< 1h',
        timeRangeDanger: '1-2h',
        timeRangeWarning: '2-6h',
        timeRangeSafe: '6-24h',
        timeRangePlenty: '> 24h',
        // Quality labels
        qualityVideo: 'Video',
        qualityAudio: 'Audio',
        qualityCodec: 'Codec',
        qualityResolution: 'Resolution',
        qualitySource: 'Source',
        qualityCountry: 'Country',
        // Automation page
        autoDashboard: 'Dashboard',
        autoRules: 'Rules',
        autoActiveTasks: 'Active Tasks',
        autoPendingDownloads: 'Pending Downloads',
        autoDownloadStatus: 'Download Status',
        autoCleanupStatus: 'Cleanup Status',
        autoEnableDownload: 'Enable Download',
        autoEnableCleanup: 'Enable Cleanup',
        autoDryRun: '🔍 Dry Run',
        autoRunDownload: '⬇️ Run Download',
        autoRunCleanup: '🗑️ Run Cleanup',
        autoRefreshStats: '🔄 Refresh Stats',
        autoActions: 'Actions',
        autoDryRunResults: 'Dry Run Results',
        autoDownloadPolicy: 'Download Policy',
        autoFilteringRules: 'Filtering Rules',
        autoCleanupPolicy: 'Cleanup Policy',
        autoMaxActiveTasks: 'Max Active Tasks',
        autoInterval: 'Interval (seconds)',
        autoSavePath: 'Save Path',
        autoDiskThreshold: 'Disk Usage Threshold (%)',
        autoDiskThresholdHint: 'Stop downloads when disk usage exceeds this percentage',
        autoMinSize: 'Min Size (GB)',
        autoMaxSize: 'Max Size (GB)',
        autoIncludeKeywords: 'Include Keywords (comma-separated)',
        autoIncludeKeywordsPlaceholder: 'e.g., movie, series…',
        autoExcludeKeywords: 'Exclude Keywords (comma-separated)',
        autoExcludeKeywordsPlaceholder: 'e.g., cam, ts…',
        autoScoringWeights: 'Scoring Weights',
        autoWeightsHint: 'Adjust weights to prioritize different factors (-10 to 10)',
        autoWeightSize: 'Size Weight (smaller = higher score)',
        autoWeightFreeTime: 'Free Time Weight (more remaining = higher)',
        autoWeightAge: 'Age Weight (newer = higher)',
        autoWeightSeeders: 'Seeders Weight (fewer = higher)',
        autoDeleteOnExpired: 'Delete when discount expires',
        autoMinShareRatio: 'Minimum Share Ratio',
        autoMinSeedTime: 'Minimum Seed Time (hours)',
        autoMinSeedTimeHint: 'H&R protection: won\'t delete before this time',
        autoMaxDownloadTime: 'Max Download Time (hours, 0=disabled)',
        autoMaxDownloadTimeHint: 'Zombie task detection: delete if downloading exceeds this time',
        autoMaxSeeders: 'Max Seeders (0=no limit)',
        autoMaxSeedersHint: 'Only download torrents with seeders below this count',
        autoMinLeechers: 'Min Leechers (0=no limit)',
        autoMinLeechersHint: 'Only download torrents with leechers above this count',
        autoMinCurrentUsers: 'Min Current Users (0=disabled)',
        autoMinCurrentUsersHint: 'Delete if seeders + leechers below this value',
        autoMinUploadSpeed: 'Min Upload Speed (KB/s, 0=disabled)',
        autoMinUploadSpeedHint: 'Delete if average upload speed below this value',
        autoUploadSpeedCheckMinutes: 'Upload Speed Check Window (min)',
        autoUploadSpeedCheckHint: 'Time window for calculating average upload speed',
        autoSaveConfig: '💾 Save Configuration',
        autoCancel: 'Cancel',
        autoEnabled: '✅ Enabled',
        autoDisabled: '⏸️ Disabled',
        // Automation toast messages
        autoConfigSaved: 'Configuration saved',
        autoConfigSaveFailed: 'Failed to save configuration',
        autoConfigLoadFailed: 'Failed to load configuration',
        autoDryRunCompleted: 'Dry run completed',
        autoDryRunFailed: 'Dry run failed',
        autoDownloadTriggered: 'Download cycle completed',
        autoDownloadTriggerFailed: 'Failed to trigger download',
        autoCleanupTriggered: 'Cleanup cycle completed',
        autoCleanupTriggerFailed: 'Failed to trigger cleanup',
        autoChangesCancelled: 'Changes cancelled',
        autoRunning: 'Running…',
        // Automation dry run results
        autoTopCandidates: 'Top',
        autoOfCandidates: 'of',
        autoNoCandidates: 'No download candidates',
        autoCleanupCount: 'tasks will be cleaned',
        autoNoCleanup: 'No cleanup candidates',
        autoSize: 'Size',
        autoScore: 'Score',
        autoRatio: 'Ratio'
    }
};

// ============ Current Language State ============
let _currentLang;
try {
    _currentLang = localStorage.getItem('language') || 'zh';
} catch (e) {
    console.warn('localStorage not available:', e);
    _currentLang = 'zh';
}

// Export getter function for reactive access
export function getCurrentLang() {
    return _currentLang;
}

// Keep named export for backward compatibility but update via setter
export let currentLang = _currentLang;

// ============ Current Page State ============
let _currentPage = null;

// ============ Document Title Management ============
export function setCurrentPage(pageKey) {
    _currentPage = pageKey;
    updateDocumentTitle();
}

export function updateDocumentTitle() {
    if (!_currentPage) return;
    const appName = t('appName');
    const pageTitle = t(`pageTitle.${_currentPage}`);
    document.title = `${appName} · ${pageTitle}`;
}

// ============ Translation Function ============
export function t(key) {
    const keys = key.split('.');
    let value = TRANSLATIONS[_currentLang];

    for (const k of keys) {
        value = value?.[k];
        if (value === undefined) break;
    }

    return value || key;
}

// ============ Translate Country ============
export function translateCountry(countryStr) {
    if (!countryStr) return '-';
    if (_currentLang !== 'zh') return escapeHtml(countryStr);

    // Handle multiple countries (comma-separated)
    const countries = countryStr.split(',').map(c => c.trim());
    const translated = countries.map(c => COUNTRY_TRANSLATIONS[c] || c);
    return escapeHtml(translated.join(', '));
}

// ============ Update Page Language ============
export function updatePageLanguage() {
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = t(key);
    });

    // Update placeholders
    document.querySelectorAll('[data-placeholder-zh]').forEach(element => {
        const placeholder = _currentLang === 'zh'
            ? element.getAttribute('data-placeholder-zh')
            : element.getAttribute('data-placeholder-en');
        if (placeholder) {
            element.placeholder = placeholder;
        }
    });

    // Update mobile pills with language-specific text
    document.querySelectorAll('[data-i18n-zh]').forEach(element => {
        const text = _currentLang === 'zh'
            ? element.getAttribute('data-i18n-zh')
            : element.getAttribute('data-i18n-en');
        if (text) {
            element.textContent = text;
        }
    });

    // Update document title
    updateDocumentTitle();
}

// ============ Set Language ============
export function setLanguage(lang) {
    if (lang !== 'zh' && lang !== 'en') {
        console.warn(`Invalid language: ${lang}`);
        return;
    }

    _currentLang = lang;
    currentLang = lang;  // Update exported binding
    try {
        localStorage.setItem('language', lang);
    } catch (e) {
        console.warn('localStorage not available:', e);
    }
    updatePageLanguage();
}

// ============ Initialize i18n ============
export function initI18n() {
    // Set initial language
    let savedLang;
    try {
        savedLang = localStorage.getItem('language') || 'zh';
    } catch (e) {
        console.warn('localStorage not available:', e);
        savedLang = 'zh';
    }
    setLanguage(savedLang);
}
