import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Playground from "@/pages/playground";
import Docs from "@/pages/docs";

const queryClient = new QueryClient();

type Tab = "playground" | "docs";

function Layout() {
  const [tab, setTab] = useState<Tab>("playground");

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-52 flex-none flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-4 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">AI</span>
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">AI Proxy</p>
              <p className="text-[10px] text-sidebar-foreground/60 mt-0.5">OpenAI Compatible</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          <NavItem
            active={tab === "playground"}
            onClick={() => setTab("playground")}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            label="Playground"
          />
          <NavItem
            active={tab === "docs"}
            onClick={() => setTab("docs")}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            label="API Docs"
          />
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border">
          <div className="text-[10px] text-sidebar-foreground/50 space-y-1">
            <p className="font-medium text-sidebar-foreground/70">Supported</p>
            <p>Claude Opus / Sonnet / Haiku</p>
            <p>GPT-5.2, GPT-5, o4-mini</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/40 flex-none">
          <h1 className="text-base font-semibold">
            {tab === "playground" ? "Playground" : "API Reference"}
          </h1>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              API Online
            </span>
          </div>
        </header>

        {/* Page */}
        <div className="flex-1 overflow-y-auto">
          {tab === "playground" ? <Playground /> : <Docs />}
        </div>
      </main>
    </div>
  );
}

function NavItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      data-testid={`nav-${label.toLowerCase().replace(" ", "-")}`}
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? "bg-sidebar-accent text-sidebar-foreground font-medium"
          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Layout />
    </QueryClientProvider>
  );
}
