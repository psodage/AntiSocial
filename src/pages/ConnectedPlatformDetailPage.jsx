import { Link, useNavigate, useParams } from "react-router-dom";
import { useMemo } from "react";
import { AlertCircle, Building2, CheckCircle2, Sparkles, User, Video } from "lucide-react";
import { useApp } from "../context/AppContext";
import { PLATFORM_CAPABILITY_MATRIX, SOCIAL_PLATFORM_CONFIGS } from "../data/socialPlatforms";
import { buildPostingTargetsConfig } from "../utils/connectedPlatformPostingTargets";

function formatPlatformLabel(platformKey) {
  const config = SOCIAL_PLATFORM_CONFIGS.find((platform) => platform.key === platformKey);
  return config?.label || platformKey;
}

function TargetBadge({ badge }) {
  if (badge === "profile") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <User size={12} className="text-sky-400" aria-hidden />
        Profile
      </span>
    );
  }
  if (badge === "page" || badge === "organization") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <Building2 size={12} className="text-amber-400" aria-hidden />
        {badge === "organization" ? "Business" : "Page"}
      </span>
    );
  }
  if (badge === "channel") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <Video size={12} className="text-rose-400" aria-hidden />
        Channel
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
      <Sparkles size={12} className="text-violet-400" aria-hidden />
      Account
    </span>
  );
}

export default function ConnectedPlatformDetailPage() {
  const { platformKey } = useParams();
  const { connectedAccounts } = useApp();
  const navigate = useNavigate();

  const account = useMemo(
    () => connectedAccounts.find((item) => item.platform === platformKey),
    [connectedAccounts, platformKey]
  );

  const platformConfig = SOCIAL_PLATFORM_CONFIGS.find((platform) => platform.key === platformKey);
  const label = formatPlatformLabel(platformKey);
  const capabilities = account?.capabilities?.length ? account.capabilities : PLATFORM_CAPABILITY_MATRIX[platformKey]?.badges || [];

  const postingTargets = useMemo(() => buildPostingTargetsConfig(platformKey, account), [platformKey, account]);

  const linkedInOrgCount = useMemo(() => {
    if (platformKey !== "linkedin" || !Array.isArray(account?.entities)) return 0;
    return account.entities.filter((entity) => entity.entityType === "organization").length;
  }, [platformKey, account?.entities]);

  const facebookPageOnlyCount = useMemo(() => {
    if (platformKey !== "facebook" || !postingTargets?.cards?.length) return 0;
    return postingTargets.cards.filter((c) => c.badge === "page").length;
  }, [platformKey, postingTargets?.cards]);

  if (!platformConfig) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold">Unknown platform.</p>
        <Link to="/connected-platforms" className="mt-3 inline-block text-sm text-brand-500 hover:text-brand-600">
          Back to Connected Platforms
        </Link>
      </section>
    );
  }

  if (!account?.isConnected) {
    return (
      <section className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/70 p-6">
        <div className="flex items-center gap-2 text-slate-200">
          <AlertCircle size={18} />
          <h1 className="text-lg font-semibold">{label} is not connected</h1>
        </div>
        <p className="text-sm text-slate-400">Connect this platform first from the Connected Platforms page.</p>
        <Link to="/connected-platforms" className="inline-block rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          Go to Connected Platforms
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <article className="rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-900/90 via-slate-900 to-blue-950/60 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">{label} Details</h1>
            <p className="mt-1 text-sm text-slate-300">Connection details, account identity, and sync metadata for this platform.</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
            <CheckCircle2 size={14} />
            Connected
          </span>
        </div>
      </article>

      <article className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold text-white">Account</h2>
        <div className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
          <p>
            <span className="text-slate-400">Name:</span> {account.accountName || account.username || "N/A"}
          </p>
          <p>
            <span className="text-slate-400">Platform User ID:</span> {account.platformUserId || "N/A"}
          </p>
          <p>
            <span className="text-slate-400">Entity Type:</span> {account.entityType || "N/A"}
          </p>
          <p>
            <span className="text-slate-400">Last Sync:</span> {account.lastSyncedAt ? new Date(account.lastSyncedAt).toLocaleString() : "N/A"}
          </p>
          {postingTargets ? (
            <p>
              <span className="text-slate-400">Posting targets:</span> {postingTargets.cards.length}
            </p>
          ) : null}
          {platformKey === "facebook" ? (
            <p>
              <span className="text-slate-400">Facebook Pages (excl. profile):</span> {facebookPageOnlyCount}
            </p>
          ) : null}
          {platformKey === "linkedin" ? (
            <p>
              <span className="text-slate-400">Company pages:</span> {linkedInOrgCount}
            </p>
          ) : null}
        </div>
      </article>

      {postingTargets ? (
        <article className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">{postingTargets.title}</h2>
              <p className="mt-1 text-xs text-slate-400">{postingTargets.description}</p>
            </div>
            {postingTargets.primaryCtaPath ? (
              <button
                type="button"
                onClick={() => navigate(postingTargets.primaryCtaPath)}
                className="shrink-0 rounded-md bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600"
              >
                {postingTargets.primaryCtaLabel || "Create post"}
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {postingTargets.cards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => navigate(card.path)}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-600/80 bg-slate-950/50 text-left shadow-lg shadow-slate-950/40 ring-1 ring-slate-700/50 transition hover:border-blue-500/50 hover:ring-blue-500/30"
              >
                <div className="flex items-start gap-4 p-4">
                  <img src={card.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-slate-600 object-cover" />
                  <div className="min-w-0 flex-1">
                    <TargetBadge badge={card.badge} />
                    <p className="mt-2 truncate text-base font-semibold text-slate-50">{card.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{card.sublabel}</p>
                  </div>
                </div>
                <div className="border-t border-slate-700/80 bg-slate-900/40 px-4 py-3 text-xs font-medium text-sky-300 group-hover:text-sky-200">
                  Create post as this target →
                </div>
              </button>
            ))}
          </div>

          {postingTargets.emptyBanner ? (
            <div
              className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
                postingTargets.emptyBanner.tone === "amber"
                  ? "border-amber-500/30 bg-amber-500/5 text-amber-100/90"
                  : "border-slate-600 bg-slate-950/40 text-slate-400"
              }`}
            >
              {postingTargets.emptyBanner.text}
            </div>
          ) : null}
        </article>
      ) : null}

      <article className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold text-white">Capabilities</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {capabilities.length ? (
            capabilities.map((badge) => (
              <span key={badge} className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300">
                {badge}
              </span>
            ))
          ) : (
            <p className="text-sm text-slate-400">No capabilities reported.</p>
          )}
        </div>
      </article>
    </section>
  );
}
