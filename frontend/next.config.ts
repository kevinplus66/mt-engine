import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // 静态导出模式 - 仅在生产构建时使用
  ...(isDev ? {} : { output: "export" }),

  // 禁用图片优化（静态导出必需）
  images: {
    unoptimized: true,
  },

  // 生成带尾部斜杠的路径（/radar/ 而非 /radar）
  trailingSlash: true,

  // 开发模式：代理 API 请求到后端（绕过 CORS）
  // 生产模式：静态导出不支持 rewrites（同源部署）
  ...(isDev
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050"}/api/:path*`,
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
