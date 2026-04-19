const rows = [
  ["Spring launch - hero video", "Instagram, Facebook", "Apr 3, 2026 - 10:00 AM UTC", "scheduled"],
  ["Community question thread", "Reddit", "Apr 4, 2026 - 9:00 AM UTC", "publishing"],
  ["Hiring: Senior designer", "LinkedIn", "Apr 5, 2026 - 8:30 AM UTC", "published"],
  ["Weekend promo - 20% off", "X (Twitter), Telegram", "Apr 6, 2026 - 6:00 PM UTC", "partially published"],
  ["April location update", "Google Business Profile", "Apr 7, 2026 - 1:00 PM UTC", "failed"],
];

const statusClass = {
  draft: "text-slate-300",
  scheduled: "text-blue-300",
  publishing: "text-amber-300",
  published: "text-emerald-300",
  failed: "text-red-300",
  "partially published": "text-orange-300",
};

export default function SchedulePage() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-1 text-sm font-semibold">Scheduled posts</h2>
      <p className="mb-4 text-xs text-slate-500">Timezone-aware queue with per-platform validation and retry status tracking.</p>
      <div className="overflow-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
              <th className="p-3">Post preview</th>
              <th className="p-3">Platform</th>
              <th className="p-3">Date</th>
              <th className="p-3">Status</th>
              <th className="p-3">Retry</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]} className="border-b border-slate-100 dark:border-slate-800">
                <td className="p-3">{row[0]}</td>
                <td className="p-3">{row[1]}</td>
                <td className="p-3">{row[2]}</td>
                <td className={`p-3 font-semibold ${statusClass[row[3]] || "text-slate-300"}`}>{row[3]}</td>
                <td className="p-3">{row[3] === "failed" ? "Auto retry queued" : "-"}</td>
                <td className="p-3 text-right">
                  <button className="rounded px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800">Edit</button>
                  <button className="rounded px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800">Reschedule</button>
                  <button className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
