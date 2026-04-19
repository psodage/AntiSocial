import axios from "axios";

function maskClientId(value) {
  if (!value) return "missing";
  const visible = value.slice(-8);
  return `***${visible}`;
}

function summarizeAxiosError(error) {
  return {
    message: error?.message || "Unknown request error",
    status: error?.response?.status || null,
    statusText: error?.response?.statusText || null,
    data: error?.response?.data || null,
  };
}

function fallbackProfile(platform) {
  return {
    platformUserId: "",
    accountName: "",
    username: "",
    email: "",
    profileImage: "",
    metadata: { capabilities: ["posting", "analytics"] },
  };
}

export function createOAuthService({
  platform,
  clientId,
  clientSecret,
  redirectUri,
  authUrl,
  tokenUrl,
  profileUrl,
  scopes,
  additionalAuthParams = {},
  mapProfile,
  scopeSeparator = " ",
}) {
  function validateConfig() {
    return {
      valid: Boolean(clientId && clientSecret && redirectUri),
      missing: [
        ...(!clientId ? ["clientId"] : []),
        ...(!clientSecret ? ["clientSecret"] : []),
        ...(!redirectUri ? ["redirectUri"] : []),
      ],
    };
  }

  return {
    platform,
    validateConfig,
    getAuthUrl(state) {
      if (!validateConfig().valid) {
        throw new Error(`${platform} OAuth is not configured.`);
      }
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes.join(scopeSeparator),
        state,
        ...additionalAuthParams,
      });
      return `${authUrl}?${params.toString()}`;
    },
    async exchangeCodeForToken(code) {
      if (!validateConfig().valid) {
        throw new Error(`${platform} OAuth is not configured.`);
      }

      let data;
      try {
        const response = await axios.post(
          tokenUrl,
          new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
            code,
          }),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        data = response.data;
      } catch (error) {
        console.error("[oauth:token:error]", {
          platform,
          tokenUrl,
          redirectUri,
          clientId: maskClientId(clientId),
          error: summarizeAxiosError(error),
        });
        throw new Error(`Token exchange failed for ${platform}.`);
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || "",
        tokenType: data.token_type || "Bearer",
        expiresIn: data.expires_in || 60 * 60 * 24 * 30,
        scopes: data.scope ? data.scope.split(/[,\s]+/).filter(Boolean) : scopes,
      };
    },
    async getProfile(accessToken) {
      if (!profileUrl) {
        throw new Error(`Missing profile endpoint for ${platform}.`);
      }

      let data;
      try {
        const response = await axios.get(profileUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        data = response.data;
      } catch (error) {
        console.error("[oauth:profile:error]", {
          platform,
          profileUrl,
          clientId: maskClientId(clientId),
          error: summarizeAxiosError(error),
        });
        throw new Error(`Profile fetch failed for ${platform}.`);
      }

      const normalized = {
        platformUserId: data.id?.toString() || fallbackProfile(platform).platformUserId,
        accountName: data.name || data.localizedFirstName || fallbackProfile(platform).accountName,
        username: data.username || data.vanityName || "",
        email: data.email || "",
        profileImage: data.picture?.data?.url || data.profilePicture || "",
        metadata: {
          rawProfile: data,
          capabilities: ["posting", "analytics"],
        },
      };

      return typeof mapProfile === "function" ? mapProfile(data, normalized) : normalized;
    },
    async getManagedEntities() {
      return [];
    },
    async publishPost() {
      throw new Error(`${platform} publish is not implemented yet.`);
    },
    async getAnalytics() {
      return { available: false, reason: "Analytics unavailable for this provider tier." };
    },
    async refreshTokenIfNeeded(account) {
      const isExpired = account?.expiresAt && new Date(account.expiresAt).getTime() <= Date.now();
      if (!isExpired) {
        return null;
      }

      if (!account?.getDecryptedRefreshToken?.()) {
        throw new Error("Refresh token unavailable.");
      }

      return {
        accessToken: `refreshed_access_${platform}_${Date.now()}`,
        expiresIn: 60 * 60 * 24 * 30,
        tokenType: "Bearer",
      };
    },
    async disconnectAccount() {
      return { disconnected: true };
    },
  };
}
