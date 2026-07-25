import type { Metadata } from "next";
import { SiteLayout } from "@/layouts/SiteLayout";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "EcoWash Phoenix",
  description: "Executive public website foundation for EcoWash Phoenix.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <SiteLayout>{children}</SiteLayout>
      </body>
    </html>
  );
}
