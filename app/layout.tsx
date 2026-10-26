import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";

import { FlashToast } from "@/components/ui/flash-toast";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SiJAR",
    template: "%s · SiJAR",
  },
  description:
    "Sistem Informasi Jurnal Mengajar, Jadwal, dan Absensi untuk sekolah.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ToastProvider>
          <Suspense fallback={null}>
            <FlashToast />
          </Suspense>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
