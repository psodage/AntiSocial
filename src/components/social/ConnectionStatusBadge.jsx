export default function ConnectionStatusBadge({ isConnected }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
        isConnected
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-slate-600 bg-slate-800/80 text-slate-300"
      }`}
    >
      {isConnected ? "Connected" : "Not Connected"}
    </span>
  );
}
