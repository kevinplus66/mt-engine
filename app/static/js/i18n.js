/* ============================================================================
   MT-Engine - Internationalization (i18n)
   Translation system for Chinese and English
   ============================================================================ */

import { COUNTRY_TRANSLATIONS } from './config.js';
import { escapeHtml } from './utils.js';

// ============ Translations ============
export const TRANSLATIONS = {
    'zh': {
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
        today: '今天',
        yesterday: '昨天',
        daysAgo: '天前',
        weeksAgo: '周前',
        monthsAgo: '月前',
        yearsAgo: '年前'
    },
    'en': {
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
        today: 'Today',
        yesterday: 'Yesterday',
        daysAgo: 'days ago',
        weeksAgo: 'weeks ago',
        monthsAgo: 'months ago',
        yearsAgo: 'years ago'
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
