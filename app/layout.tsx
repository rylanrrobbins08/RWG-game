import type { Metadata } from "next";
import { Barlow, Oswald } from "next/font/google";
import AppShell from "./components/AppShell";
import AuthGate from "./components/AuthGate";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "RWG",
    template: "%s · RWG",
  },
  description: "Wrestling career game — create your wrestler and chase a title.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${oswald.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
      </body>
    </html>
  );
}
