import { createOAuthService } from "./sharedOAuth.js";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const threadsService = createOAuthService({
  platform: "threads",
  clientId: process.env.META_APP_ID,
  clientSecret: process.env.META_APP_SECRET,
  redirectUri: resolveProviderRedirectUri("threads"),
  authUrl: "https://www.facebook.com/v20.0/dialog/oauth",
  tokenUrl: "https://graph.facebook.com/v20.0/oauth/access_token",
  profileUrl: "https://graph.facebook.com/me?fields=id,name,picture",
  scopes: ["threads_basic", "threads_content_publish", "threads_manage_insights"],
  scopeSeparator: ",",
  additionalAuthParams: { display: "popup" },
});

export default threadsService;
