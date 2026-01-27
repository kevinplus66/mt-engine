import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 静态导出模式 - 构建为纯静态 HTML/CSS/JS
  output: "export",

  // 禁用图片优化（静态导出必需）
  images: {
    unoptimized: true,
  },

  // 生成带尾部斜杠的路径（/radar/ 而非 /radar）
  trailingSlash: true,

  // 移除 rewrites - 静态导出不支持，且不需要（同源部署）
};

export default nextConfig;
