import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { IBM_Plex_Serif, Mona_Sans } from "next/font/google";
import { Suspense } from "react";

import "./globals.css";
import Navbar from "@/components/Navbar";
import { Toaster } from "sonner";

const imbPlexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  variable: "--font-ibm-plex-serif",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const monaSans = Mona_Sans({
  subsets: ["latin"],
  variable: "--font-mona-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bookify",
  description:
    "Get accurate information from uploaded books for your articles, essays, and research papers. Upload PDFs, Word documents and chat with your books using voice and chat. Extract text from images and photos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${imbPlexSerif.variable} ${monaSans.variable} relative font-sans antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <Suspense>
            <Navbar />
          </Suspense>
          {children}
          <Toaster />
        </ClerkProvider>
      </body>
    </html>
  );
}
