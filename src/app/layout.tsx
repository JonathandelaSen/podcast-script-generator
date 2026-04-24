import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Geist_Mono } from "next/font/google";
import {
  AudioLinesIcon,
  FolderOpenIcon,
  WandSparklesIcon,
} from "lucide-react";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
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
      className={`${inter.className} ${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <div className="relative min-h-screen overflow-hidden bg-background">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.08),transparent_22%),linear-gradient(180deg,#f8f9ff_0%,#eff4ff_100%)]" />

          <aside className="fixed inset-y-0 left-0 z-50 hidden w-16 flex-col items-center bg-slate-50 py-6 lg:flex">
            <div className="mb-10">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3525cd,#4f46e5)] text-white">
                <AudioLinesIcon className="size-4" />
              </div>
            </div>

            <nav className="flex flex-col items-center space-y-4">
              <Link
                href="/"
                className="flex size-10 items-center justify-center rounded-xl text-indigo-700 transition-colors hover:bg-slate-200/50"
              >
                <FolderOpenIcon className="size-5" />
              </Link>
            </nav>

            <div className="mt-8">
              <Link
                href="/new-project"
                className="primary-gradient flex size-10 items-center justify-center rounded-xl text-white shadow-md transition-transform duration-150 hover:-translate-y-0.5"
              >
                <WandSparklesIcon className="size-5" />
              </Link>
            </div>
          </aside>

          <div className="relative min-h-screen lg:ml-16">
            <div className="mx-auto min-h-screen w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
