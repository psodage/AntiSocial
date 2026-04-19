import { createOAuthService } from "./sharedOAuth.js";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const twitterService = createOAuthService({
  platform: "x",
  clientId: process.env.TWITTER_CLIENT_ID,
  clientSecret: process.env.TWITTER_CLIENT_SECRET,
  redirectUri: resolveProviderRedirectUri("x"),
  authUrl: "https://twitter.com/i/oauth2/authorize",
  tokenUrl: "https://api.x.com/2/oauth2/token",
  profileUrl: "https://api.x.com/2/users/me?user.fields=id,name,username,profile_image_url",
  scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
  mapProfile: (data, normalized) => ({
    ...normalized,
    platformUserId: data?.data?.id?.toString() || normalized.platformUserId,
    accountName: data?.data?.name || normalized.accountName,
    username: data?.data?.username || normalized.username,
    profileImage: data?.data?.profile_image_url || normalized.profileImage,
    metadata: {
      ...normalized.metadata,
      capabilities: ["posting", "limited-api"],
    },
  }),
});

export default twitterService;
