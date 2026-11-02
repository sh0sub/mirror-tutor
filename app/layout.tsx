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

/** First paint in the visitor's language: SSR is Korean, so an English-resolved visit hides the body until FlowProvider has applied the language (CSS failsafe reveals after 1.2 s). Mirrors loadLang in lib/i18n.ts. */
const LANG_PRELOAD = `(function(){try{var q=new URLSearchParams(location.search).get("lang");q=q&&q.toLowerCase();var l=(q==="ko"||q==="en")?q:null;if(!l){try{var v=localStorage.getItem("mt.lang");if(v==="ko"||v==="en")l=v}catch(e){}}if(!l)l=/^ko/i.test(navigator.language||"")?"ko":"en";if(l==="en")document.documentElement.classList.add("lang-pending")}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${manrope.variable} ${noto.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANG_PRELOAD }} />
      </head>
      <body>
        <FlowProvider>{children}</FlowProvider>
      </body>
    </html>
  );
}
