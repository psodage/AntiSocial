const MEDIA_OPTIONS = [
  { value: "", label: "All media types" },
  { value: "TEXT", label: "TEXT" },
  { value: "IMAGE", label: "IMAGE" },
  { value: "VIDEO", label: "VIDEO" },
  { value: "LINK", label: "LINK" },
  { value: "REEL", label: "REEL" },
  { value: "CAROUSEL", label: "CAROUSEL" },
  { value: "OFFER", label: "OFFER" },
  { value: "EVENT", label: "EVENT" },
];

/**
 * @param {{
 *   search: string,
 *   onSearchChange: (v: string) => void,
 *   mediaType: string,
 *   onMediaTypeChange: (v: string) => void,
 *   startDate: string,
 *   onStartDateChange: (v: string) => void,
 *   endDate: string,
 *   onEndDateChange: (v: string) => void,
 * }} props
 */
export default function PostHistoryFilters({
  search,
  onSearchChange,
  mediaType,
  onMediaTypeChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="block text-xs font-semibold text-slate-400">
        Search content
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Keyword…"
          className="mt-1 w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand-500"
        />
      </label>
      <label className="block text-xs font-semibold text-slate-400">
        Media type
        <select
          value={mediaType}
          onChange={(e) => onMediaTypeChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
        >
          {MEDIA_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-semibold text-slate-400">
        From date
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
        />
      </label>
      <label className="block text-xs font-semibold text-slate-400">
        To date
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
        />
      </label>
    </div>
  );
}
