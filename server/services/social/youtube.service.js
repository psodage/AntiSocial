import { google } from "googleapis";

const YOUTUBE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.upload",
];

function maskClientId(value) {
  if (!value) return "missing";
  return `***${value.slice(-8)}`;
}

function createClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth is not configured.");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

const youtubeService = {
  platform: "youtube",
  getAuthUrl(state) {
    const oauth2Client = createClient();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      include_granted_scopes: true,
      prompt: "consent",
      scope: YOUTUBE_SCOPES,
      state,
    });
    console.info("[oauth:youtube:auth-url]", {
      platform: "youtube",
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      clientId: maskClientId(process.env.GOOGLE_CLIENT_ID),
    });
    return authUrl;
  },
  async exchangeCodeForToken(code) {
    const oauth2Client = createClient();
    try {
      const { tokens } = await oauth2Client.getToken(code);
      return {
        accessToken: tokens.access_token || "",
        refreshToken: tokens.refresh_token || "",
        tokenType: tokens.token_type || "Bearer",
        expiresIn: tokens.expiry_date ? Math.max(Math.floor((tokens.expiry_date - Date.now()) / 1000), 0) : null,
        scopes: tokens.scope ? tokens.scope.split(" ").filter(Boolean) : YOUTUBE_SCOPES,
      };
    } catch (error) {
      console.error("[oauth:youtube:token:error]", {
        message: error?.message,
        redirectUri: process.env.GOOGLE_REDIRECT_URI,
        clientId: maskClientId(process.env.GOOGLE_CLIENT_ID),
      });
      throw new Error("Google token exchange failed. Verify client credentials and redirect URI.");
    }
  },
  async getProfile(accessToken) {
    const oauth2Client = createClient();
    oauth2Client.setCredentials({ access_token: accessToken });
    try {
      const oauth2 = google.oauth2({ auth: oauth2Client, version: "v2" });
      const youtube = google.youtube({ auth: oauth2Client, version: "v3" });
      const [{ data: userInfo }, { data: channels }] = await Promise.all([
        oauth2.userinfo.get(),
        youtube.channels.list({ part: ["snippet"], mine: true, maxResults: 1 }),
      ]);
      const channel = channels.items?.[0];
      return {
        platformUserId: channel?.id || userInfo.id || "",
        accountName: channel?.snippet?.title || userInfo.name || "",
        username: userInfo.email || "",
        email: userInfo.email || "",
        profileImage: channel?.snippet?.thumbnails?.default?.url || userInfo.picture || "",
        metadata: {
          youtubeChannelId: channel?.id || "",
          youtubeChannelTitle: channel?.snippet?.title || "",
          rawProfile: {
            userInfo,
            channel: channel || null,
          },
        },
      };
    } catch (error) {
      console.error("[oauth:youtube:profile:error]", { message: error?.message });
      throw new Error("Failed to fetch YouTube channel profile.");
    }
  },
  async refreshTokenIfNeeded(account) {
    const isExpired = account?.expiresAt && new Date(account.expiresAt).getTime() <= Date.now();
    if (!isExpired) {
      return null;
    }
    const refreshToken = account?.getDecryptedRefreshToken?.();
    if (!refreshToken) {
      throw new Error("Google refresh token is unavailable. Please reconnect YouTube.");
    }
    const oauth2Client = createClient();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      return {
        accessToken: credentials.access_token || "",
        refreshToken: credentials.refresh_token || "",
        tokenType: credentials.token_type || "Bearer",
        expiresIn: credentials.expiry_date ? Math.max(Math.floor((credentials.expiry_date - Date.now()) / 1000), 0) : null,
      };
    } catch {
      throw new Error("Google token refresh failed. Please reconnect YouTube.");
    }
  },
  async disconnectAccount() {
    return { disconnected: true };
  },
};

export default youtubeService;
