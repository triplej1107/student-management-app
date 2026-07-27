import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

export const metadata: Metadata = {
  title: "유종의미 국어학원 학생관리",
  description: "유종의미 국어학원 학생관리 앱",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0056ff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`}>
      <body className="relative min-h-full flex flex-col bg-bg-page">
        <div className="relative mx-auto flex min-h-full w-full max-w-[440px] flex-1 flex-col bg-bg shadow-[0_0_40px_rgba(0,0,0,0.03)]">
          <ToastProvider>{children}</ToastProvider>
        </div>
      </body>
    </html>
  );
}
