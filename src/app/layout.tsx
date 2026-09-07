import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/shell/providers";
import { getServerSupabase } from "@/lib/supabase/server";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "My Life OS", template: "%s · My Life OS" },
  description: "A calm personal command centre: today, capture, money, memory.",
  manifest: "/manifest.webmanifest",
  applicationName: "My Life OS",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "My Life OS" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1f" },
    { media: "(prefers-color-scheme: light)", color: "#f4efe6" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await getServerSupabase();
  let userId: string | null = null;
  let email: string | null = null;
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    email = user?.email ?? null;
  }
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers userId={userId} email={email}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
