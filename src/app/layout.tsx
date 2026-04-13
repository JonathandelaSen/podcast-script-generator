import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Geist_Mono } from "next/font/google";
import {
  AudioLinesIcon,
  FolderOpenIcon,
  GitBranchPlusIcon,
  HistoryIcon,
  Settings2Icon,
  SparklesIcon,
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

          <header className="fixed top-0 right-0 z-40 hidden h-16 w-[calc(100%-4rem)] items-center justify-between border-b border-slate-200/20 bg-white/80 px-8 shadow-sm backdrop-blur-md lg:flex">
            <div className="flex items-center gap-8">
              <span className="text-xl font-bold tracking-tight text-slate-900">ScriptArchitect</span>
              <nav className="hidden items-center gap-6 text-[0.875rem] font-medium md:flex">
                <span className="cursor-default pb-2 text-slate-500 transition-colors hover:text-indigo-500">Extraction</span>
                <span className="cursor-default pb-2 text-slate-500 transition-colors hover:text-indigo-500">Consolidation</span>
                <span className="cursor-default pb-2 text-slate-500 transition-colors hover:text-indigo-500">Outline</span>
                <span className="cursor-default pb-2 text-slate-500 transition-colors hover:text-indigo-500">Script</span>
                <span className="cursor-default pb-2 text-slate-500 transition-colors hover:text-indigo-500">Audit</span>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 text-[0.875rem] text-slate-500 transition-colors duration-150 hover:text-indigo-500">
                <HistoryIcon className="size-5" />
                <span>History</span>
              </button>
              <button className="primary-gradient rounded-lg px-5 py-2 text-[0.875rem] font-semibold text-white transition-transform duration-150 hover:-translate-y-0.5">
                Approve Stage
              </button>
              <div className="mx-2 h-6 w-px bg-[rgba(199,196,216,0.32)]" />
              <div className="flex items-center gap-2 text-slate-500">
                <Settings2Icon className="size-4 cursor-default transition-colors hover:text-indigo-500" />
                <SparklesIcon className="size-4 cursor-default transition-colors hover:text-indigo-500" />
                <WandSparklesIcon className="size-4 cursor-default transition-colors hover:text-indigo-500" />
              </div>
            </div>
          </header>

          <div className="relative min-h-screen lg:ml-16">
            <div className="mx-auto min-h-screen w-full px-4 py-6 sm:px-6 lg:px-8 lg:pt-24 lg:pb-12">
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
