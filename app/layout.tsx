import type { Metadata } from "next";
import { Poppins, Baloo_2 } from "next/font/google";
import "./globals.css";

// Body/UI text.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-poppins",
});

// Bold, rounded display font for the brand headline moment — matches the
// chunky Devanagari-paired look Chaileela uses on their own site headlines.
const baloo = Baloo_2({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-baloo",
});

export const metadata: Metadata = {
  title: "Chaileela — leave a review",
  description: "Tap a few words, get a review to post.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${poppins.className} ${baloo.variable}`}>{children}</body>
    </html>
  );
}
