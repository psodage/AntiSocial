import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Bookmark,
  CircleDollarSign,
  Clock3,
  Eye,
  Film,
  HandCoins,
  Heart,
  Link2,
  MessageSquare,
  MousePointerClick,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

const GLASS_CARD =
  "rounded-2xl border border-white/15 bg-white/[0.06] p-4 shadow-[0_10px_36px_rgba(2,6,23,0.42)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]";

const platformOrder = ["all", "instagram", "facebook", "youtube", "linkedin", "twitter", "threads"];
const platformTabs = [
  { key: "all", label: "All Platforms", color: "#60a5fa" },
  { key: "instagram", label: "Instagram", color: "#f472b6" },
  { key: "facebook", label: "Facebook", color: "#60a5fa" },
  { key: "youtube", label: "YouTube", color: "#ef4444" },
  { key: "linkedin", label: "LinkedIn", color: "#38bdf8" },
  { key: "twitter", label: "X", color: "#cbd5e1" },
  { key: "threads", label: "Threads", color: "#a78bfa" },
];

const timeline = [
  "Instagram synced 5 min ago",
  "YouTube subscribers +42 today",
  "LinkedIn post gained 2.1k reach",
  "Facebook campaign CTR improved",
];

const aiInsights = [
  "Instagram reels outperform static posts by 38%",
  "YouTube Shorts gaining fastest growth momentum this week",
  "LinkedIn performs best Tue-Thu mornings for B2B audience",
  "Facebook CTR dropped 12%, test new creatives this cycle",
];

const platformOverview = [
  { platform: "Instagram", followers: 402000, reach: 1240000, engagement: 7.4, revenue: 29500, color: "#f472b6" },
  { platform: "Facebook", followers: 276000, reach: 930000, engagement: 4.8, revenue: 21400, color: "#60a5fa" },
  { platform: "YouTube", followers: 129000, reach: 1180000, engagement: 8.2, revenue: 36100, color: "#ef4444" },
  { platform: "LinkedIn", followers: 184000, reach: 670000, engagement: 5.6, revenue: 27800, color: "#38bdf8" },
  { platform: "X", followers: 143000, reach: 490000, engagement: 3.8, revenue: 9400, color: "#cbd5e1" },
  { platform: "Threads", followers: 106000, reach: 420000, engagement: 6.1, revenue: 8800, color: "#a78bfa" },
];

const mockAnalytics = {
  instagram: {
    connected: true,
    metrics: [
      { label: "Followers", value: 402000, growth: "+4.8%", icon: Users },
      { label: "Reach", value: 1240000, growth: "+8.4%", icon: Eye },
      { label: "Impressions", value: 2320000, growth: "+7.9%", icon: BarChart3 },
      { label: "Story Views", value: 461000, growth: "+6.3%", icon: Eye },
      { label: "Reel Plays", value: 1390000, growth: "+12.6%", icon: Film },
      { label: "Saves", value: 78400, growth: "+11.2%", icon: Bookmark },
      { label: "Profile Visits", value: 95300, growth: "+5.1%", icon: TrendingUp },
      { label: "Engagement %", value: 7.4, growth: "+0.8%", icon: Heart, suffix: "%" },
    ],
    lineData: [
      { label: "W1", value: 381000 },
      { label: "W2", value: 389000 },
      { label: "W3", value: 395000 },
      { label: "W4", value: 402000 },
    ],
    barData: [
      { label: "Reel 1", value: 188000 },
      { label: "Reel 2", value: 212000 },
      { label: "Reel 3", value: 164000 },
      { label: "Reel 4", value: 236000 },
      { label: "Reel 5", value: 205000 },
    ],
    heatmap: [
      { day: "Mon", values: [32, 41, 57, 46, 29, 18] },
      { day: "Tue", values: [27, 35, 62, 58, 33, 20] },
      { day: "Wed", values: [34, 44, 71, 63, 39, 24] },
      { day: "Thu", values: [36, 49, 69, 61, 41, 25] },
      { day: "Fri", values: [28, 40, 59, 52, 35, 19] },
    ],
    tableColumns: ["thumbnail", "likes", "comments", "saves", "reach"],
    topContent: [
      { thumbnail: "IG-01", likes: 12800, comments: 940, saves: 3400, reach: 219000 },
      { thumbnail: "IG-02", likes: 11600, comments: 860, saves: 2910, reach: 201000 },
      { thumbnail: "IG-03", likes: 10900, comments: 788, saves: 2760, reach: 194000 },
      { thumbnail: "IG-04", likes: 10240, comments: 721, saves: 2480, reach: 181000 },
      { thumbnail: "IG-05", likes: 9710, comments: 690, saves: 2275, reach: 174000 },
    ],
  },
  facebook: {
    connected: true,
    metrics: [
      { label: "Page Likes", value: 276000, growth: "+2.1%", icon: Users },
      { label: "Reach", value: 930000, growth: "+3.9%", icon: Eye },
      { label: "Shares", value: 28600, growth: "+2.8%", icon: TrendingUp },
      { label: "Link Clicks", value: 71400, growth: "+1.7%", icon: Link2 },
      { label: "Comments", value: 23400, growth: "+2.4%", icon: MessageSquare },
      { label: "Video Views", value: 388000, growth: "+4.5%", icon: Film },
    ],
    lineData: [
      { label: "W1", value: 840000 },
      { label: "W2", value: 861000 },
      { label: "W3", value: 901000 },
      { label: "W4", value: 930000 },
    ],
    barData: [
      { label: "Awareness", value: 46 },
      { label: "Traffic", value: 72 },
      { label: "Lead Gen", value: 58 },
      { label: "Retarget", value: 64 },
    ],
    pieData: [
      { name: "18-24", value: 21, color: "#60a5fa" },
      { name: "25-34", value: 34, color: "#818cf8" },
      { name: "35-44", value: 27, color: "#22d3ee" },
      { name: "45+", value: 18, color: "#f59e0b" },
    ],
  },
  youtube: {
    connected: true,
    metrics: [
      { label: "Subscribers", value: 129000, growth: "+6.7%", icon: Users },
      { label: "Total Views", value: 4620000, growth: "+9.4%", icon: Eye },
      { label: "Watch Time", value: 193000, growth: "+8.1%", icon: Clock3, suffix: " hrs" },
      { label: "Avg View Duration", value: 6.8, growth: "+4.2%", icon: TrendingUp, suffix: " min" },
      { label: "CTR", value: 5.9, growth: "+0.6%", icon: MousePointerClick, suffix: "%" },
      { label: "Shorts Views", value: 1290000, growth: "+12.9%", icon: Film },
    ],
    lineData: [
      { label: "W1", value: 118000 },
      { label: "W2", value: 122500 },
      { label: "W3", value: 126000 },
      { label: "W4", value: 129000 },
    ],
    barData: [
      { label: "Automation Guide", value: 430000 },
      { label: "5 AI Tactics", value: 396000 },
      { label: "Shorts Funnel", value: 372000 },
      { label: "Case Study", value: 324000 },
    ],
    areaData: [
      { label: "0-15s", value: 100 },
      { label: "15-30s", value: 88 },
      { label: "30-45s", value: 76 },
      { label: "45-60s", value: 65 },
      { label: "60-90s", value: 54 },
      { label: "90s+", value: 39 },
    ],
    tableColumns: ["thumbnail", "views", "watchTime", "likes"],
    topContent: [
      { thumbnail: "YT-01", views: 430000, watchTime: "18.2k hrs", likes: 19800 },
      { thumbnail: "YT-02", views: 396000, watchTime: "16.8k hrs", likes: 17600 },
      { thumbnail: "YT-03", views: 372000, watchTime: "15.7k hrs", likes: 16420 },
      { thumbnail: "YT-04", views: 324000, watchTime: "13.5k hrs", likes: 14080 },
      { thumbnail: "YT-05", views: 289000, watchTime: "12.6k hrs", likes: 13110 },
    ],
  },
  linkedin: {
    connected: true,
    metrics: [
      { label: "Followers", value: 184000, growth: "+3.3%", icon: Users },
      { label: "Post Reach", value: 670000, growth: "+4.4%", icon: Eye },
      { label: "Impressions", value: 1330000, growth: "+5.1%", icon: BarChart3 },
      { label: "CTR", value: 4.3, growth: "+0.3%", icon: MousePointerClick, suffix: "%" },
      { label: "Leads Generated", value: 1820, growth: "+7.4%", icon: HandCoins },
      { label: "Profile Visits", value: 28400, growth: "+4.1%", icon: TrendingUp },
    ],
    lineData: [
      { label: "W1", value: 520000 },
      { label: "W2", value: 563000 },
      { label: "W3", value: 611000 },
      { label: "W4", value: 670000 },
    ],
    barData: [
      { label: "W1", value: 390 },
      { label: "W2", value: 420 },
      { label: "W3", value: 472 },
      { label: "W4", value: 538 },
    ],
    pieData: [
      { name: "Carousels", value: 38, color: "#38bdf8" },
      { name: "Thought Leadership", value: 27, color: "#a78bfa" },
      { name: "Case Studies", value: 22, color: "#22d3ee" },
      { name: "Video", value: 13, color: "#f59e0b" },
    ],
  },
  twitter: {
    connected: true,
    metrics: [
      { label: "Followers", value: 143000, growth: "+1.2%", icon: Users },
      { label: "Impressions", value: 490000, growth: "+2.1%", icon: Eye },
      { label: "Retweets", value: 18200, growth: "+1.5%", icon: TrendingUp },
      { label: "Replies", value: 8400, growth: "+2.2%", icon: MessageSquare },
      { label: "Mentions", value: 5100, growth: "+3.4%", icon: Link2 },
      { label: "Profile Visits", value: 17600, growth: "+1.8%", icon: Users },
    ],
    lineData: [
      { label: "W1", value: 12000 },
      { label: "W2", value: 14100 },
      { label: "W3", value: 13600 },
      { label: "W4", value: 15200 },
    ],
    barData: [
      { label: "#SaaS", value: 33 },
      { label: "#Marketing", value: 48 },
      { label: "#Creator", value: 29 },
      { label: "#SocialMedia", value: 52 },
      { label: "#Growth", value: 44 },
    ],
    areaData: [
      { label: "W1", value: 3800 },
      { label: "W2", value: 4300 },
      { label: "W3", value: 4780 },
      { label: "W4", value: 5100 },
    ],
  },
  threads: {
    connected: false,
    metrics: [
      { label: "Followers", value: 106000, growth: "+4.1%", icon: Users },
      { label: "Reach", value: 420000, growth: "+5.6%", icon: Eye },
      { label: "Replies", value: 6200, growth: "+3.1%", icon: MessageSquare },
      { label: "Shares", value: 4800, growth: "+4.2%", icon: TrendingUp },
      { label: "Growth %", value: 4.1, growth: "+0.9%", icon: TrendingUp, suffix: "%" },
      { label: "Viral Posts", value: 26, growth: "+8.0%", icon: Sparkles },
    ],
    lineData: [
      { label: "W1", value: 86000 },
      { label: "W2", value: 93000 },
      { label: "W3", value: 99000 },
      { label: "W4", value: 106000 },
    ],
    barData: [
      { label: "Thread A", value: 128000 },
      { label: "Thread B", value: 116000 },
      { label: "Thread C", value: 102000 },
      { label: "Thread D", value: 97000 },
    ],
    areaData: [
      { label: "W1", value: 82000 },
      { label: "W2", value: 88000 },
      { label: "W3", value: 93000 },
      { label: "W4", value: 106000 },
    ],
  },
};

function formatMetric(value) {
  if (typeof value !== "number") return value;
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

function AnimatedNumber({ value, prefix = "", suffix = "" }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 800;
    const step = value / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  return <span>{prefix}{formatMetric(Math.round(displayValue))}{suffix}</span>;
}

function PlatformTabs({ selected, onSelect }) {
  const visibleTabs = platformTabs.filter((platform) => platform.key === "all" || mockAnalytics[platform.key]?.connected);

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-2xl border border-white/10 bg-slate-950/40 p-2">
        {visibleTabs.map((platform) => (
          <button
            key={platform.key}
            onClick={() => onSelect(platform.key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              selected === platform.key
                ? "bg-gradient-to-r from-indigo-500/80 to-blue-500/80 text-white shadow-lg"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {platform.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ item, color = "#60a5fa" }) {
  const Icon = item.icon;
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={`${GLASS_CARD} transition hover:-translate-y-1`}
    >
      <div className="mb-2 flex items-center justify-between">
        <Icon size={17} className="text-slate-200" />
        <span className={`text-xs font-semibold ${item.growth.startsWith("-") ? "text-rose-300" : "text-emerald-300"}`}>{item.growth}</span>
      </div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{item.label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">
        <AnimatedNumber value={Number(item.value)} prefix={item.prefix || ""} suffix={item.suffix || ""} />
      </p>
      <div className="mt-3 h-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={[24, 30, 26, 36, 31, 40].map((v, i) => ({ i, v }))}>
            <Area type="monotone" dataKey="v" stroke={color} fill={`${color}33`} strokeWidth={2.2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.article>
  );
}

function GrowthChart({ title, data, dataKey, color = "#60a5fa", chart = "line" }) {
  return (
    <article className={GLASS_CARD}>
      <h3 className="mb-3 text-sm font-semibold text-slate-100">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {chart === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "12px" }} />
              <Bar dataKey={dataKey} fill={color} radius={[8, 8, 0, 0]} />
            </BarChart>
          ) : chart === "area" ? (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "12px" }} />
              <Area type="monotone" dataKey={dataKey} stroke={color} fill={`${color}33`} strokeWidth={2.4} />
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "12px" }} />
              <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.7} dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function TopContentTable({ title, columns, rows }) {
  return (
    <article className={GLASS_CARD}>
      <h3 className="mb-3 text-sm font-semibold text-slate-100">{title}</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-400">
            <tr>
              {columns.map((col) => (
                <th key={col} className="pb-2">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-t border-white/10 text-slate-200">
                {columns.map((col) => (
                  <td key={`${idx}-${col}`} className="py-2">
                    {typeof row[col] === "number" ? row[col].toLocaleString() : row[col]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function ComparePlatformsChart() {
  const connectedOverview = platformOverview.filter((entry) => {
    const key = entry.platform.toLowerCase() === "x" ? "twitter" : entry.platform.toLowerCase();
    return mockAnalytics[key]?.connected;
  });

  const radarData = connectedOverview.map((entry) => ({
    platform: entry.platform,
    followers: Math.round(entry.followers / 5000),
    reach: Math.round(entry.reach / 10000),
    engagement: Math.round(entry.engagement * 10),
    revenue: Math.round(entry.revenue / 300),
  }));

  return (
    <article className={GLASS_CARD}>
      <h3 className="mb-3 text-sm font-semibold text-white">Compare Platforms</h3>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={connectedOverview}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="platform" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "12px" }} />
              <Legend />
              <Bar dataKey="followers" fill="#60a5fa" radius={[8, 8, 0, 0]} />
              <Bar dataKey="reach" fill="#a78bfa" radius={[8, 8, 0, 0]} />
              <Bar dataKey="revenue" fill="#34d399" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "12px" }} />
              <Radar name="Platform Score" dataKey="reach" stroke="#818cf8" fill="#818cf8" fillOpacity={0.3} />
              <Radar name="Engagement Score" dataKey="engagement" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-200">
        Best platform this month: <span className="font-semibold">YouTube</span> (highest engagement and revenue efficiency)
      </div>
    </article>
  );
}

function AIInsightCard() {
  return (
    <article className={`${GLASS_CARD} bg-gradient-to-br from-indigo-500/30 to-blue-500/10`}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <Sparkles size={15} className="text-indigo-200" />
        AI Recommendations
      </h3>
      <ul className="space-y-2 text-sm text-slate-100">
        {aiInsights.map((insight) => (
          <li key={insight} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            {insight}
          </li>
        ))}
      </ul>
    </article>
  );
}

function ExportButtons() {
  return (
    <article className={GLASS_CARD}>
      <h3 className="mb-3 text-sm font-semibold text-white">Export Reports</h3>
      <div className="flex flex-wrap gap-2">
        {["Export PDF", "Export CSV", "Schedule Weekly Report"].map((label) => (
          <button
            key={label}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/10"
          >
            {label}
          </button>
        ))}
      </div>
    </article>
  );
}

function BestPostingHeatmap({ data }) {
  return (
    <article className={GLASS_CARD}>
      <h3 className="mb-3 text-sm font-semibold text-slate-100">Best Posting Time Heatmap</h3>
      <div className="space-y-2">
        {data.map((row) => (
          <div key={row.day} className="grid grid-cols-[64px_repeat(6,minmax(0,1fr))] items-center gap-2">
            <span className="text-xs text-slate-400">{row.day}</span>
            {row.values.map((value, index) => (
              <div
                key={`${row.day}-${index}`}
                className="h-7 rounded-md"
                style={{ backgroundColor: `rgba(99,102,241,${Math.max(0.18, value / 100)})` }}
                title={`${value}%`}
              />
            ))}
          </div>
        ))}
      </div>
    </article>
  );
}

function PlatformSection({ platformKey }) {
  const data = mockAnalytics[platformKey];
  const tab = platformTabs.find((entry) => entry.key === platformKey);

  if (!data.connected) {
    return (
      <article className={`${GLASS_CARD} p-8 text-center`}>
        <p className="text-sm text-slate-300">Connect {tab.label} to view analytics</p>
      </article>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{tab.label} Analytics</h2>
        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">Platform-specific view</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} item={metric} color={tab.color} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GrowthChart
          title={
            platformKey === "instagram"
              ? "Followers Growth Line Chart"
              : platformKey === "facebook"
              ? "Reach Trend"
              : platformKey === "youtube"
              ? "Subscriber Growth"
              : platformKey === "linkedin"
              ? "B2B Engagement Trend"
              : platformKey === "twitter"
              ? "Tweet Engagement Trend"
              : "Threads Growth"
          }
          data={data.lineData}
          dataKey="value"
          color={tab.color}
          chart="line"
        />
        <GrowthChart
          title={
            platformKey === "instagram"
              ? "Reel Performance Bar Chart"
              : platformKey === "facebook"
              ? "Ad Campaign Performance"
              : platformKey === "youtube"
              ? "Top Video Performance"
              : platformKey === "linkedin"
              ? "Lead Generation Graph"
              : platformKey === "twitter"
              ? "Hashtag Performance"
              : "Best Performing Threads"
          }
          data={data.barData}
          dataKey="value"
          color={tab.color}
          chart="bar"
        />
      </div>

      {platformKey === "instagram" ? <BestPostingHeatmap data={data.heatmap} /> : null}

      {platformKey === "facebook" || platformKey === "linkedin" ? (
        <article className={GLASS_CARD}>
          <h3 className="mb-3 text-sm font-semibold text-slate-100">
            {platformKey === "facebook" ? "Audience Age Breakdown" : "Best Content Type Pie Chart"}
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.pieData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={95} paddingAngle={3}>
                  {data.pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      ) : null}

      {platformKey === "youtube" || platformKey === "twitter" || platformKey === "threads" ? (
        <GrowthChart
          title={platformKey === "youtube" ? "Retention Graph" : platformKey === "twitter" ? "Mention Growth" : "Audience Trend"}
          data={data.areaData}
          dataKey="value"
          color={tab.color}
          chart="area"
        />
      ) : null}

      {data.topContent ? (
        <TopContentTable
          title={platformKey === "youtube" ? "Top Videos" : "Top 5 posts"}
          columns={data.tableColumns}
          rows={data.topContent}
        />
      ) : null}
    </div>
  );
}

export default function AnalyticsPage() {
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [loading, setLoading] = useState(true);

  const connectedPlatformOverview = useMemo(
    () =>
      platformOverview.filter((entry) => {
        const key = entry.platform.toLowerCase() === "x" ? "twitter" : entry.platform.toLowerCase();
        return mockAnalytics[key]?.connected;
      }),
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 850);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (selectedPlatform === "all") return;
    if (!mockAnalytics[selectedPlatform]?.connected) {
      setSelectedPlatform("all");
    }
  }, [selectedPlatform]);

  const overviewKpis = useMemo(() => {
    const followers = connectedPlatformOverview.reduce((sum, item) => sum + item.followers, 0);
    const reach = connectedPlatformOverview.reduce((sum, item) => sum + item.reach, 0);
    const engagement =
      connectedPlatformOverview.reduce((sum, item) => sum + item.engagement, 0) / connectedPlatformOverview.length;
    const clicks = 482300;
    const ctr = 4.9;
    const revenue = connectedPlatformOverview.reduce((sum, item) => sum + item.revenue, 0);

    return [
      { label: "Total Followers", value: followers, growth: "+4.6%", icon: Users },
      { label: "Total Reach", value: reach, growth: "+6.3%", icon: Eye },
      { label: "Total Engagement", value: Number(engagement.toFixed(1)), growth: "+1.2%", icon: Heart, suffix: "%" },
      { label: "Avg CTR", value: ctr, growth: "+0.4%", icon: MousePointerClick, suffix: "%" },
      { label: "Total Clicks", value: clicks, growth: "+5.8%", icon: Link2 },
      { label: "Total Revenue", value: revenue, growth: "+7.1%", icon: CircleDollarSign, prefix: "$" },
    ];
  }, [connectedPlatformOverview]);

  return (
    <section className="space-y-5">
      <article className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/70 p-5">
        <h2 className="text-2xl font-semibold text-white">Analytics</h2>
        <p className="mt-1 text-sm text-slate-300">Track performance across every connected platform</p>
      </article>

      <PlatformTabs selected={selectedPlatform} onSelect={setSelectedPlatform} />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : null}

      {!loading && selectedPlatform === "all" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {overviewKpis.map((metric) => (
              <MetricCard key={metric.label} item={metric} />
            ))}
          </div>
          <ComparePlatformsChart />
          <div className="grid gap-4 xl:grid-cols-3">
            <AIInsightCard />
            <ExportButtons />
            <article className={GLASS_CARD}>
              <h3 className="mb-3 text-sm font-semibold text-white">Recent Analytics Events</h3>
              <div className="space-y-3">
                {timeline.map((event, index) => (
                  <div key={event} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-brand-400" />
                    <p className="text-slate-200">{event}</p>
                    <span className="ml-auto text-xs text-slate-400">{index + 2}m</span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {!loading && selectedPlatform !== "all" ? (
          <motion.div
            key={selectedPlatform}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <PlatformSection platformKey={selectedPlatform} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
