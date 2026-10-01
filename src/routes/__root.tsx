import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useNavigate,
  useRouter,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Users, Settings as SettingsIcon, Plus, BookOpen } from "lucide-react";

import appCss from "../styles.css?url";
import { ResultStoreProvider, createStudent, useResultStore } from "../store/resultStore";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";

function AppNavbar() {
  const routerState = useRouterState();
  const navigate = useNavigate();
  const currentPath = routerState.location.pathname;
  const { students, settings, addStudent } = useResultStore();

  const handleQuickAdd = () => {
    const student = createStudent(settings);
    addStudent(student);
    navigate({ to: "/editor/$studentId", params: { studentId: student.id } });
  };

  const isHome = currentPath === "/";
  const isSettings = currentPath === "/settings";
  const isEditor = currentPath.startsWith("/editor/");

  return (
    <>
      <header className="no-print sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
        {/* Main Top Bar */}
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-3 sm:px-6">
          {/* Left: Brand + Desktop Navigation */}
          <div className="flex items-center gap-6 sm:gap-8 min-w-0">
            <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-85 min-w-0">
              <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-xs">
                <img
                  src={settings.logoDataUrl || "/TCS Logo.png"}
                  alt={settings.schoolName || "The Country School"}
                  className="size-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-slate-900 text-xs sm:text-sm leading-tight block tracking-tight truncate max-w-[140px] min-[380px]:max-w-[180px] sm:max-w-none">
                  Result Card Generator
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium block leading-tight truncate max-w-[140px] min-[380px]:max-w-[180px] sm:max-w-none">
                  {settings.schoolName || "The Country School"}
                </span>
              </div>
            </Link>

            {/* Desktop Nav Links */}
            <nav className="hidden md:flex items-center gap-1 border-l border-slate-200 pl-6" aria-label="Main navigation">
              <Link
                to="/"
                className={`relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${
                  isHome
                    ? "text-blue-900 bg-blue-50/80"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Users className="size-4" />
                <span>Students</span>
                {students.length > 0 && (
                  <span
                    className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums ${
                      isHome
                        ? "bg-blue-900/12 text-blue-900"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {students.length}
                  </span>
                )}
                {isHome && (
                  <span className="absolute bottom-0 left-2.5 right-2.5 h-[2px] rounded-full bg-blue-900" />
                )}
              </Link>

              <Link
                to="/settings"
                className={`relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${
                  isSettings
                    ? "text-blue-900 bg-blue-50/80"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <SettingsIcon className="size-4" />
                <span>Settings</span>
                {isSettings && (
                  <span className="absolute bottom-0 left-2.5 right-2.5 h-[2px] rounded-full bg-blue-900" />
                )}
              </Link>
            </nav>
          </div>

          {/* Right side: Active Term & Session status badge */}
          <div className="flex items-center shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] sm:text-xs font-semibold text-slate-600 border border-slate-200/60 shadow-2xs">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">{settings.defaultTerm} &middot; </span>
              <span className="truncate max-w-[85px] sm:max-w-none">{settings.defaultSession}</span>
            </span>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation — fixed to viewport bottom */}
      {!isEditor && (
        <nav
          aria-label="Mobile navigation"
          className="no-print md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/80 bg-white/95 backdrop-blur-lg shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="grid grid-cols-3 items-center px-2">
            {/* Students tab */}
            <Link
              to="/"
              aria-current={isHome ? "page" : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-1 py-1.5 text-[11px] font-bold transition-all active:scale-95 ${
                isHome ? "text-blue-900" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <div className={`flex items-center justify-center rounded-xl p-1 transition-colors ${isHome ? "bg-blue-50 text-blue-900" : ""}`}>
                <Users className="size-5" />
              </div>
              <span className="leading-none">Students{students.length > 0 ? ` (${students.length})` : ""}</span>
              {isHome && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-blue-900" />
              )}
            </Link>

            {/* Center Quick Add FAB */}
            <div className="flex items-center justify-center">
              <button
                onClick={handleQuickAdd}
                aria-label="Add new student"
                className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-950 to-blue-800 text-white shadow-lg shadow-blue-900/30 transition-transform hover:scale-105 active:scale-95 active:shadow-md"
              >
                <Plus className="size-6 stroke-[2.5]" />
              </button>
            </div>

            {/* Settings tab */}
            <Link
              to="/settings"
              aria-current={isSettings ? "page" : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-1 py-1.5 text-[11px] font-bold transition-all active:scale-95 ${
                isSettings ? "text-blue-900" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <div className={`flex items-center justify-center rounded-xl p-1 transition-colors ${isSettings ? "bg-blue-50 text-blue-900" : ""}`}>
                <SettingsIcon className="size-5" />
              </div>
              <span className="leading-none">Settings</span>
              {isSettings && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-blue-900" />
              )}
            </Link>
          </div>
        </nav>
      )}
    </>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-slate-100">
          <BookOpen className="size-10 text-slate-400" />
        </div>
        <h1 className="text-5xl font-black text-slate-800">404</h1>
        <h2 className="text-xl font-semibold text-slate-700">Page not found</h2>
        <p className="text-sm text-slate-500">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-red-50">
          <span className="text-3xl">⚠️</span>
        </div>
        <h1 className="text-xl font-bold text-slate-800">Something went wrong</h1>
        <p className="text-sm text-slate-500">
          An error occurred. You can try refreshing or head back home.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "School Result Card Generator — Progress Report" },
      {
        name: "description",
        content:
          "Generate professional A4 school progress reports with automatic totals, percentage, and configurable grading.",
      },
      { property: "og:title", content: "School Result Card Generator" },
      {
        property: "og:description",
        content: "Generate professional A4 school progress reports.",
      },
      { property: "og:type", content: "website" },
      // These use name/content, so they are <meta> tags. Putting them in
      // `links` emits invalid <link name=...> elements, which React 19's head
      // hoisting orders differently on the server vs the client and triggers
      // a hydration mismatch.
      { name: "theme-color", content: "#28246a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Result Cards" },
    ],

    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-slate-50 font-sans antialiased text-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ResultStoreProvider>
        <div className="flex min-h-screen flex-col">
          <AppNavbar />
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
        <Toaster
          position="top-center"
          offset={{ top: "4.75rem" }}
          mobileOffset={{ top: "4.5rem" }}
          richColors
        />
      </ResultStoreProvider>
    </QueryClientProvider>
  );
}
