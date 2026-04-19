export default function TokenExpiryWarning({ account }) {
  if (!account?.isConnected) return null;
  if (account?.isTokenExpired) {
    return <p className="text-xs font-medium text-amber-300">Token expired, reconnect required.</p>;
  }
  if (!account?.expiresAt) {
    return <p className="text-xs text-slate-400">No token expiry reported by provider.</p>;
  }
  const expiry = new Date(account.expiresAt).toLocaleString();
  return <p className="text-xs text-slate-400">Token valid until {expiry}</p>;
}
