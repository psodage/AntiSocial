const TABS = [
  { id: "overview", label: "Overview" },
  { id: "create", label: "Create Post" },
  { id: "history", label: "History" },
];

/**
 * @param {{ active: string, onChange: (id: string) => void }} props
 */
export default function PlatformDetailTabBar({ active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-slate-700 bg-slate-950/60 p-1 shadow-inner">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`min-w-[6rem] flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold transition sm:text-sm ${
              isActive
                ? "bg-brand-500 text-white shadow-md shadow-brand-900/30"
                : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
