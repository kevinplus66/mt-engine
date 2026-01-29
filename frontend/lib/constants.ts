/**
 * MT-Engine Constants & Configuration
 * 从 config.js 迁移的分类映射和配置常量
 */

import type { CategoryOption, FilterOption } from "./types";

// ============ 基础配置 ============

export const CONFIG = {
  // 开发模式：使用空字符串（相对路径），触发 next.config.ts 的 proxy rewrites
  // 生产模式：使用完整 URL（同源部署）
  API_BASE: process.env.NODE_ENV === "development"
    ? ""
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"),
  HAPTIC_DURATION: 30,
  TOAST_DURATION: 3000,
  SCROLL_THRESHOLD: 300,
  ITEMS_PER_PAGE: 50,
} as const;

// ============ 父分类名称 ============

export const PARENT_CATEGORY_NAMES: Record<number, string> = {
  // 顶级分类
  100: "电影",
  105: "影剧/综艺",
  110: "音乐",
  444: "纪录",
  447: "游戏",
  449: "动漫",
  450: "其他",
  // 成人分类
  115: "有码",
  120: "无码",
  445: "写真",
  446: "H-ACG",
};

// ============ 子分类到父分类的映射 ============

export const CHILD_TO_PARENT: Record<number, number> = {
  // 电影子分类 -> 100
  401: 100,
  419: 100,
  420: 100,
  421: 100,
  439: 100,
  // 影剧子分类 -> 105
  402: 105,
  403: 105,
  435: 105,
  438: 105,
  // 音乐子分类 -> 110
  434: 110,
  406: 110,
  // 纪录片子分类 -> 444
  404: 444,
  // 动漫子分类 -> 449
  405: 449,
  // 游戏子分类 -> 447
  423: 447,
  448: 447,
  // 其他子分类 -> 450
  427: 450,
  407: 450,
  422: 450,
  442: 450,
  451: 450,
  409: 450,
  // 成人子分类
  410: 115,
  424: 115,
  437: 115,
  431: 115, // 有码
  429: 120,
  430: 120,
  426: 120,
  432: 120,
  436: 120,
  440: 120, // 无码
  425: 445,
  433: 445, // 写真
  411: 446,
  412: 446,
  413: 446, // H-ACG
};

// ============ 分类映射（模式 -> 分类Pills） ============

export const CATEGORY_MAP: Record<string, CategoryOption[]> = {
  movie: [
    { id: 439, name_zh: "Remux", name_en: "Remux" },
    { id: 421, name_zh: "Blu-Ray", name_en: "Blu-Ray" },
    { id: 419, name_zh: "HD (Web/Rip)", name_en: "HD (Web/Rip)" },
    { id: 420, name_zh: "DVD", name_en: "DVD" },
    { id: 401, name_zh: "SD", name_en: "SD" },
  ],
  tvshow: [
    { id: 438, name_zh: "Blu-Ray", name_en: "Blu-Ray" },
    { id: 402, name_zh: "HD (Web/Rip)", name_en: "HD (Web/Rip)" },
    { id: 435, name_zh: "DVD", name_en: "DVD" },
    { id: 403, name_zh: "SD", name_en: "SD" },
  ],
  other: [
    { id: "449,405", name_zh: "动漫", name_en: "Anime" },
    { id: "444,404", name_zh: "纪录片", name_en: "Documentary" },
    { id: "110,434,406", name_zh: "音乐", name_en: "Music" },
    { id: "447,423,448", name_zh: "游戏", name_en: "Game" },
    { id: "422", name_zh: "软件", name_en: "Software" },
    { id: "427", name_zh: "电子书", name_en: "E-Book" },
    { id: "407", name_zh: "运动", name_en: "Sports" },
    { id: "442", name_zh: "有声书", name_en: "Audiobook" },
    { id: "451", name_zh: "教育", name_en: "Education" },
    { id: "409", name_zh: "其他", name_en: "Misc" },
  ],
  adult: [
    { id: "410,424,437,431", name_zh: "有码", name_en: "Censored" },
    { id: "429,430,426,432,436", name_zh: "无码", name_en: "Uncensored" },
    { id: "440", name_zh: "Gay", name_en: "Gay" },
    { id: "425,433", name_zh: "写真", name_en: "IV/Gravure" },
    { id: "411", name_zh: "游戏", name_en: "H-Game" },
    { id: "412", name_zh: "动漫", name_en: "H-Anime" },
    { id: "413", name_zh: "漫画", name_en: "H-Comic" },
  ],
  normal: [],
};

// ============ 筛选器可见性配置 ============

export const FILTER_CONFIG: Record<string, string[]> = {
  normal: ["resolution", "video", "audio", "country", "discount"],
  movie: ["resolution", "video", "audio", "country", "discount"],
  tvshow: ["resolution", "video", "audio", "country", "discount"],
  other: ["country", "discount"],
  adult: ["resolution", "discount"],
};

// ============ 分类 ID 数组 ============

export const MOVIE_CATEGORY_IDS = [439, 421, 419, 420, 401];
export const TVSHOW_CATEGORY_IDS = [438, 402, 435, 403];
export const OTHER_CATEGORY_IDS = [
  110, 434, 406, // 音乐
  449, 405, // 动漫
  444, 404, // 纪录
  447, 423, 448, // 游戏
  422, 427, 407, 442, 451, 409, // 其他
];
export const ADULT_CATEGORY_IDS = [
  410, 424, 437, 431, // 有码
  429, 430, 426, 432, 436, 440, // 无码 + Gay
  425, 433, // 写真
  411, 412, 413, // H-ACG
];
export const NORMAL_CATEGORY_IDS = [
  ...MOVIE_CATEGORY_IDS,
  ...TVSHOW_CATEGORY_IDS,
  ...OTHER_CATEGORY_IDS,
];

// ============ 筛选选项 ============

export const FILTER_OPTIONS = {
  countries: [
    { id: "CN", name_zh: "中国大陆", name_en: "China" },
    { id: "HK", name_zh: "香港", name_en: "Hong Kong" },
    { id: "TW", name_zh: "台湾", name_en: "Taiwan" },
    { id: "US", name_zh: "美国", name_en: "USA" },
    { id: "JP", name_zh: "日本", name_en: "Japan" },
    { id: "KR", name_zh: "韩国", name_en: "Korea" },
    { id: "UK", name_zh: "英国", name_en: "UK" },
    { id: "FR", name_zh: "法国", name_en: "France" },
  ] as FilterOption[],
  discounts: [
    { id: "FREE", name_zh: "免费", name_en: "Free" },
    { id: "_2X_FREE", name_zh: "2x免费", name_en: "2x Free" },
    { id: "_2X", name_zh: "2x上传", name_en: "2x Upload" },
    { id: "PERCENT_50", name_zh: "50%", name_en: "50% Off" },
  ] as FilterOption[],
};

// ============ 折扣标签样式映射 ============

export const DISCOUNT_STYLES: Record<
  string,
  { bg: string; text: string; label: string; border: string }
> = {
  FREE: { bg: "bg-green-500", text: "text-white", label: "免费", border: "border-black dark:border-white" },
  "_2X_FREE": { bg: "bg-blue-500", text: "text-white", label: "2x免费", border: "border-black dark:border-white" },
  "_2X": { bg: "bg-purple-500", text: "text-white", label: "2x", border: "border-black dark:border-white" },
  PERCENT_50: { bg: "bg-orange-500", text: "text-white", label: "50%", border: "border-black dark:border-white" },
  PERCENT_70: { bg: "bg-yellow-500", text: "text-black", label: "70%", border: "border-black dark:border-white" },
  PERCENT_30: { bg: "bg-red-500", text: "text-white", label: "30%", border: "border-black dark:border-white" },
  NORMAL: { bg: "bg-gray-200", text: "text-black", label: "普通", border: "border-black dark:border-white" },
};

// ============ 排序选项 ============

export const SORT_OPTIONS = [
  { value: "CREATED_DATE", label: "发布时间" },
  { value: "SIZE", label: "体积" },
  { value: "SEEDERS", label: "做种数" },
  { value: "LEECHERS", label: "下载数" },
] as const;

export const SORT_DIRECTIONS = [
  { value: "DESC", label: "降序" },
  { value: "ASC", label: "升序" },
] as const;
