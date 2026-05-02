import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import {
  SOCIAL_PLATFORM_CONFIGS,
  PLATFORM_CAPABILITY_MATRIX,
  isPlatformConnectTemporarilyDisabled,
} from "../data/socialPlatforms";
import { disconnectSocial, getSocialOAuthErrorMessage, manualConnectSocial, refreshSocial, startSocialConnect } from "../services/socialApi";
import SocialAccountCard from "../components/social/SocialAccountCard";
import DisconnectConfirmationDialog from "../components/social/DisconnectConfirmationDialog";
import { useApp } from "../context/AppContext";

export default function ConnectedPlatformsPage() {
  const navigate = useNavigate();
  const { setToast, refreshConnectedAccounts } = useApp();
  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [processingPlatform, setProcessingPlatform] = useState("");
  const [disconnectDialog, setDisconnectDialog] = useState({ open: false, platform: "" });

  const accountsByPlatform = useMemo(
    () => accounts.reduce((acc, item) => ({ ...acc, [item.platform]: item }), {}),
    [accounts]
  );

  const { availablePlatforms, temporarilyDisabledPlatforms } = useMemo(() => {
    const available = [];
    const disabled = [];
    for (const platform of SOCIAL_PLATFORM_CONFIGS) {
      if (isPlatformConnectTemporarilyDisabled(platform.key)) disabled.push(platform);
      else available.push(platform);
    }
    return { availablePlatforms: available, temporarilyDisabledPlatforms: disabled };
  }, []);

  async function loadAccounts() {
    setLoadingAccounts(true);
    try {
      setAccounts(await refreshConnectedAccounts());
    } catch (error) {
      setToast({ message: error.message || "Unable to load connected accounts.", error: true });
    } finally {
      setLoadingAccounts(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  const connectPlatform = async (platform) => {
    if (isPlatformConnectTemporarilyDisabled(platform)) {
      setToast({ message: "Connecting to this platform is temporarily unavailable.", error: true });
      return;
    }
    const capability = PLATFORM_CAPABILITY_MATRIX[platform];
    setProcessingPlatform(platform);
    try {
      if (capability?.oauth === false) {
        await manualConnectSocial(platform);
        await loadAccounts();
        setToast({ message: `${platform} connected via manual bot setup.` });
        return;
      }
      const data = await startSocialConnect(platform);
      window.location.href = data.url;
    } catch (error) {
      setToast({ message: error.message || `Failed to connect ${platform}.`, error: true });
    } finally {
      setProcessingPlatform("");
    }
  };

  const reconnectPlatform = async (platform) => {
    if (isPlatformConnectTemporarilyDisabled(platform)) {
      setToast({ message: "Reconnect is temporarily unavailable for this platform.", error: true });
      return;
    }
    setProcessingPlatform(platform);
    try {
      const result = await refreshSocial(platform);
      if (!result.refreshed) {
        await connectPlatform(platform);
        return;
      }
      await loadAccounts();
      setToast({ message: `${platform} token refreshed.` });
    } catch {
      await connectPlatform(platform);
    } finally {
      setProcessingPlatform("");
    }
  };

  const disconnectPlatform = async () => {
    const platform = disconnectDialog.platform;
    setProcessingPlatform(platform);
    try {
      await disconnectSocial(platform);
      await loadAccounts();
      setToast({ message: `${platform} disconnected.` });
    } catch (error) {
      setToast({ message: error.message || `Failed to disconnect ${platform}.`, error: true });
    } finally {
      setDisconnectDialog({ open: false, platform: "" });
      setProcessingPlatform("");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const platform = params.get("social_platform");
    const status = params.get("social_status");
    const reason = params.get("reason");
    if (!platform || !status) return;
    if (status === "connected") {
      setToast({ message: `${platform} connected successfully.` });
      loadAccounts();
    } else {
      setToast({ message: getSocialOAuthErrorMessage(reason, platform), error: true });
    }
    params.delete("social_platform");
    params.delete("social_status");
    params.delete("reason");
    window.history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }, [setToast]);

  return (
    <section className="space-y-6">
      <article className="rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-900/90 via-slate-900 to-blue-950/60 p-5 shadow-2xl backdrop-blur-xl">
        <h1 className="text-xl font-semibold text-white">Connected Platforms</h1>
        <p className="mt-1 text-sm text-slate-300">Official API integrations only. Restricted capabilities are clearly marked.</p>
      </article>

      <article className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold text-white">Available to connect</h2>
        <p className="mb-4 mt-1 text-xs text-slate-400">Platforms you can link now. Capabilities and OAuth vs bot setup vary per channel.</p>
        {loadingAccounts ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-48 animate-pulse rounded-2xl border border-slate-700 bg-slate-900/60" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {availablePlatforms.map((platform) => (
              <SocialAccountCard
                key={platform.key}
                platformConfig={platform}
                account={accountsByPlatform[platform.key] || { platform: platform.key, isConnected: false }}
                isProcessing={processingPlatform === platform.key}
                onConnect={() => connectPlatform(platform.key)}
                onReconnect={() => reconnectPlatform(platform.key)}
                onDisconnect={() => setDisconnectDialog({ open: true, platform: platform.key })}
                onOpenDetails={() => navigate(`/connected-platforms/${platform.key}`)}
              />
            ))}
          </div>
        )}
      </article>

      <article className="rounded-2xl border border-slate-600/50 bg-slate-900/50 p-5">
        <h2 className="text-sm font-semibold text-slate-200">Temporarily unavailable</h2>
        <p className="mb-4 mt-1 text-xs text-slate-500">New connections and reconnect are disabled here for now. Existing links stay manageable below.</p>
        {loadingAccounts ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, idx) => (
              <div key={idx} className="h-48 animate-pulse rounded-2xl border border-slate-700 bg-slate-900/60" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {temporarilyDisabledPlatforms.map((platform) => (
              <SocialAccountCard
                key={platform.key}
                platformConfig={platform}
                account={accountsByPlatform[platform.key] || { platform: platform.key, isConnected: false }}
                isProcessing={processingPlatform === platform.key}
                connectTemporarilyDisabled
                onConnect={() => connectPlatform(platform.key)}
                onReconnect={() => reconnectPlatform(platform.key)}
                onDisconnect={() => setDisconnectDialog({ open: true, platform: platform.key })}
                onOpenDetails={() => navigate(`/connected-platforms/${platform.key}`)}
              />
            ))}
          </div>
        )}
      </article>

      {!loadingAccounts && !accounts.some((item) => item.isConnected) ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
          <AlertCircle className="text-slate-300" size={18} />
          <p className="text-sm text-slate-300">No channels connected yet. Connect a platform to start posting and scheduling.</p>
        </div>
      ) : null}

      <DisconnectConfirmationDialog
        open={disconnectDialog.open}
        platformLabel={disconnectDialog.platform}
        loading={!!processingPlatform}
        onCancel={() => setDisconnectDialog({ open: false, platform: "" })}
        onConfirm={disconnectPlatform}
      />
    </section>
  );
}
