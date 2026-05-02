import axios from "axios";
import { STORAGE_KEYS } from "../data/constants";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const socialClient = axios.create({
  baseURL: API_BASE_URL,
});

socialClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.authToken);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function parseApiError(error, fallbackMessage) {
  return new Error(error?.response?.data?.message || error?.response?.data?.error || fallbackMessage);
}

export function getSocialOAuthErrorMessage(reason, platform) {
  const normalized = (reason || "").toLowerCase();
  if (!normalized) return `Failed to connect ${platform}. Please retry.`;
  if (normalized.includes("invalid_scope")) {
    if ((platform || "").toLowerCase() === "linkedin") {
      return "LinkedIn rejected one or more requested permissions. Verify your LinkedIn app products/scopes (for example, Share on LinkedIn) and confirm the redirect URI matches exactly, then retry.";
    }
    if ((platform || "").toLowerCase() === "instagram") {
      return "Instagram rejected one or more requested permissions. Verify Instagram Login products/scopes in your app settings and retry.";
    }
    if ((platform || "").toLowerCase() === "threads") {
      return "Threads rejected the requested scopes. This usually happens when Threads is accidentally routed through Facebook Login or your Threads app is missing approved permissions. Please retry and verify your Threads app settings + redirect URI.";
    }
    return "Meta rejected one or more permissions. Please retry and verify your app is configured for requested scopes.";
  }
  if (normalized.includes("missing_code")) {
    return "Missing authorization code from provider. Please retry the login flow.";
  }
  if (normalized.includes("login_canceled") || normalized.includes("access_denied")) {
    return "Connection was canceled before authorization completed.";
  }
  if (normalized.includes("no_facebook_pages")) {
    return "No Facebook Pages were found for this account. Create or assign a Page before connecting.";
  }
  if (normalized.includes("no_page_found")) {
    return "No Facebook Page could be loaded. Confirm your Meta Login configuration includes page access.";
  }
  if (normalized.includes("no_instagram_professional_account")) {
    return "No Instagram professional account is linked to your Facebook Page.";
  }
  if (normalized.includes("missing_config_id")) {
    return "Meta Login is misconfigured. Add META_CONFIG_ID to the backend environment and retry.";
  }
  if (normalized.includes("invalid_state")) {
    return "OAuth session expired or became invalid. Start the connection again.";
  }
  if (normalized.includes("invalid_client")) {
    if ((platform || "").toLowerCase() === "instagram") {
      return "Instagram OAuth client configuration is invalid. Verify INSTAGRAM_CLIENT_ID, INSTAGRAM_CLIENT_SECRET, and INSTAGRAM_REDIRECT_URI.";
    }
    return "OAuth client configuration is invalid. Verify provider credentials and redirect URI.";
  }
  if (normalized.includes("token_error")) {
    return "Could not complete token exchange with provider. Please reconnect.";
  }
  if (normalized.includes("linkedin_orgs_forbidden")) {
    return "LinkedIn blocked listing company pages (missing product/scopes or app restrictions). Your profile connection may still work; fix LinkedIn app permissions and reconnect.";
  }
  if (normalized.includes("linkedin_orgs_failed")) {
    return "LinkedIn company page lookup failed. Your profile connection may still work; retry or check LinkedIn API status.";
  }
  return reason;
}

export async function getSocialAccounts() {
  try {
    const { data } = await socialClient.get("/api/social/accounts");
    return data.data.accounts || [];
  } catch (error) {
    throw parseApiError(error, "Unable to fetch social accounts.");
  }
}

export async function startSocialConnect(platform, options = {}) {
  try {
    const params = new URLSearchParams();
    const normalized = (platform || "").toLowerCase();
    const isFacebook = normalized === "facebook";
    const isInstagram = normalized === "instagram";
    if (isFacebook) {
      params.set("platform", normalized);
    }
    if (options.flow) params.set("flow", options.flow);
    const query = params.toString() ? `?${params.toString()}` : "";
    const endpoint = isInstagram
      ? "/api/social/instagram/login"
      : isFacebook
        ? "/api/social/meta/connect"
        : `/api/social/${platform}/connect`;
    const { data } = await socialClient.get(`${endpoint}${query}`);
    return data.data;
  } catch (error) {
    throw parseApiError(error, `Unable to connect ${platform}.`);
  }
}

export async function manualConnectSocial(platform) {
  try {
    const { data } = await socialClient.post(`/api/social/${platform}/manual-connect`);
    return data.data.account;
  } catch (error) {
    throw parseApiError(error, `Unable to manually connect ${platform}.`);
  }
}

export async function disconnectSocial(platform) {
  try {
    const { data } = await socialClient.post(`/api/social/${platform}/disconnect`);
    return data.data.account;
  } catch (error) {
    throw parseApiError(error, `Unable to disconnect ${platform}.`);
  }
}

export async function refreshSocial(platform) {
  try {
    const { data } = await socialClient.post(`/api/social/${platform}/refresh`);
    return data.data;
  } catch (error) {
    throw parseApiError(error, `Unable to refresh ${platform}.`);
  }
}

export async function getSocialEnvDebug() {
  try {
    const { data } = await socialClient.get("/api/social/debug/env-check");
    return data.data;
  } catch (error) {
    throw parseApiError(error, "Unable to fetch OAuth environment diagnostics.");
  }
}
