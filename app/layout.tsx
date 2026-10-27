import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Sans_KR } from "next/font/google";
import { FlowProvider } from "@/components/FlowProvider";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-manrope", display: "swap" });
const noto = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "700", "800"], variable: "--font-noto", display: "swap" });

export const metadata: Metadata = {
  title: "Mirror Tutor — 내 얼굴로 배우는 K-메이크업",
  description: "YouCam Face Analyzer picks the technique for your features, Makeup VTO renders each step as the answer key, and you grade your own attempt.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#FBF7F4" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${manrope.variable} ${noto.variable}`}>
      <body>
        <FlowProvider>{children}</FlowProvider>
      </body>
    </html>
  );
}
