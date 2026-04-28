import axios from "axios";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const INSTAGRAM_AUTH_URL = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_GRAPH_BASE_URL = "https://graph.instagram.com";
const INSTAGRAM_REFRESH_TOKEN_URL = `${INSTAGRAM_GRAPH_BASE_URL}/refresh_access_token`;

const INSTAGRAM_DEFAULT_SCOPES = ["instagram_business_basic"];

function maskClientId(value) {
  if (!value) return "missing";
  return `***${value.slice(-8)}`;
}

function createInstagramError(message, code, status = 400, details = null) {
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
    throw createInstagramError(
      "Instagram OAuth is not configured.",
      "instagram_config_missing",
      400,
      ["INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET", "INSTAGRAM_REDIRECT_URI"]
    );
  }

  return { clientId, clientSecret, redirectUri };
}

function normalizeScopes(scopes) {
  const requested = Array.isArray(scopes) ? scopes : [];
  const cleaned = requested.map((scope) => (scope || "").toString().trim()).filter(Boolean);
  return Array.from(new Set([...(cleaned.length ? cleaned : INSTAGRAM_DEFAULT_SCOPES)]));
}

async function instagramGraphGet(path, accessToken, params = {}) {
  try {
    const response = await axios.get(`${INSTAGRAM_GRAPH_BASE_URL}${path}`, {
      params: { ...params, access_token: accessToken },
    });
    return response.data;
  } catch (error) {
    throw createInstagramError(
      "Instagram API request failed.",
      "instagram_graph_error",
      error?.response?.status || 500,
      error?.response?.data || null
    );
  }
}

const instagramService = {
  platform: "instagram",
  defaultScopes: INSTAGRAM_DEFAULT_SCOPES,

  validateConfig() {
    try {
      ensureInstagramConfig();
      return { valid: true, missing: [] };
    } catch (error) {
      return {
        valid: false,
        missing: error?.details || ["INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET", "INSTAGRAM_REDIRECT_URI"],
      };
    }
  },

  getAuthUrl(state, requestedScopes = null) {
    const { clientId, redirectUri } = ensureInstagramConfig();
    const scopes = normalizeScopes(requestedScopes || this.defaultScopes);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(","),
      state,
    });
    console.info("[oauth:instagram:auth-url]", {
      platform: "instagram",
      clientId: maskClientId(clientId),
      redirectUri,
      authEndpoint: INSTAGRAM_AUTH_URL,
      scopes,
    });
    return `${INSTAGRAM_AUTH_URL}?${params.toString()}`;
  },

  getAdvancedAuthUrl(state, additionalScopes = []) {
    return this.getAuthUrl(state, additionalScopes);
  },

  async exchangeCodeForToken(code) {
    const { clientId, clientSecret, redirectUri } = ensureInstagramConfig();
    try {
      const response = await axios.post(
        INSTAGRAM_TOKEN_URL,
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      const data = response.data || {};
      return {
        accessToken: data.access_token || "",
        refreshToken: "",
        tokenType: "Bearer",
        expiresIn: data.expires_in || 60 * 60,
        scopes: normalizeScopes(this.defaultScopes),
      };
    } catch (error) {
      throw createInstagramError(
        "Token exchange failed for Instagram.",
        "instagram_token_exchange_failed",
        error?.response?.status || 400,
        error?.response?.data || null
      );
    }
  },

  async getProfile(accessToken) {
    const profile = await instagramGraphGet("/me", accessToken, {
      fields: "id,username,account_type,media_count",
    });

    return {
      platformUserId: profile?.id?.toString() || "",
      accountName: profile?.username || "",
      username: profile?.username || "",
      email: "",
      profileImage: "",
      entityType: "professional",
      entityId: profile?.id?.toString() || "",
      capabilities: ["posting", "analytics"],
      metadata: {
        rawProfile: profile,
        accountType: profile?.account_type || "",
        mediaCount: profile?.media_count ?? null,
        instagramUserId: profile?.id?.toString() || "",
      },
    };
  },

  async refreshTokenIfNeeded(account) {
    const accessToken = account?.getDecryptedAccessToken?.();
    if (!accessToken) {
      return null;
    }

    const isExpired = account?.expiresAt && new Date(account.expiresAt).getTime() <= Date.now();
    if (!isExpired) return null;

    try {
      const response = await axios.get(INSTAGRAM_REFRESH_TOKEN_URL, {
        params: {
          grant_type: "ig_refresh_token",
          access_token: accessToken,
        },
      });
      const data = response.data || {};
      return {
        accessToken: data.access_token || "",
        refreshToken: "",
        tokenType: "Bearer",
        expiresIn: data.expires_in || 60 * 60 * 24 * 60,
      };
    } catch (error) {
      throw createInstagramError(
        "Instagram token refresh failed.",
        "instagram_token_refresh_failed",
        error?.response?.status || 400,
        error?.response?.data || null
      );
    }
  },

  async disconnectAccount() {
    return { disconnected: true };
  },
};

export default instagramService;
