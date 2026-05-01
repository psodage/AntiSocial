import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { PLATFORM_CAPABILITY_MATRIX, SOCIAL_PLATFORM_CONFIGS } from "../data/socialPlatforms";

function formatPlatformLabel(platformKey) {
  const config = SOCIAL_PLATFORM_CONFIGS.find((platform) => platform.key === platformKey);
  return config?.label || platformKey;
}

export default function ConnectedPlatformDetailPage() {
  const { platformKey } = useParams();
  const { connectedAccounts } = useApp();

  const account = useMemo(
    () => connectedAccounts.find((item) => item.platform === platformKey),
    [connectedAccounts, platformKey]
  );

  const platformConfig = SOCIAL_PLATFORM_CONFIGS.find((platform) => platform.key === platformKey);
  const label = formatPlatformLabel(platformKey);
  const capabilities = account?.capabilities?.length ? account.capabilities : PLATFORM_CAPABILITY_MATRIX[platformKey]?.badges || [];
  const facebookPages =
    platformKey === "facebook" ? (Array.isArray(account?.entities) ? account.entities : []).filter((entity) => entity.entityType === "page") : [];

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
          {platformKey === "facebook" ? (
            <p>
              <span className="text-slate-400">Facebook Pages Available:</span> {facebookPages.length}
            </p>
          ) : null}
        </div>
      </article>

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
