import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sayhadow",
  description: "AI image generation workspace for ecommerce visuals"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
