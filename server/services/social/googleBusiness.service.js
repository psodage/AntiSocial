import { createOAuthService } from "./sharedOAuth.js";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const googleBusinessService = createOAuthService({
  platform: "googleBusiness",
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: resolveProviderRedirectUri("googleBusiness"),
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  profileUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
  scopes: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/business.manage",
  ],
  mapProfile: (data, normalized) => ({
    ...normalized,
    platformUserId: data?.sub?.toString() || normalized.platformUserId,
    accountName: data?.name || normalized.accountName,
    username: data?.email || normalized.username,
    email: data?.email || normalized.email,
    profileImage: data?.picture || normalized.profileImage,
    metadata: {
      ...normalized.metadata,
      capabilities: ["posting", "analytics", "business-updates"],
    },
  }),
});

export default googleBusinessService;
