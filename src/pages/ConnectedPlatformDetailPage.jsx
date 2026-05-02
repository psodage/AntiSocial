import { Link, useNavigate, useParams } from "react-router-dom";
import { useMemo } from "react";
import { AlertCircle, Building2, CheckCircle2, User } from "lucide-react";
import { useApp } from "../context/AppContext";
import { PLATFORM_CAPABILITY_MATRIX, SOCIAL_PLATFORM_CONFIGS } from "../data/socialPlatforms";

function entityDisplayName(entity) {
  return entity?.accountName || entity?.name || entity?.username || "Untitled";
}

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
  /** Facebook pages live in `metadata.pages` after OAuth; unlike LinkedIn, page rows are not separate `entities` docs yet. */
  const facebookPagesList = useMemo(() => {
    if (platformKey !== "facebook" || !account) return [];
    const fromMetadata = Array.isArray(account.metadata?.pages) ? account.metadata.pages : [];
    if (fromMetadata.length) {
      return fromMetadata.filter((p) => p?.id).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    return (Array.isArray(account.entities) ? account.entities : []).filter((entity) => entity.entityType === "page");
  }, [platformKey, account]);

  const facebookPostingCards = useMemo(() => {
    if (platformKey !== "facebook" || !account) return [];
    const cards = [];
    const profileEntity =
      (Array.isArray(account.entities) ? account.entities : []).find((e) => e.entityType === "profile") || null;
    const profileRow = profileEntity || {
      entityId: account.entityId || account.platformUserId,
      accountName: account.accountName,
      username: account.username,
      profileImage: account.profileImage,
      entityType: "profile",
    };
    cards.push({
      key: `profile-${profileRow.entityId || account.platformUserId}`,
      variant: "profile",
      data: profileRow,
    });
    for (const page of facebookPagesList) {
      cards.push({
        key: `page-${page.id}`,
        variant: "page",
        data: {
          entityId: page.id,
          accountName: page.name || "Untitled page",
          username: "",
          profileImage: "",
          entityType: "page",
          hasLinkedInstagram: page.hasLinkedInstagram,
        },
      });
    }
    return cards;
  }, [platformKey, account, facebookPagesList]);

  const facebookPageDiscoveryCode = platformKey === "facebook" ? account?.metadata?.pageDiscoveryErrorCode : null;

  const linkedInOrganizations = useMemo(() => {
    if (platformKey !== "linkedin" || !Array.isArray(account?.entities)) return [];
    return account.entities.filter((entity) => entity.entityType === "organization");
  }, [platformKey, account?.entities]);

  const linkedInPostingCards = useMemo(() => {
    if (platformKey !== "linkedin" || !account) return [];
    const entities = Array.isArray(account.entities) ? account.entities : [];
    const profileRow =
      entities.find((e) => e.entityType === "profile") ||
      entities.find((e) => e.isPrimary && e.entityType !== "organization") ||
      null;
    const orgRows = entities
      .filter((e) => e.entityType === "organization")
      .sort((a, b) => entityDisplayName(a).localeCompare(entityDisplayName(b)));

    const cards = [];
    if (profileRow) {
      cards.push({ key: `profile-${profileRow.entityId || account.platformUserId}`, variant: "profile", data: profileRow });
    } else {
      cards.push({
        key: `profile-fallback-${account.platformUserId}`,
        variant: "profile",
        data: {
          entityId: account.entityId || account.platformUserId,
          accountName: account.accountName,
          username: account.username,
          profileImage: account.profileImage,
          entityType: "profile",
        },
      });
    }
    for (const org of orgRows) {
      cards.push({ key: `org-${org.entityId}`, variant: "organization", data: org });
    }
    return cards;
  }, [platformKey, account]);

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
              <span className="text-slate-400">Facebook Pages Available:</span> {facebookPagesList.length}
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Available pages</h2>
              <p className="mt-1 text-xs text-slate-400">
                Post as your personal profile or as a company page. Choose a card to open the composer with the right target.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/create-post?platform=linkedin")}
              className="shrink-0 rounded-md bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600"
            >
              Create post (profile)
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {linkedInPostingCards.map((card) => {
              const row = card.data;
              const title = entityDisplayName(row);
              const imageUrl =
                row.profileImage || "https://placehold.co/96x96/0f172a/94a3b8?text=LI";
              const sublabel =
                card.variant === "profile"
                  ? "Personal profile"
                  : row.entityId
                    ? `Company page · ID ${row.entityId}`
                    : "Company page";
              const go = () =>
                card.variant === "profile"
                  ? navigate("/create-post?platform=linkedin")
                  : navigate(`/create-post?platform=linkedin&entityId=${encodeURIComponent(row.entityId)}`);

              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={go}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-slate-600/80 bg-slate-950/50 text-left shadow-lg shadow-slate-950/40 ring-1 ring-slate-700/50 transition hover:border-blue-500/50 hover:ring-blue-500/30"
                >
                  <div className="flex items-start gap-4 p-4">
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-xl border border-slate-600 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {card.variant === "profile" ? (
                          <>
                            <User size={12} className="text-sky-400" aria-hidden />
                            Profile
                          </>
                        ) : (
                          <>
                            <Building2 size={12} className="text-amber-400" aria-hidden />
                            Page
                          </>
                        )}
                      </span>
                      <p className="mt-2 truncate text-base font-semibold text-slate-50">{title}</p>
                      <p className="mt-1 text-xs text-slate-400">{sublabel}</p>
                    </div>
                  </div>
                  <div className="border-t border-slate-700/80 bg-slate-900/40 px-4 py-3 text-xs font-medium text-sky-300 group-hover:text-sky-200">
                    Create post as this target →
                  </div>
                </button>
              );
            })}
          </div>

          {!linkedInOrganizations.length ? (
            <div
              className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
                linkedInOrgDiscoveryCode === "linkedin_orgs_forbidden"
                  ? "border-amber-500/30 bg-amber-500/5 text-amber-100/90"
                  : linkedInOrgDiscoveryCode === "linkedin_orgs_failed"
                    ? "border-amber-500/30 bg-amber-500/5 text-amber-100/90"
                    : "border-slate-600 bg-slate-950/40 text-slate-400"
              }`}
            >
              {linkedInOrgDiscoveryCode === "linkedin_orgs_forbidden"
                ? "LinkedIn did not return company pages for this token (often missing Community Management / organization APIs on your app, or the member is not an approved admin). Your personal profile card above still works; update the LinkedIn developer app products and scopes, then reconnect."
                : linkedInOrgDiscoveryCode === "linkedin_orgs_failed"
                  ? "Company pages could not be loaded from LinkedIn (temporary or configuration issue). Your personal profile card above still works; try reconnecting."
                  : "No company pages were returned for this login. Ensure your LinkedIn app has organization scopes and that your member is an admin of the page, then reconnect."}
            </div>
          ) : null}
        </article>
      ) : null}

      {platformKey === "facebook" ? (
        <article className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Available pages</h2>
              <p className="mt-1 text-xs text-slate-400">
                Post as your personal profile or as a Facebook Page. Choose a card to open the composer with the right target.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/create-post?platform=facebook")}
              className="shrink-0 rounded-md bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600"
            >
              Create post (profile)
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {facebookPostingCards.map((card) => {
              const row = card.data;
              const title = entityDisplayName(row);
              const imageUrl =
                row.profileImage || "https://placehold.co/96x96/0f172a/94a3b8?text=FB";
              const sublabel =
                card.variant === "profile"
                  ? "Personal profile"
                  : row.entityId
                    ? `Facebook Page · ID ${row.entityId}${row.hasLinkedInstagram ? " · Instagram linked" : ""}`
                    : "Facebook Page";
              const go = () =>
                card.variant === "profile"
                  ? navigate("/create-post?platform=facebook")
                  : navigate(`/create-post?platform=facebook&entityId=${encodeURIComponent(row.entityId)}`);

              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={go}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-slate-600/80 bg-slate-950/50 text-left shadow-lg shadow-slate-950/40 ring-1 ring-slate-700/50 transition hover:border-blue-500/50 hover:ring-blue-500/30"
                >
                  <div className="flex items-start gap-4 p-4">
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-xl border border-slate-600 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {card.variant === "profile" ? (
                          <>
                            <User size={12} className="text-sky-400" aria-hidden />
                            Profile
                          </>
                        ) : (
                          <>
                            <Building2 size={12} className="text-amber-400" aria-hidden />
                            Page
                          </>
                        )}
                      </span>
                      <p className="mt-2 truncate text-base font-semibold text-slate-50">{title}</p>
                      <p className="mt-1 text-xs text-slate-400">{sublabel}</p>
                    </div>
                  </div>
                  <div className="border-t border-slate-700/80 bg-slate-900/40 px-4 py-3 text-xs font-medium text-sky-300 group-hover:text-sky-200">
                    Create post as this target →
                  </div>
                </button>
              );
            })}
          </div>

          {!facebookPagesList.length ? (
            <div
              className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
                facebookPageDiscoveryCode === "meta_pages_permission_missing"
                  ? "border-amber-500/30 bg-amber-500/5 text-amber-100/90"
                  : "border-slate-600 bg-slate-950/40 text-slate-400"
              }`}
            >
              {facebookPageDiscoveryCode === "meta_pages_permission_missing"
                ? "Meta did not return Pages for this token (often missing pages_show_list or Page access in your app). Your personal profile card above still works; update Meta Login permissions and reconnect."
                : "No Facebook Pages were returned for this login. Ensure your Meta app requests Page access and that you manage at least one Page, then reconnect."}
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
