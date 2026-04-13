import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Podcast Script Generator",
  description: "Pipeline local-first para convertir fuentes en texto en un guión de podcast con Gemini.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(201,218,255,0.45),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,223,196,0.45),transparent_24%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-foreground">
        <div className="min-h-full">{children}</div>
      </body>
    </html>
  );
}
