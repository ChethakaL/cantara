import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import { AppToaster } from "@/components/app-toaster";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cantara Dealflow Console",
  description:
    "A private equity intake and diligence workflow demo for clients and administrators.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${playfair.variable} antialiased`}>
        <AppToaster />
        {children}
      </body>
    </html>
  );
}
