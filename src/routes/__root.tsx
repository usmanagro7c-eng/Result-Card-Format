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
import { GraduationCap, Users, Settings as SettingsIcon, Plus, BookOpen } from "lucide-react";

import { Analytics } from "@vercel/analytics/react";

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

  const isEditor = currentPath.startsWith("/editor/");

  return (
    <header className="no-print sticky top-0 z-40 w-full border-b border-border/60 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-600 text-white shadow-md">
            <GraduationCap className="size-5" />
          </div>
          <div className="hidden sm:block">
            <span className="font-bold text-slate-900 text-[15px] leading-tight block">
              Result Card Generator
            </span>
            <span className="text-[11px] text-slate-500 font-medium block leading-tight">
              {settings.schoolName || "School Progress Reports"}
            </span>
          </div>
          <div className="sm:hidden">
            <span className="font-bold text-slate-900 text-sm leading-tight block">
              Result Cards
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/"
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              currentPath === "/"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Users className="size-4" />
            <span>Students</span>
            {students.length > 0 && (
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  currentPath === "/" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {students.length}
              </span>
            )}
          </Link>

          <Link
            to="/settings"
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              currentPath === "/settings"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <SettingsIcon className="size-4" />
            <span>Settings</span>
          </Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {!isEditor && (
            <Button
              onClick={handleQuickAdd}
              className="h-9 gap-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 shadow-sm text-sm px-4"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Add Student</span>
              <span className="sm:hidden">Add</span>
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="flex md:hidden border-t border-border/60 bg-slate-50/80 pb-[env(safe-area-inset-bottom)]">
        <Link
          to="/"
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
            currentPath === "/"
              ? "text-slate-900 bg-white border-t-2 border-slate-900 -mt-px"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Users className="size-4" />
          <span>Students {students.length > 0 ? `(${students.length})` : ""}</span>
        </Link>
        <Link
          to="/settings"
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
            currentPath === "/settings"
              ? "text-slate-900 bg-white border-t-2 border-slate-900 -mt-px"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <SettingsIcon className="size-4" />
          <span>Settings</span>
        </Link>
      </div>
    </header>
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
        <Analytics />
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
