import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ReturnDesk",
  description: "Returns desk for support agents",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full">
        <header className="border-b-2 border-[#F7C52D] bg-gradient-to-r from-[#1a1a1a] to-[#2d2d2d] text-white shadow-lg">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 sm:px-8">
            <Link href="/requests" className="flex items-center gap-4 group">
              <div className="relative">
                <Image 
                  src="/logo.png" 
                  alt="Frido" 
                  width={140} 
                  height={60} 
                  className="h-auto w-[140px] rounded-xl object-contain shadow-xl ring-4 ring-[#F7C52D] group-hover:ring-[#f59e0b] transition-all duration-200 group-hover:scale-105" 
                  priority
                />
              </div>
              <div className="flex flex-col border-l-2 border-[#F7C52D]/30 pl-4">
                <span className="text-2xl font-bold tracking-tight text-white group-hover:text-[#F7C52D] transition-colors duration-200">
                  ReturnDesk
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#F7C52D]">
                  Returns Management
                </span>
              </div>
            </Link>
            <Link
              href="/requests/new"
              className="inline-flex items-center gap-2 rounded-xl bg-[#F7C52D] px-6 py-3 text-sm font-bold text-[#1a1a1a] hover:bg-[#f2b56b] hover:scale-105 transform transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <span className="text-lg leading-none">+</span> 
              New Request
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-6 py-8 sm:px-8">{children}</main>
      </body>
    </html>
  );
}
