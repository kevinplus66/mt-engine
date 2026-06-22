import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  devIndicators: false,

  // 允许局域网 IP 访问 dev 资源（HMR/字体等）。Next 16 默认仅放行 localhost，
  // 从手机/其他设备用 LAN IP 预览时客户端不会 hydrate，页面只剩骨架。
  allowedDevOrigins: ["192.168.0.2"],

  // 静态导出模式 - 仅在生产构建时使用
  ...(isDev ? {} : { output: "export" }),

  // 禁用图片优化（静态导出必需）
  images: {
    unoptimized: true,
  },

  // 生成带尾部斜杠的路径（/radar/ 而非 /radar）——仅生产静态导出需要。
  // 开发模式下若开启，会把 /api/* 请求 308 重定向到带斜杠版本，而后端只暴露
  // 不带斜杠的路由，导致 dev 代理全部 404/500，故开发模式关闭。
  trailingSlash: !isDev,

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
            {
              source: "/health",
              destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050"}/health`,
            },
            {
              source: "/health/",
              destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050"}/health`,
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
