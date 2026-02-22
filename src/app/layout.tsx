import type { Metadata } from "next";
import "./globals.css";
import { BottomNav } from "@/components/nav";

export const metadata: Metadata = {
  title: "BananaPlan",
  description: "Banana farm management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 min-h-screen">
        <div className="pb-20 max-w-2xl mx-auto">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
