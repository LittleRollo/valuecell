import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import "@/i18n";
import AppSidebar from "@/components/valuecell/app/app-sidebar";
import { useLanguage } from "@/store/settings-store";
import { Toaster } from "./components/ui/sonner";

import "./global.css";
import { SidebarProvider } from "./components/ui/sidebar";

export function Layout({ children }: { children: React.ReactNode }) {
  const language = useLanguage();
  const htmlLang =
    {
      en: "en",
      zh_CN: "zh-CN",
      zh_TW: "zh-TW",
      ja: "ja",
    }[language] ?? "en";

  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/logo.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Value Cell</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // Global default 5 minutes fresh time
      gcTime: 30 * 60 * 1000, // Global default 30 minutes garbage collection time
      refetchOnWindowFocus: false, // Don't refetch on window focus by default
      retry: 1, // Default retry 1 times on failure
    },
    mutations: {
      retry: 1, // Default retry 1 time for mutations
    },
  },
});

import { AutoUpdateCheck } from "@/components/valuecell/app/auto-update-check";
import { BackendHealthCheck } from "@/components/valuecell/app/backend-health-check";
import { TrackerProvider } from "./provider/tracker-provider";

const STARTUP_SPLASH_DURATION_MS = 3000;

export default function Root() {
  const [isStartupSplashVisible, setIsStartupSplashVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsStartupSplashVisible(false);
    }, STARTUP_SPLASH_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        enableColorScheme
        storageKey="valuecell-theme"
      >
        <BackendHealthCheck>
          <TrackerProvider>
            <SidebarProvider>
              <div className="fixed flex size-full overflow-hidden">
                {isStartupSplashVisible && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
                    <div className="flex flex-col items-center gap-3">
                      <img src="/logo.svg" alt="ValueCell" className="size-12" />
                      <p className="font-semibold text-foreground text-sm">ValueCell</p>
                    </div>
                  </div>
                )}

                <AppSidebar />

                <main
                  className="relative flex flex-1 overflow-hidden"
                  id="main-content"
                >
                  <Outlet />
                </main>
                <Toaster />
              </div>
            </SidebarProvider>
          </TrackerProvider>
          <AutoUpdateCheck />
        </BackendHealthCheck>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
