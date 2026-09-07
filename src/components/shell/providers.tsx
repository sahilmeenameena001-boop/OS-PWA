"use client";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/lib/session/session-provider";
import { LiveRegion } from "@/components/shell/live-region";
import { PWARegister } from "@/components/shell/pwa-register";

export function Providers({ children, userId, email }: { children: React.ReactNode; userId: string | null; email: string | null }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SessionProvider initialUserId={userId} initialEmail={email}>
        <TooltipProvider>
          {children}
          <LiveRegion />
          <Toaster position="top-center" richColors closeButton />
          <PWARegister />
        </TooltipProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
