import { NavLink } from "react-router-dom";
import { ROUTES } from "../data/constants";
import { SOCIAL_PLATFORM_CONFIGS } from "../data/socialPlatforms";
import { useApp } from "../context/AppContext";

export default function Sidebar({ open, onClose, onLogout }) {
  const { connectedAccounts } = useApp();
  const connectedPlatformMenus = connectedAccounts
    .filter((account) => account.isConnected)
    .map((account) => {
      const platformConfig = SOCIAL_PLATFORM_CONFIGS.find((platform) => platform.key === account.platform);
      return {
        key: account.platform,
        label: platformConfig?.label || account.platform,
        path: `/connected-platforms/${account.platform}`,
      };
    });

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white p-4 transition-transform dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
          <span className="h-9 w-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-400" />
          <span className="flex-1 text-lg font-bold">ProBlogBooster</span>
          <button onClick={onClose} className="rounded-md p-2 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800">
            x
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {ROUTES.map((route) => (
            <div key={route.key}>
              <NavLink
                to={route.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium ${
                    isActive
                      ? "bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-100"
                      : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`
                }
              >
                {route.label}
              </NavLink>
              {route.key === "connected-platforms" && connectedPlatformMenus.length > 0 ? (
                <div className="mt-1 space-y-1 border-l border-slate-300 pl-3 dark:border-slate-700">
                  {connectedPlatformMenus.map((platform) => (
                    <NavLink
                      key={platform.key}
                      to={platform.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `block rounded-md px-3 py-1.5 text-xs font-medium ${
                          isActive
                            ? "bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-100"
                            : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`
                      }
                    >
                      {platform.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>
        <button
          onClick={onLogout}
          className="mt-4 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Log out
        </button>
      </aside>
      {open && <button onClick={onClose} className="fixed inset-0 z-30 bg-black/40 lg:hidden" />}
    </>
  );
}
