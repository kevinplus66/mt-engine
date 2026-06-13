"""
业务常量定义
"""

# ============ qBittorrent 标签常量 ============
QB_TAG_RADAR = "雷达下载"       # RADAR 下载使用的标签
QB_TAG_SONAR = "声呐做种"       # SONAR 免费种子使用的标签


# ============ RADAR 分类常量 ============
# 与 frontend/lib/constants.ts 的 RADAR 分类保持一致；Home 媒体墙也复用这套口径。
RADAR_MOVIE_CATEGORY_IDS = [439, 421, 419, 420, 401]
RADAR_TVSHOW_CATEGORY_IDS = [438, 402, 435, 403]


# ============ 雷达筛选选项 ============
# 使用 M-Team API 实际返回的 ID（已验证）
FILTER_OPTIONS = {
    "standards": [
        {"id": 7, "name": "8K"},
        {"id": 6, "name": "4K"},
        {"id": 1, "name": "1080p"},
        {"id": 2, "name": "1080i"},
        {"id": 3, "name": "720p"},
        {"id": 5, "name": "SD"}
    ],
    "videoCodecs": [
        {"id": 1, "name": "H.264/AVC"},
        {"id": 16, "name": "H.265/HEVC"},
        {"id": 19, "name": "AV1"},
        {"id": 2, "name": "VC-1"},
        {"id": 4, "name": "MPEG-2"}
    ],
    "audioCodecs": [
        {"id": 10, "name": "TrueHD Atmos"},
        {"id": 11, "name": "DTS-HD MA"},
        {"id": 9, "name": "TrueHD"},
        {"id": 3, "name": "DTS"},
        {"id": 1, "name": "FLAC"}
    ],
    "sources": [
        {"id": 8, "name": "Web-DL"},
        {"id": 1, "name": "Bluray"},
        {"id": 4, "name": "Remux"},
        {"id": 5, "name": "HDTV"},
        {"id": 3, "name": "DVD"}
    ],
    "modes": [
        {"id": "normal", "name_zh": "综合", "name_en": "All"},
        {"id": "movie", "name_zh": "电影", "name_en": "Movie"},
        {"id": "tvshow", "name_zh": "电视剧", "name_en": "TV Show"},
        {"id": "adult", "name_zh": "成人", "name_en": "Adult"}
    ]
}


# ============ 质量标签映射 ============
# 用于将 ID 转换为显示名称
QUALITY_LABELS = {
    "standards": {7: "8K", 6: "4K", 1: "1080p", 2: "1080i", 3: "720p", 5: "SD"},
    "videoCodecs": {1: "H.264", 16: "H.265", 19: "AV1", 2: "VC-1", 4: "MPEG-2"},
    "audioCodecs": {10: "Atmos", 11: "DTS-HD MA", 9: "TrueHD", 3: "DTS", 1: "FLAC"},
    "sources": {8: "WEB-DL", 1: "Bluray", 4: "Remux", 5: "HDTV", 3: "DVD"}
}


# ============ 国家名称中英对照 ============
# 将 M-Team API 返回的英文国家名翻译为中文
COUNTRY_NAME_ZH = {
    # 主要国家/地区
    "中国": "中国",
    "香港, 中國": "中国香港",
    "澳門, 中國": "中国澳门",
    "台灣, 中國": "中国台湾",
    "United States of America": "美国",
    "United Kingdom": "英国",
    "Japan": "日本",
    "South Korea": "韩国",
    "North Korea": "朝鲜",
    "France": "法国",
    "Germany": "德国",
    "Italy": "意大利",
    "Spain": "西班牙",
    "Portugal": "葡萄牙",
    "Canada": "加拿大",
    "Australia": "澳大利亚",
    "New Zealand": "新西兰",
    "Russia": "俄罗斯",
    "Brazil": "巴西",
    "Argentina": "阿根廷",
    "Mexico": "墨西哥",
    "India": "印度",
    "Thailand": "泰国",
    "Vietnam": "越南",
    "Philippines": "菲律宾",
    "Republik Indonesia": "印度尼西亚",
    "Malaysia": "马来西亚",
    "Singapore": "新加坡",

    # 欧洲
    "Sweden": "瑞典",
    "Norway": "挪威",
    "Denmark": "丹麦",
    "Finland": "芬兰",
    "Iceland": "冰岛",
    "Ireland": "爱尔兰",
    "Poland": "波兰",
    "Netherlands": "荷兰",
    "Belgium": "比利时",
    "Luxembourg": "卢森堡",
    "Switzerland": "瑞士",
    "Austria": "奥地利",
    "Greece": "希腊",
    "Turkey": "土耳其",
    "Czech Republic": "捷克",
    "Czechoslovakia": "捷克斯洛伐克",
    "Slovakia": "斯洛伐克",
    "Hungary": "匈牙利",
    "Romania": "罗马尼亚",
    "Bulgaria": "保加利亚",
    "Serbia": "塞尔维亚",
    "Croatia": "克罗地亚",
    "Slovenia": "斯洛文尼亚",
    "Bosnia Herzegovina": "波黑",
    "North Macedonia": "北马其顿",
    "Albania": "阿尔巴尼亚",
    "Montenegro": "黑山",
    "Kosovo": "科索沃",
    "Ukraine": "乌克兰",
    "Belarus": "白俄罗斯",
    "Estonia": "爱沙尼亚",
    "Latvia": "拉脱维亚",
    "Lithuania": "立陶宛",
    "Georgia": "格鲁吉亚",
    "Armenia": "亚美尼亚",
    "Azerbaijan": "阿塞拜疆",
    "Moldova": "摩尔多瓦",
    "Cyprus": "塞浦路斯",
    "Malta": "马耳他",
    "Monaco": "摩纳哥",
    "Liechtenstein": "列支敦士登",
    "Andorra": "安道尔",
    "Vatican": "梵蒂冈",
    "San Marino": "圣马力诺",
    "Isle of Man": "马恩岛",

    # 亚洲
    "Pakistan": "巴基斯坦",
    "Bangladesh": "孟加拉国",
    "Sri Lanka": "斯里兰卡",
    "Nepal": "尼泊尔",
    "Bhutan": "不丹",
    "Myanmar": "缅甸",
    "Cambodia": "柬埔寨",
    "Laos": "老挝",
    "Mongolia": "蒙古",
    "Kazakhstan": "哈萨克斯坦",
    "Uzbekistan": "乌兹别克斯坦",
    "Turkmenistan": "土库曼斯坦",
    "Kyrgyzstan": "吉尔吉斯斯坦",
    "Tajikistan": "塔吉克斯坦",
    "Afghanistan": "阿富汗",
    "Iran": "伊朗",
    "Iraq": "伊拉克",
    "Syria": "叙利亚",
    "Lebanon": "黎巴嫩",
    "Jordan": "约旦",
    "Israel": "以色列",
    "Palestinian territories": "巴勒斯坦",
    "Saudi Arabia": "沙特阿拉伯",
    "Kuwait": "科威特",
    "bahrain": "巴林",
    "Qatar": "卡塔尔",
    "United Arab Emirates": "阿联酋",
    "Oman": "阿曼",
    "Yemen": "也门",
    "Maldives": "马尔代夫",

    # 美洲
    "Chile": "智利",
    "Peru": "秘鲁",
    "Colombia": "哥伦比亚",
    "Venezuela": "委内瑞拉",
    "Ecuador": "厄瓜多尔",
    "Bolivia": "玻利维亚",
    "Paraguay": "巴拉圭",
    "Uruguay": "乌拉圭",
    "Cuba": "古巴",
    "Jamaica": "牙买加",
    "Haiti": "海地",
    "Dominican Republic": "多米尼加",
    "Puerto Rico": "波多黎各",
    "Guatemala": "危地马拉",
    "Honduras": "洪都拉斯",
    "Nicaragua": "尼加拉瓜",
    "Costa Rica": "哥斯达黎加",
    "Panama": "巴拿马",
    "Belize": "伯利兹",
    "Trinidad & Tobago": "特立尼达和多巴哥",
    "Barbados": "巴巴多斯",
    "Bahamas": "巴哈马",
    "Saint Kitts and Nevis": "圣基茨和尼维斯",
    "Antigua Barbuda": "安提瓜和巴布达",

    # 非洲
    "South Africa": "南非",
    "Egypt": "埃及",
    "Nigeria": "尼日利亚",
    "Kenya": "肯尼亚",
    "Ghana": "加纳",
    "Ethiopia": "埃塞俄比亚",
    "Morocco": "摩洛哥",
    "Algeria": "阿尔及利亚",
    "Tunisia": "突尼斯",
    "Libya": "利比亚",
    "Senegal": "塞内加尔",
    "Cameroon": "喀麦隆",
    "Congo": "刚果",
    "Angola": "安哥拉",
    "Zambia": "赞比亚",
    "Zimbabwe": "津巴布韦",
    "Botswana": "博茨瓦纳",
    "Namibia": "纳米比亚",
    "Madagascar": "马达加斯加",
    "Mauritania": "毛里塔尼亚",
    "Mali": "马里",
    "Niger": "尼日尔",
    "Burkina Faso": "布基纳法索",
    "Togo": "多哥",
    "Benin": "贝宁",
    "Liberia": "利比里亚",
    "Gambia": "冈比亚",
    "Malawi": "马拉维",
    "Lesotho": "莱索托",
    "Eswatini": "斯威士兰",
    "Seychelles": "塞舌尔",

    # 大洋洲
    "Papua New Guinea": "巴布亚新几内亚",
    "Fiji": "斐济",
    "Vanuatu": "瓦努阿图",
    "Samoa": "萨摩亚",
    "Western Samoa": "西萨摩亚",
    "Tonga": "汤加",
    "Kiribati": "基里巴斯",
    "Nauru": "瑙鲁",
    "Palau": "帕劳",
    "Micronesia": "密克罗尼西亚",

    # 特殊/历史
    "Soviet Union": "苏联",
    "Union of Soviet Socialist Republics": "苏维埃社会主义共和国联盟",
    "Yugoslavia": "南斯拉夫",
    "Pirates": "海盗",
    "Isla de Muerte": "死亡之岛",
    "Antarctica": "南极洲",

    # 其他
    "Aruba": "阿鲁巴",
    "Netherlands Antilles": "荷属安的列斯",
    "French Polynesia": "法属波利尼西亚",
}
