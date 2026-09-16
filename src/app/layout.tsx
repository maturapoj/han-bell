import type { Metadata } from "next";
import { Chakra_Petch, IBM_Plex_Sans_Thai, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const chakraPetch = Chakra_Petch({
  variable: "--font-display",
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
});

const plexSansThai = IBM_Plex_Sans_Thai({
  variable: "--font-body",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "หารเบิ้ล",
  description: "เครื่องคำนวณหารบิลสไตล์ใบเสร็จ เพิ่มเพื่อนและรายการอาหารแล้วดูยอดที่แต่ละคนต้องจ่ายทันที",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${chakraPetch.variable} ${plexSansThai.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
