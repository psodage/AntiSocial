import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgeCheck,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Eye,
  HeartPulse,
  Megaphone,
  MousePointerClick,
  Sparkles,
  Users,
} from "lucide-react";

const GLASS_CARD =
  "rounded-2xl border border-white/15 bg-white/[0.06] p-4 shadow-[0_8px_30px_rgba(2,6,23,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]";

const analyticsSeries = [
  { date: "Apr 01", instagram: 4200, facebook: 3800, linkedin: 2100, youtube: 3300, x: 1900, threads: 1100 },
  { date: "Apr 04", instagram: 5200, facebook: 4600, linkedin: 2500, youtube: 3900, x: 2200, threads: 1300 },
  { date: "Apr 07", instagram: 6000, facebook: 5000, linkedin: 2900, youtube: 4300, x: 2600, threads: 1800 },
  { date: "Apr 10", instagram: 6800, facebook: 5300, linkedin: 3200, youtube: 4700, x: 2900, threads: 2200 },
  { date: "Apr 13", instagram: 7300, facebook: 5900, linkedin: 3600, youtube: 5100, x: 3300, threads: 2600 },
  { date: "Apr 16", instagram: 7600, facebook: 6200, linkedin: 3900, youtube: 5400, x: 3600, threads: 2900 },
];

const audienceSplit = [
  { name: "Male", value: 54, color: "#60a5fa" },
  { name: "Female", value: 41, color: "#a78bfa" },
  { name: "Other", value: 5, color: "#34d399" },
];

const topCountries = [
  { country: "India", audience: 38 },
  { country: "USA", audience: 24 },
  { country: "UK", audience: 12 },
  { country: "UAE", audience: 9 },
  { country: "Canada", audience: 7 },
];

const chartTabs = ["Reach", "Followers Growth", "Engagement", "Clicks", "Conversions"];
const platformLines = ["instagram", "facebook", "linkedin", "youtube", "x", "threads"];
const lineColors = ["#60a5fa", "#818cf8", "#22d3ee", "#f59e0b", "#f472b6", "#34d399"];

const getTrendData = (base) => Array.from({ length: 9 }, (_, i) => base + Math.round(Math.sin(i * 0.8) * 5) + i * 2);

const kpis = [
  { label: "Total Followers", value: "1.24M", change: "+5.9%", icon: Users, platform: "All", spark: getTrendData(60) },
  { label: "Total Reach", value: "8.67M", change: "+8.2%", icon: Megaphone, platform: "All", spark: getTrendData(52) },
  { label: "Total Impressions", value: "24.1M", change: "+6.6%", icon: Eye, platform: "All", spark: getTrendData(48) },
  { label: "Engagement Rate", value: "6.8%", change: "+1.1%", icon: HeartPulse, platform: "Avg", spark: getTrendData(39) },
  { label: "Scheduled This Month", value: "147", change: "+12.3%", icon: CalendarDays, platform: "All", spark: getTrendData(28) },
  { label: "Click Through Rate", value: "4.6%", change: "-0.4%", icon: MousePointerClick, platform: "All", spark: getTrendData(33) },
  { label: "Leads Generated", value: "3,280", change: "+10.8%", icon: BadgeCheck, platform: "CRM", spark: getTrendData(42) },
  { label: "Revenue from Campaigns", value: "$192,430", change: "+7.4%", icon: CircleDollarSign, platform: "Paid", spark: getTrendData(45) },
];

const platformCards = [
  { name: "Instagram", followers: "402K", growth: "+4.8%", engagement: "7.4%", best: "Spring Reel #9", synced: "5m ago" },
  { name: "Facebook", followers: "276K", growth: "+2.1%", engagement: "4.8%", best: "Founder AMA Clip", synced: "12m ago" },
  { name: "LinkedIn", followers: "184K", growth: "+3.3%", engagement: "5.6%", best: "B2B Carousel", synced: "9m ago" },
  { name: "YouTube", followers: "129K", growth: "+6.7%", engagement: "8.2%", best: "AI Workflow Demo", synced: "20m ago" },
  { name: "X (Twitter)", followers: "143K", growth: "+1.2%", engagement: "3.8%", best: "Launch Thread", synced: "7m ago" },
  { name: "Threads", followers: "106K", growth: "+4.1%", engagement: "6.1%", best: "Product Poll", synced: "14m ago" },
];

const topPosts = [
  { thumb: "IG", platform: "Instagram", date: "Apr 17", likes: 12650, comments: 808, shares: 511, reach: "318K", ctr: "5.2%" },
  { thumb: "LI", platform: "LinkedIn", date: "Apr 15", likes: 7380, comments: 488, shares: 269, reach: "182K", ctr: "4.6%" },
  { thumb: "YT", platform: "YouTube", date: "Apr 14", likes: 14920, comments: 1098, shares: 744, reach: "401K", ctr: "6.1%" },
  { thumb: "FB", platform: "Facebook", date: "Apr 12", likes: 6845, comments: 392, shares: 321, reach: "170K", ctr: "3.9%" },
  { thumb: "X", platform: "X (Twitter)", date: "Apr 10", likes: 5210, comments: 280, shares: 402, reach: "142K", ctr: "3.6%" },
];

const calendarPreview = [
  { day: 2, events: ["ig"] },
  { day: 4, events: ["li", "yt"] },
  { day: 8, events: ["fb"] },
  { day: 11, events: ["x", "ig"] },
  { day: 15, events: ["campaign"] },
  { day: 18, events: ["threads"] },
  { day: 22, events: ["yt", "ig"] },
  { day: 26, events: ["draft"] },
];

const activities = [
  "Post published on Instagram",
  "Campaign paused for YouTube Ads",
  "LinkedIn account synced successfully",
  "New comment received on reel",
  "Team member scheduled 3 posts",
];

const eventColors = {
  ig: "bg-pink-400",
  li: "bg-blue-400",
  yt: "bg-red-400",
  fb: "bg-sky-400",
  x: "bg-slate-200",
  threads: "bg-violet-400",
  campaign: "bg-emerald-400",
  draft: "bg-amber-400",
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("Reach");

  const chartData = useMemo(() => {
    const multiplier = activeTab === "Reach" ? 1 : activeTab === "Followers Growth" ? 0.72 : activeTab === "Engagement" ? 0.54 : activeTab === "Clicks" ? 0.4 : 0.28;
    return analyticsSeries.map((point) => ({
      ...point,
      instagram: Math.round(point.instagram * multiplier),
      facebook: Math.round(point.facebook * multiplier),
      linkedin: Math.round(point.linkedin * multiplier),
      youtube: Math.round(point.youtube * multiplier),
      x: Math.round(point.x * multiplier),
      threads: Math.round(point.threads * multiplier),
    }));
  }, [activeTab]);

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/70 p-4 md:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((item, index) => (
            <motion.article
              key={item.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.25 }}
              className={`${GLASS_CARD} transition hover:-translate-y-1`}
            >
              <div className="mb-2 flex items-center justify-between text-slate-300">
                <item.icon size={17} />
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold">{item.platform}</span>
              </div>
              <p className="text-xs uppercase tracking-wide text-slate-400">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-100">{item.value}</p>
              <p className={`mt-1 text-xs font-semibold ${item.change.startsWith("-") ? "text-rose-300" : "text-emerald-300"}`}>{item.change} vs last period</p>
              <div className="mt-3 h-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={item.spark.map((value, dataIndex) => ({ value, dataIndex }))}>
                    <Area type="monotone" dataKey="value" stroke="#60a5fa" fill="rgba(96,165,250,0.18)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.article>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {platformCards.map((platform) => (
          <article key={platform.name} className={GLASS_CARD}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">{platform.name}</h3>
              <span className="text-xs text-emerald-300">{platform.growth}</span>
            </div>
            <p className="text-2xl font-bold text-white">{platform.followers}</p>
            <p className="mt-1 text-xs text-slate-300">Engagement {platform.engagement}</p>
            <p className="mt-3 text-xs text-slate-400">Best post: <span className="text-slate-200">{platform.best}</span></p>
            <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
              <Clock3 size={12} /> Last synced {platform.synced}
            </p>
          </article>
        ))}
      </div>

      <article className={GLASS_CARD}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-white">Performance Analytics</h2>
          <div className="flex flex-wrap gap-2">
            {chartTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${activeTab === tab ? "bg-brand-500 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "12px" }} />
              {platformLines.map((line, lineIndex) => (
                <Line key={line} type="monotone" dataKey={line} stroke={lineColors[lineIndex]} strokeWidth={2.4} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className={GLASS_CARD}>
          <h3 className="mb-3 text-sm font-semibold text-slate-100">Audience Gender Split</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={audienceSplit} dataKey="value" nameKey="name" innerRadius={70} outerRadius={95} paddingAngle={3}>
                  {audienceSplit.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className={GLASS_CARD}>
          <h3 className="mb-3 text-sm font-semibold text-slate-100">Top Audience Countries</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCountries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="country" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "12px" }} />
                <Bar dataKey="audience" radius={[7, 7, 0, 0]} fill="#818cf8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <article className={GLASS_CARD}>
        <h3 className="mb-3 text-sm font-semibold text-slate-100">Best Performing Content</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-2">Post</th>
                <th className="pb-2">Platform</th>
                <th className="pb-2">Date</th>
                <th className="pb-2">Likes</th>
                <th className="pb-2">Comments</th>
                <th className="pb-2">Shares</th>
                <th className="pb-2">Reach</th>
                <th className="pb-2">CTR</th>
              </tr>
            </thead>
            <tbody>
              {topPosts.map((post) => (
                <tr key={`${post.platform}-${post.date}`} className="border-t border-white/10 text-slate-200">
                  <td className="py-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-xs font-bold">{post.thumb}</span>
                  </td>
                  <td className="py-2">{post.platform}</td>
                  <td className="py-2">{post.date}</td>
                  <td className="py-2">{post.likes.toLocaleString()}</td>
                  <td className="py-2">{post.comments.toLocaleString()}</td>
                  <td className="py-2">{post.shares.toLocaleString()}</td>
                  <td className="py-2">{post.reach}</td>
                  <td className="py-2 text-emerald-300">{post.ctr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className={`${GLASS_CARD} lg:col-span-1`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">Content Calendar</h3>
            <CalendarDays size={15} className="text-slate-300" />
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs">
            {Array.from({ length: 30 }, (_, index) => {
              const day = index + 1;
              const entry = calendarPreview.find((item) => item.day === day);
              return (
                <div key={day} className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300">
                  <p>{day}</p>
                  <div className="mt-1 flex flex-wrap justify-center gap-1">
                    {entry?.events.map((event) => (
                      <span key={`${day}-${event}`} className={`h-1.5 w-1.5 rounded-full ${eventColors[event]}`} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className={`${GLASS_CARD} bg-gradient-to-br from-indigo-500/30 to-blue-500/10 lg:col-span-1`}>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-200" />
            <h3 className="text-sm font-semibold text-white">AI Recommendations</h3>
          </div>
          <ul className="space-y-2 text-sm text-slate-100">
            <li>Instagram engagement is highest at 8 PM.</li>
            <li>LinkedIn performs better on weekdays.</li>
            <li>Reels are gaining 32% more reach this month.</li>
            <li>Schedule 5 more posts this week for target velocity.</li>
          </ul>
        </article>

        <article className={`${GLASS_CARD} lg:col-span-1`}>
          <h3 className="mb-3 text-sm font-semibold text-slate-100">Recent Activities</h3>
          <div className="space-y-3">
            {activities.map((activity, index) => (
              <div key={activity} className="flex items-start gap-3 text-sm">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-400" />
                <p className="text-slate-200">{activity}</p>
                <span className="ml-auto text-xs text-slate-400">{index + 1}h ago</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
