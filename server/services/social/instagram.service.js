import axios from "axios";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const INSTAGRAM_OAUTH_BASE_URL = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_GRAPH_BASE_URL = "https://graph.instagram.com";
const DEFAULT_SCOPES = ["instagram_business_basic", "instagram_business_content_publish", "instagram_business_manage_messages"];

function createInstagramError(message, code, status, details = null) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function ensureInstagramConfig() {
  const clientId = process.env.INSTAGRAM_CLIENT_ID;
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
  const redirectUri = resolveProviderRedirectUri("instagram");
  if (!clientId || !clientSecret || !redirectUri) {
    throw createInstagramError("Instagram OAuth is not configured.", "instagram_config_missing", 400);
  }
  return { clientId, clientSecret, redirectUri };
}

function normalizeAxiosError(error, fallbackCode) {
  const details = error?.response?.data || null;
  const status = error?.response?.status || 500;
  const message = details?.error_message || details?.error?.message || error?.message || "Instagram API request failed.";
  return createInstagramError(message, fallbackCode, status, details);
}

function mapInstagramProfile(profile) {
  return {
    platformUserId: profile?.user_id?.toString() || profile?.id?.toString() || "",
    accountName: profile?.username || "",
    username: profile?.username || "",
    email: "",
    profileImage: profile?.profile_picture_url || "",
    metadata: {
      instagramUserId: profile?.user_id?.toString() || profile?.id?.toString() || "",
      accountType: profile?.account_type || "",
      mediaCount: profile?.media_count || 0,
      rawProfile: profile,
      capabilities: ["posting", "analytics"],
    },
  };
}

const instagramService = {
  platform: "instagram",
  defaultScopes: DEFAULT_SCOPES,
  validateConfig() {
    try {
      ensureInstagramConfig();
      return { valid: true, missing: [] };
    } catch {
      return { valid: false, missing: ["INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET", "INSTAGRAM_REDIRECT_URI"] };
    }
  },
  getAuthUrl(state) {
    const { clientId, redirectUri } = ensureInstagramConfig();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: DEFAULT_SCOPES.join(","),
      state,
    });
    return `${INSTAGRAM_OAUTH_BASE_URL}?${params.toString()}`;
  },
  async exchangeCodeForToken(code) {
    const { clientId, clientSecret, redirectUri } = ensureInstagramConfig();
    try {
      const payload = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      });
      const response = await axios.post(`${INSTAGRAM_GRAPH_BASE_URL}/access_token`, payload.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const data = response?.data || {};
      return {
        accessToken: data.access_token || "",
        refreshToken: data.refresh_token || "",
        tokenType: "Bearer",
        expiresIn: data.expires_in || 60 * 60,
        scopes: Array.isArray(data?.scope) ? data.scope : DEFAULT_SCOPES,
      };
    } catch (error) {
      throw normalizeAxiosError(error, "instagram_token_exchange_failed");
    }
  },
  async getProfile(accessToken) {
    try {
      const response = await axios.get(`${INSTAGRAM_GRAPH_BASE_URL}/me`, {
        params: {
          fields: "user_id,username,account_type,media_count,profile_picture_url",
          access_token: accessToken,
        },
      });
      return mapInstagramProfile(response?.data || {});
    } catch (error) {
      throw normalizeAxiosError(error, "instagram_profile_fetch_failed");
    }
  },
  async getManagedEntities() {
    return [];
  },
  async refreshTokenIfNeeded(account) {
    const isExpired = account?.expiresAt && new Date(account.expiresAt).getTime() <= Date.now();
    if (!isExpired) return null;
    const token = account?.getDecryptedAccessToken?.();
    if (!token) {
      throw createInstagramError("Instagram access token is unavailable.", "instagram_token_missing", 400);
    }
    try {
      const response = await axios.get(`${INSTAGRAM_GRAPH_BASE_URL}/refresh_access_token`, {
        params: {
          grant_type: "ig_refresh_token",
          access_token: token,
        },
      });
      const data = response?.data || {};
      return {
        accessToken: data.access_token || token,
        refreshToken: "",
        tokenType: "Bearer",
        expiresIn: data.expires_in || 60 * 60,
      };
    } catch (error) {
      throw normalizeAxiosError(error, "instagram_token_refresh_failed");
    }
  },
  async disconnectAccount() {
    return { disconnected: true };
  },
  async publishPost() {
    throw createInstagramError("Publishing is not yet implemented for Instagram Login.", "instagram_publish_not_implemented", 400);
  },
  async getAnalytics() {
    return { available: false, reason: "Not implemented yet." };
  },
};

export default instagramService;
