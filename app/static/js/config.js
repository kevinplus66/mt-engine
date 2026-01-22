/* ============================================================================
   MT-Engine - Configuration & Constants
   API settings, category mappings, filter configurations
   ============================================================================ */

// ============ API Configuration ============
export const CONFIG = {
    API_BASE: '/api',
    HAPTIC_DURATION: 30,
    TOAST_DURATION: 3000,
    SCROLL_THRESHOLD: 300,
    ITEMS_PER_PAGE: 50
};

// ============ Parent Category Names ============
export const PARENT_CATEGORY_NAMES = {
    // Top-level categories
    100: { zh: '电影', en: 'Movie' },
    105: { zh: '影剧/综艺', en: 'TV Series' },
    110: { zh: '音乐', en: 'Music' },
    444: { zh: '纪录', en: 'Documentary' },
    447: { zh: '游戏', en: 'Game' },
    449: { zh: '动漫', en: 'Anime' },
    450: { zh: '其他', en: 'Other' },
    // Adult categories
    115: { zh: '有码', en: 'Censored' },
    120: { zh: '无码', en: 'Uncensored' },
    445: { zh: '写真', en: 'IV' },
    446: { zh: 'H-ACG', en: 'H-ACG' }
};

// ============ Child to Parent Category Mapping ============
export const CHILD_TO_PARENT = {
    // Movie sub-categories -> 100
    401: 100, 419: 100, 420: 100, 421: 100, 439: 100,
    // TV Show sub-categories -> 105
    402: 105, 403: 105, 435: 105, 438: 105,
    // Music sub-categories -> 110
    434: 110, 406: 110,
    // Documentary sub-category -> 444
    404: 444,
    // Anime sub-category -> 449
    405: 449,
    // Game sub-categories -> 447
    423: 447, 448: 447,
    // Other sub-categories -> 450
    427: 450, 407: 450, 422: 450, 442: 450, 451: 450, 409: 450,
    // Adult sub-categories
    410: 115, 424: 115, 437: 115, 431: 115,  // Censored
    429: 120, 430: 120, 426: 120, 432: 120, 436: 120, 440: 120,  // Uncensored
    425: 445, 433: 445,  // IV
    411: 446, 412: 446, 413: 446  // H-ACG
};

// ============ Country Translations (English to Chinese) ============
export const COUNTRY_TRANSLATIONS = {
    // Asia
    'China': '中国', 'Mainland China': '中国大陆', 'Hong Kong': '香港', 'Taiwan': '台湾',
    'Japan': '日本', 'South Korea': '韩国', 'Korea': '韩国', 'North Korea': '朝鲜',
    'Thailand': '泰国', 'Vietnam': '越南', 'Singapore': '新加坡', 'Malaysia': '马来西亚',
    'Indonesia': '印度尼西亚', 'Philippines': '菲律宾', 'India': '印度', 'Pakistan': '巴基斯坦',
    'Bangladesh': '孟加拉国', 'Sri Lanka': '斯里兰卡', 'Nepal': '尼泊尔', 'Myanmar': '缅甸',
    'Cambodia': '柬埔寨', 'Laos': '老挝', 'Mongolia': '蒙古', 'Kazakhstan': '哈萨克斯坦',
    'Uzbekistan': '乌兹别克斯坦', 'Turkmenistan': '土库曼斯坦', 'Kyrgyzstan': '吉尔吉斯斯坦',
    'Tajikistan': '塔吉克斯坦', 'Afghanistan': '阿富汗', 'Iran': '伊朗', 'Iraq': '伊拉克',
    'Saudi Arabia': '沙特阿拉伯', 'United Arab Emirates': '阿联酋', 'UAE': '阿联酋',
    'Israel': '以色列', 'Turkey': '土耳其', 'Lebanon': '黎巴嫩', 'Jordan': '约旦',
    'Kuwait': '科威特', 'Qatar': '卡塔尔', 'Bahrain': '巴林', 'Oman': '阿曼', 'Yemen': '也门',
    'Syria': '叙利亚', 'Palestine': '巴勒斯坦',
    // Europe
    'United Kingdom': '英国', 'UK': '英国', 'England': '英国', 'France': '法国',
    'Germany': '德国', 'Italy': '意大利', 'Spain': '西班牙', 'Portugal': '葡萄牙',
    'Netherlands': '荷兰', 'Belgium': '比利时', 'Switzerland': '瑞士', 'Austria': '奥地利',
    'Sweden': '瑞典', 'Norway': '挪威', 'Denmark': '丹麦', 'Finland': '芬兰',
    'Iceland': '冰岛', 'Ireland': '爱尔兰', 'Poland': '波兰', 'Czech Republic': '捷克',
    'Czechia': '捷克', 'Hungary': '匈牙利', 'Romania': '罗马尼亚', 'Bulgaria': '保加利亚',
    'Greece': '希腊', 'Croatia': '克罗地亚', 'Serbia': '塞尔维亚', 'Slovenia': '斯洛文尼亚',
    'Slovakia': '斯洛伐克', 'Ukraine': '乌克兰', 'Russia': '俄罗斯', 'Belarus': '白俄罗斯',
    'Lithuania': '立陶宛', 'Latvia': '拉脱维亚', 'Estonia': '爱沙尼亚', 'Moldova': '摩尔多瓦',
    'Albania': '阿尔巴尼亚', 'North Macedonia': '北马其顿', 'Montenegro': '黑山',
    'Bosnia and Herzegovina': '波黑', 'Kosovo': '科索沃', 'Luxembourg': '卢森堡',
    'Malta': '马耳他', 'Cyprus': '塞浦路斯', 'Monaco': '摩纳哥', 'Liechtenstein': '列支敦士登',
    'Andorra': '安道尔', 'San Marino': '圣马力诺', 'Vatican': '梵蒂冈',
    // Americas
    'United States': '美国', 'United States of America': '美国', 'USA': '美国', 'US': '美国', 'America': '美国',
    'Canada': '加拿大', 'Mexico': '墨西哥', 'Brazil': '巴西', 'Argentina': '阿根廷',
    'Chile': '智利', 'Colombia': '哥伦比亚', 'Peru': '秘鲁', 'Venezuela': '委内瑞拉',
    'Ecuador': '厄瓜多尔', 'Bolivia': '玻利维亚', 'Paraguay': '巴拉圭', 'Uruguay': '乌拉圭',
    'Cuba': '古巴', 'Dominican Republic': '多米尼加', 'Puerto Rico': '波多黎各',
    'Jamaica': '牙买加', 'Haiti': '海地', 'Costa Rica': '哥斯达黎加', 'Panama': '巴拿马',
    'Guatemala': '危地马拉', 'Honduras': '洪都拉斯', 'El Salvador': '萨尔瓦多',
    'Nicaragua': '尼加拉瓜', 'Bahamas': '巴哈马', 'Trinidad and Tobago': '特立尼达和多巴哥',
    // Oceania
    'Australia': '澳大利亚', 'New Zealand': '新西兰', 'Fiji': '斐济',
    'Papua New Guinea': '巴布亚新几内亚', 'Samoa': '萨摩亚', 'Tonga': '汤加',
    // Africa
    'South Africa': '南非', 'Egypt': '埃及', 'Morocco': '摩洛哥', 'Algeria': '阿尔及利亚',
    'Tunisia': '突尼斯', 'Libya': '利比亚', 'Sudan': '苏丹', 'Ethiopia': '埃塞俄比亚',
    'Kenya': '肯尼亚', 'Nigeria': '尼日利亚', 'Ghana': '加纳', 'Tanzania': '坦桑尼亚',
    'Uganda': '乌干达', 'Zimbabwe': '津巴布韦', 'Zambia': '赞比亚', 'Botswana': '博茨瓦纳',
    'Namibia': '纳米比亚', 'Mozambique': '莫桑比克', 'Angola': '安哥拉', 'Senegal': '塞内加尔',
    'Ivory Coast': '科特迪瓦', 'Cameroon': '喀麦隆', 'Congo': '刚果',
    'Democratic Republic of the Congo': '刚果民主共和国', 'Rwanda': '卢旺达',
    // Special
    'International': '国际', 'Unknown': '未知', 'Other': '其他', 'Multiple': '多国'
};

// ============ Category Map (Mode -> Pills) ============
export const CATEGORY_MAP = {
    'movie': [
        { id: 439, name_zh: 'Remux', name_en: 'Remux' },
        { id: 421, name_zh: 'Blu-Ray', name_en: 'Blu-Ray' },
        { id: 419, name_zh: 'HD (Web/Rip)', name_en: 'HD (Web/Rip)' },
        { id: 420, name_zh: 'DVD', name_en: 'DVD' },
        { id: 401, name_zh: 'SD', name_en: 'SD' }
    ],
    'tvshow': [
        { id: 438, name_zh: 'Blu-Ray', name_en: 'Blu-Ray' },
        { id: 402, name_zh: 'HD (Web/Rip)', name_en: 'HD (Web/Rip)' },
        { id: 435, name_zh: 'DVD', name_en: 'DVD' },
        { id: 403, name_zh: 'SD', name_en: 'SD' }
    ],
    'other': [
        { id: '449,405', name_zh: '动漫', name_en: 'Anime' },
        { id: '444,404', name_zh: '纪录片', name_en: 'Documentary' },
        { id: '110,434,406', name_zh: '音乐', name_en: 'Music' },
        { id: '447,423,448', name_zh: '游戏', name_en: 'Game' },
        { id: '422', name_zh: '软件', name_en: 'Software' },
        { id: '427', name_zh: '电子书', name_en: 'E-Book' },
        { id: '407', name_zh: '运动', name_en: 'Sports' },
        { id: '442', name_zh: '有声书', name_en: 'Audiobook' },
        { id: '451', name_zh: '教育', name_en: 'Education' },
        { id: '409', name_zh: '其他', name_en: 'Misc' }
    ],
    'adult': [
        { id: '410,424,437,431', name_zh: '有码', name_en: 'Censored' },
        { id: '429,430,426,432,436', name_zh: '无码', name_en: 'Uncensored' },
        { id: '440', name_zh: 'Gay', name_en: 'Gay' },
        { id: '425,433', name_zh: '写真', name_en: 'IV/Gravure' },
        { id: '411', name_zh: '游戏', name_en: 'H-Game' },
        { id: '412', name_zh: '动漫', name_en: 'H-Anime' },
        { id: '413', name_zh: '漫画', name_en: 'H-Comic' }
    ],
    'normal': []
};

// ============ Filter Visibility Configuration ============
export const FILTER_CONFIG = {
    'normal': ['resolution', 'video', 'audio', 'country', 'discount'],
    'movie': ['resolution', 'video', 'audio', 'country', 'discount'],
    'tvshow': ['resolution', 'video', 'audio', 'country', 'discount'],
    'other': ['country', 'discount'],
    'adult': ['resolution', 'discount']
};

// ============ Category ID Arrays (Fallbacks) ============
export const MOVIE_CATEGORY_IDS = [439, 421, 419, 420, 401];
export const TVSHOW_CATEGORY_IDS = [438, 402, 435, 403];
export const OTHER_CATEGORY_IDS = [
    110, 434, 406,  // Music
    449, 405,       // Anime
    444, 404,       // Documentary
    447, 423, 448,  // Game
    422, 427, 407, 442, 451, 409  // Other
];
export const ADULT_CATEGORY_IDS = [
    410, 424, 437, 431,  // Censored
    429, 430, 426, 432, 436, 440,  // Uncensored + Gay
    425, 433,  // IV
    411, 412, 413  // H-ACG
];
export const NORMAL_CATEGORY_IDS = [
    ...MOVIE_CATEGORY_IDS,
    ...TVSHOW_CATEGORY_IDS,
    ...OTHER_CATEGORY_IDS
];

// ============ Filter Options ============
export const FILTER_OPTIONS = {
    countries: [
        { id: 'CN', name_zh: '中国大陆', name_en: 'China' },
        { id: 'HK', name_zh: '香港', name_en: 'Hong Kong' },
        { id: 'TW', name_zh: '台湾', name_en: 'Taiwan' },
        { id: 'US', name_zh: '美国', name_en: 'USA' },
        { id: 'JP', name_zh: '日本', name_en: 'Japan' },
        { id: 'KR', name_zh: '韩国', name_en: 'Korea' },
        { id: 'UK', name_zh: '英国', name_en: 'UK' },
        { id: 'FR', name_zh: '法国', name_en: 'France' }
    ],
    discounts: [
        { id: 'FREE', name_zh: '免费', name_en: 'Free' },
        { id: '_2X_FREE', name_zh: '2x免费', name_en: '2x Free' },
        { id: '_2X', name_zh: '2x上传', name_en: '2x Upload' },
        { id: 'PERCENT_50', name_zh: '50%', name_en: '50% Off' }
    ]
};
