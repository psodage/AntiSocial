import { Link, useNavigate, useParams } from "react-router-dom";
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
  const navigate = useNavigate();

  const account = useMemo(
    () => connectedAccounts.find((item) => item.platform === platformKey),
    [connectedAccounts, platformKey]
  );

  const platformConfig = SOCIAL_PLATFORM_CONFIGS.find((platform) => platform.key === platformKey);
  const label = formatPlatformLabel(platformKey);
  const capabilities = account?.capabilities?.length ? account.capabilities : PLATFORM_CAPABILITY_MATRIX[platformKey]?.badges || [];
  const facebookPages =
    platformKey === "facebook" ? (Array.isArray(account?.entities) ? account.entities : []).filter((entity) => entity.entityType === "page") : [];
  const linkedInOrganizations =
    platformKey === "linkedin"
      ? (Array.isArray(account?.entities) ? account.entities : []).filter((entity) => entity.entityType === "organization")
      : [];
  const linkedInOrgDiscoveryCode = platformKey === "linkedin" ? account?.metadata?.organizationDiscoveryErrorCode : null;

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
          {platformKey === "linkedin" ? (
            <p>
              <span className="text-slate-400">Company Pages Available:</span> {linkedInOrganizations.length}
            </p>
          ) : null}
        </div>
      </article>

      {platformKey === "linkedin" ? (
        <article className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Company Pages</h2>
              <p className="mt-1 text-xs text-slate-400">Select a page to publish as that organization.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/create-post?platform=linkedin")}
              className="rounded-md bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600"
            >
              Create post
            </button>
          </div>

          {!linkedInOrganizations.length ? (
            <p className="mt-3 text-sm text-slate-400">
              {linkedInOrgDiscoveryCode === "linkedin_orgs_forbidden"
                ? "LinkedIn would not return company pages for this token (often missing Community Management / organization APIs on your app, or the member is not an approved admin). Your personal profile connection is still saved; update the LinkedIn developer app products and scopes, then reconnect."
                : linkedInOrgDiscoveryCode === "linkedin_orgs_failed"
                  ? "Company pages could not be loaded from LinkedIn (temporary or configuration issue). Your profile connection is still saved; try reconnecting."
                  : "No LinkedIn company pages were found for this login. Ensure your LinkedIn app has the organization scopes and that your member is an admin of the page, then reconnect."}
            </p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {linkedInOrganizations.map((org) => (
                <button
                  key={org.entityId}
                  type="button"
                  onClick={() => navigate(`/create-post?platform=linkedin&entityId=${encodeURIComponent(org.entityId)}`)}
                  className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/40 p-3 text-left transition hover:border-blue-400/40"
                >
                  <img
                    src={org.profileImage || "https://placehold.co/80x80/0f172a/e2e8f0?text=LI"}
                    alt={org.name || "LinkedIn organization"}
                    className="h-10 w-10 rounded-lg border border-slate-700 object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{org.name || "Company page"}</p>
                    <p className="mt-0.5 text-xs text-slate-400">Click to create a post</p>
                  </div>
                </button>
              ))}
            </div>
          )}
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
