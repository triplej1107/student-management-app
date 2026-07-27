import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Image from "next/image";
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
  themeColor: "oklch(0.58 0.15 35)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`}>
      <body className="relative min-h-full flex flex-col bg-bg-page">
        <div className="relative mx-auto flex min-h-full w-full max-w-[440px] flex-1 flex-col overflow-hidden bg-bg shadow-[0_0_40px_rgba(0,0,0,0.03)]">
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-5">
            <div className="relative h-[480px] w-[480px]">
              <Image src="/logo-full.png" alt="" fill className="object-contain" priority />
            </div>
          </div>
          <div className="relative z-10 flex flex-1 flex-col">
            <ToastProvider>{children}</ToastProvider>
          </div>
        </div>
      </body>
    </html>
  );
}
