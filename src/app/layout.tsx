import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Attribution } from "@/components/Attribution";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import "@xyflow/react/dist/style.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "NextFlow",
  description: "Pixel-perfect LLM workflow builder",
  icons: {
    icon: "/ChatGPT Image Jun 19, 2026, 04_29_44 PM (1).png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full antialiased">
        <body className={`${inter.variable} ${outfit.variable} min-h-full bg-[#f7f7f5] text-gray-800 font-sans`}>
          <Attribution />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
