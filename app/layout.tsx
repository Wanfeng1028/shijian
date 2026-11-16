import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "史鉴 · 高中历史 AI 教学智能体",
  description: "史鉴以史料观察、问题发现、证据探究六阶段引导高中生从史料中发现问题",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
