import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { AnimatePresence } from "framer-motion";
import { AlertCircle, Link2 } from "lucide-react";
import { PLATFORM_CAPABILITY_MATRIX, SOCIAL_PLATFORM_CONFIGS } from "../data/socialPlatforms";
import {
  disconnectSocial,
  getSocialAccounts,
  getSocialOAuthErrorMessage,
  refreshSocial,
  startSocialConnect,
} from "../services/socialApi";
import SocialAccountCard from "../components/social/SocialAccountCard";
import DisconnectConfirmationDialog from "../components/social/DisconnectConfirmationDialog";

export default function SettingsPage() {
  const { user, saveSettings, setToast, theme, toggleTheme } = useApp();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [processingPlatform, setProcessingPlatform] = useState("");
  const [disconnectDialog, setDisconnectDialog] = useState({ open: false, platform: "" });
  const [auditLog, setAuditLog] = useState([]);
  const [oauthBanner, setOauthBanner] = useState(null);

  const accountsByPlatform = useMemo(
    () =>
      accounts.reduce((acc, item) => {
        acc[item.platform] = item;
        return acc;
      }, {}),
    [accounts]
  );

  const summary = useMemo(() => {
    const connected = accounts.filter((item) => item.isConnected).length;
    const reconnectRequired = accounts.filter((item) => item.isConnected && item.isTokenExpired).length;
    const pendingPlatforms = SOCIAL_PLATFORM_CONFIGS.filter((platform) => !accountsByPlatform[platform.key]?.isConnected).length;
    return {
      totalConnected: connected,
      activePlatforms: connected,
      reconnectRequired,
      pendingPlatforms,
    };
  }, [accounts, accountsByPlatform]);
  const instagramAccount = accountsByPlatform.instagram || { isConnected: false };

  const addAuditEntry = (entry) => {
    setAuditLog((prev) => [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...entry }, ...prev].slice(0, 8));
  };

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const payload = await getSocialAccounts();
      setAccounts(payload);
    } catch (error) {
      setToast({ message: error.message || "Unable to load connected accounts.", error: true });
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const platform = params.get("social_platform");
    const status = params.get("social_status");
    const reason = params.get("reason");

    if (!platform || !status) return;

    if (status === "connected") {
      setToast({ message: `${platform} connected successfully.` });
      setOauthBanner({ type: "success", message: `${platform} account connected.` });
      addAuditEntry({ message: `${platform} connected` });
      loadAccounts();
    } else {
      const message = getSocialOAuthErrorMessage(reason, platform);
      setToast({ message, error: true });
      setOauthBanner({ type: "error", message });
    }

    params.delete("social_platform");
    params.delete("social_status");
    params.delete("reason");
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", next);
  }, [setToast]);

  const save = async () => {
    const result = await saveSettings({ name, email, password });
    setPassword("");
    setToast({ message: result.ok ? "Changes saved." : result.error?.message || "Unable to save changes." });
  };

  const discard = () => {
    setName(user.name);
    setEmail(user.email);
    setPassword("");
  };

  const connectPlatform = async (platform) => {
    if (PLATFORM_CAPABILITY_MATRIX[platform]?.oauth === false) {
      setToast({ message: `${platform} requires bot/manual setup and does not support OAuth connect.`, error: true });
      return;
    }
    setProcessingPlatform(platform);
    const redirectMessage =
      platform === "instagram" ? "Redirecting to Instagram Login..." : `Redirecting to ${platform} OAuth...`;
    setToast({ message: redirectMessage });
    try {
      const data = await startSocialConnect(platform);
      window.location.href = data.url;
    } catch (error) {
      setToast({ message: error.message || `Failed to connect ${platform}.`, error: true });
    } finally {
      setProcessingPlatform("");
    }
  };

  const reconnectPlatform = async (platform) => {
    setProcessingPlatform(platform);
    try {
      const result = await refreshSocial(platform);
      if (result.refreshed) {
        setToast({ message: `${platform} token refreshed.` });
        addAuditEntry({ message: `${platform} token refreshed` });
        loadAccounts();
      } else {
        connectPlatform(platform);
        return;
      }
    } catch {
      connectPlatform(platform);
      return;
    } finally {
      setProcessingPlatform("");
    }
  };

  const disconnectPlatform = async () => {
    const platform = disconnectDialog.platform;
    setProcessingPlatform(platform);
    const current = [...accounts];
    setAccounts((prev) => prev.map((item) => (item.platform === platform ? { ...item, isConnected: false } : item)));
    try {
      await disconnectSocial(platform);
      setToast({ message: `${platform} disconnected.` });
      addAuditEntry({ message: `${platform} disconnected` });
    } catch (error) {
      setAccounts(current);
      setToast({ message: error.message || `Failed to disconnect ${platform}.`, error: true });
    } finally {
      setDisconnectDialog({ open: false, platform: "" });
      setProcessingPlatform("");
    }
  };

  return (
    <section className="space-y-5">
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold">Profile</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          <input className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950 md:col-span-2" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current" type="password" />
        </div>
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Appearance</h2>
            <p className="text-xs text-slate-500">Dark mode syncs with the header toggle.</p>
          </div>
          <button onClick={toggleTheme} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700">
            {theme === "dark" ? "Disable dark mode" : "Enable dark mode"}
          </button>
        </div>
      </article>
      <article className="rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-900/90 via-slate-900 to-blue-950/60 p-5 shadow-2xl backdrop-blur-xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Connected Accounts</h2>
            <p className="text-xs text-slate-400">Secure OAuth linking for publishing and analytics across all channels.</p>
          </div>
          <div className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200">
            AntiSocial OAuth Hub
          </div>
        </div>

        {oauthBanner ? (
          <div
            className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
              oauthBanner.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/30 bg-red-500/10 text-red-200"
            }`}
          >
            {oauthBanner.message}
          </div>
        ) : null}

        <div className="mb-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <p className="text-xs text-slate-400">Total connected accounts</p>
            <p className="mt-1 text-2xl font-semibold text-white">{summary.totalConnected}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <p className="text-xs text-slate-400">Platforms active</p>
            <p className="mt-1 text-2xl font-semibold text-white">{summary.activePlatforms}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <p className="text-xs text-slate-400">Reconnect required</p>
            <p className="mt-1 text-2xl font-semibold text-amber-300">{summary.reconnectRequired}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <p className="text-xs text-slate-400">Pending platforms</p>
            <p className="mt-1 text-2xl font-semibold text-sky-300">{summary.pendingPlatforms}</p>
          </div>
        </div>
        <div className="mb-5 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-3">
          <p className="text-xs uppercase tracking-wide text-fuchsia-200">Instagram</p>
          <p className="mt-1 text-sm text-white">
            {instagramAccount.isConnected
              ? `Connected as ${instagramAccount.username || instagramAccount.accountName || "instagram user"}`
              : "Not connected"}
          </p>
          <p className="mt-1 text-xs text-fuchsia-100/80">
            Instagram uses direct Instagram Login OAuth and is managed independently from Facebook connection.
          </p>
        </div>

        {loadingAccounts ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-48 animate-pulse rounded-2xl border border-slate-700 bg-slate-900/60" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {SOCIAL_PLATFORM_CONFIGS.map((platform) => (
              <SocialAccountCard
                key={platform.key}
                platformConfig={platform}
                account={accountsByPlatform[platform.key] || { platform: platform.key, isConnected: false }}
                isProcessing={processingPlatform === platform.key}
                onConnect={() => connectPlatform(platform.key)}
                onReconnect={() => reconnectPlatform(platform.key)}
                onDisconnect={() => setDisconnectDialog({ open: true, platform: platform.key })}
              />
            ))}
          </div>
        )}

        {!loadingAccounts && !accounts.some((item) => item.isConnected) ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <AlertCircle className="text-slate-300" size={18} />
            <p className="text-sm text-slate-300">No channels connected yet. Connect at least one account to start posting and analytics sync.</p>
          </div>
        ) : null}
      </article>

      <article className="rounded-xl border border-slate-700/70 bg-slate-900/80 p-5 shadow-card">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Link2 size={16} /> Connection Audit Log
        </h2>
        {auditLog.length === 0 ? (
          <p className="text-xs text-slate-400">No recent connection events yet.</p>
        ) : (
          <div className="space-y-2">
            {auditLog.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">
                <p>{entry.message}</p>
                <p className="mt-1 text-[11px] text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </article>
      <div className="flex justify-end gap-2">
        <button onClick={discard} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">
          Discard
        </button>
        <button onClick={save} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          Save changes
        </button>
      </div>

      <AnimatePresence>
        <DisconnectConfirmationDialog
          open={disconnectDialog.open}
          platformLabel={disconnectDialog.platform}
          loading={!!processingPlatform}
          onCancel={() => setDisconnectDialog({ open: false, platform: "" })}
          onConfirm={disconnectPlatform}
        />
      </AnimatePresence>
    </section>
  );
}
