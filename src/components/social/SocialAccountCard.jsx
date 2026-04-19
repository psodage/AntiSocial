import { motion } from "framer-motion";
import ConnectionStatusBadge from "./ConnectionStatusBadge";
import ConnectButton from "./ConnectButton";
import TokenExpiryWarning from "./TokenExpiryWarning";
import AccountSyncInfo from "./AccountSyncInfo";
import { PLATFORM_CAPABILITY_MATRIX } from "../../data/socialPlatforms";

export default function SocialAccountCard({ platformConfig, account, isProcessing, onConnect, onReconnect, onDisconnect }) {
  const Icon = platformConfig.icon;
  const displayName = account?.accountName || account?.username || "No account linked";
  const firstPage = Array.isArray(account?.entities) ? account.entities.find((item) => item.entityType === "page") : null;
  const linkedInstagram = account?.metadata?.linkedInstagramAccount || account?.metadata?.linkedFacebookPage || null;
  const capability = PLATFORM_CAPABILITY_MATRIX[platformConfig.key];
  const badges = account?.capabilities?.length ? account.capabilities : capability?.badges || [];
  const oauthSupported = capability?.oauth !== false;

  return (
    <motion.article
      layout
      className="rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4 shadow-lg backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-blue-400/40"
      whileHover={{ scale: 1.01 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-500/10 p-2 text-blue-300">
            {Icon ? <Icon size={18} /> : <span className="text-xs font-bold">X</span>}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{platformConfig.label}</p>
            <p className="text-xs text-slate-400">{platformConfig.hint}</p>
          </div>
        </div>
        <ConnectionStatusBadge isConnected={!!account?.isConnected} />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <img
          src={account?.profileImage || "https://placehold.co/80x80/0f172a/e2e8f0?text=%40"}
          alt={`${platformConfig.label} profile`}
          className="h-11 w-11 rounded-full border border-slate-700 object-cover"
        />
        <div>
          <p className="text-sm font-medium text-slate-100">{displayName}</p>
          <p className="text-xs text-slate-400">
            {account?.entityType ? `Type: ${account.entityType}` : "Account type unavailable"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {badges.map((badge) => (
          <span key={`${platformConfig.key}-${badge}`} className="rounded-full border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300">
            {badge}
          </span>
        ))}
      </div>

      <div className="mt-4 space-y-1">
        {platformConfig.key === "facebook" ? (
          <p className="text-xs text-slate-400">
            {firstPage?.name ? `Page: ${firstPage.name}` : "Page: Not found"}
            {" - "}
            {linkedInstagram?.username || linkedInstagram?.name ? "Instagram linked" : "Instagram not linked"}
          </p>
        ) : null}
        {platformConfig.key === "instagram" ? (
          <p className="text-xs text-slate-400">
            {linkedInstagram?.pageName ? `Linked Page: ${linkedInstagram.pageName}` : "Linked Page: Not available"}
          </p>
        ) : null}
        <TokenExpiryWarning account={account} />
        <AccountSyncInfo account={account} />
      </div>

      <div className="mt-4 flex gap-2">
        <ConnectButton
          isConnected={!!account?.isConnected}
          isProcessing={isProcessing || !oauthSupported}
          onConnect={onConnect}
          onReconnect={onReconnect}
        />
        <button
          onClick={onDisconnect}
          disabled={!account?.isConnected || isProcessing}
          className="rounded-md border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Disconnect
        </button>
      </div>
      {!oauthSupported ? (
        <p className="mt-2 text-xs text-amber-300">Bot/manual setup required. OAuth is not available for this platform.</p>
      ) : null}
    </motion.article>
  );
}
