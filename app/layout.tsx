import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Caladea,
  Cal_Sans,
  Geist,
  Geist_Mono,
  Inter,
} from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

// App fonts (the original look). Inter is the app's --font-sans; Geist Mono
// backs --font-mono. These are the defaults for the whole document.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Marketing-site fonts. Kept under their own variables; home.css swaps them
// in only under [data-surface="web"], so the app is unaffected.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-bricolage",    // ← website body font
  display: "swap",
});

const cal = Cal_Sans({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-display",      // ← website display/heading font
  display: "swap",
});

const caladea = Caladea({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal"],
  variable: "--font-caladea",      // ← website serif
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mosaic",
  description: "Your life, in one picture all working together",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        inter.variable,
        geistSans.variable,
        geistMono.variable,
        bricolage.variable,
        cal.variable,
        caladea.variable,
        "font-sans"
      )}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
