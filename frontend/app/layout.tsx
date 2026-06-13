import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter_Tight } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { SWRProvider } from "@/providers/swr-provider";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/layout/navbar";
import { cn } from "@/lib/utils";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  fallback: ["PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "sans-serif"],
});

const heading = Inter_Tight({
  variable: "--font-heading",
  subsets: ["latin"],
  fallback: ["PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "sans-serif"],
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  fallback: ["PingFang SC", "Microsoft YaHei", "monospace"],
});

export const metadata: Metadata = {
  title: "MT-Engine - 智能种子管理系统",
  description: "基于 M-Team 的自动化种子搜索、监控与管理系统",
  other: {
    "color-scheme": "dark light",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fefefe" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f10" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={cn(sans.variable, heading.variable, mono.variable)}
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SWRProvider>
            <AppShell>{children}</AppShell>
            <Toaster />
          </SWRProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
