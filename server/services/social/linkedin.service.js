import { createOAuthService } from "./sharedOAuth.js";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const linkedinService = createOAuthService({
  platform: "linkedin",
  clientId: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  redirectUri: resolveProviderRedirectUri("linkedin"),
  authUrl: "https://www.linkedin.com/oauth/v2/authorization",
  tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
  profileUrl: "https://api.linkedin.com/v2/userinfo",
  scopes: ["openid", "profile", "email", "w_member_social"],
});

export default linkedinService;
