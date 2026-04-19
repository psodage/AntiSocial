import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bell, ChevronDown, Menu, Search } from "lucide-react";
import { ROUTES } from "../data/constants";
import { useApp } from "../context/AppContext";

export default function Topbar({ onOpenSidebar }) {
  const { user, toggleTheme, theme } = useApp();
  const location = useLocation();
  const [dateRange, setDateRange] = useState("Last 30 days");
  const title = useMemo(
    () => ROUTES.find((route) => route.path === location.pathname)?.label ?? "Dashboard",
    [location.pathname]
  );
  const firstName = (user.name || user.email || "User").split(" ")[0];

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 px-3 backdrop-blur-xl sm:px-6 dark:border-slate-800/70 dark:bg-slate-900/80">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-2">
        <div className="flex items-center gap-2">
          <button onClick={onOpenSidebar} className="rounded-md p-2 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800">
            <Menu size={18} />
          </button>
          <h1 className="text-xl font-bold">{title}</h1>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto">
          <label className="flex w-full items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm shadow-sm lg:w-80 dark:border-slate-700/80 dark:bg-slate-900/70">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search campaigns, platforms..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </label>
          <button className="relative rounded-xl border border-slate-200/80 bg-white/80 p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-slate-700/80 dark:bg-slate-900/70 dark:hover:bg-slate-800/80">
            <Bell size={16} />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand-500" />
          </button>
          <select
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value)}
            className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-semibold shadow-sm outline-none transition hover:bg-white dark:border-slate-700/80 dark:bg-slate-900/70 dark:hover:bg-slate-800/80"
          >
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
          </select>
          <button
            onClick={toggleTheme}
            className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-semibold shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-slate-700/80 dark:bg-slate-900/70 dark:hover:bg-slate-800/80"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-slate-700/80 dark:bg-slate-900/70 dark:hover:bg-slate-800/80">
            <span className="font-medium">{firstName}</span>
            <ChevronDown size={14} className="text-slate-500" />
          </button>
        </div>
      </div>
    </header>
  );
}
