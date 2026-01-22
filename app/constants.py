"""
业务常量定义
"""

# ============ qBittorrent 标签常量 ============
QB_TAG_PERSONAL = "个人下载"    # Search Engine 下载使用的标签
QB_TAG_FREE_SEED = "免费做种"   # Free Hunter 免费种子使用的标签


# ============ 搜索引擎筛选选项 ============
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
