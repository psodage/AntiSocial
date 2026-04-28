import { createOAuthService } from "./sharedOAuth.js";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const defaultScopes = ["r_liteprofile", "w_member_social"];
const configuredScopes = process.env.LINKEDIN_SCOPES
  ? process.env.LINKEDIN_SCOPES.split(/[,\s]+/).filter(Boolean)
  : defaultScopes;
const hasOpenIdScopes = configuredScopes.some((scope) => ["openid", "profile", "email"].includes(scope));
const linkedinProfileUrl = hasOpenIdScopes ? "https://api.linkedin.com/v2/userinfo" : "https://api.linkedin.com/v2/me";

const linkedinService = createOAuthService({
  platform: "linkedin",
  clientId: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  redirectUri: resolveProviderRedirectUri("linkedin"),
  authUrl: "https://www.linkedin.com/oauth/v2/authorization",
  tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
  // OIDC (`openid profile email`) returns user info from /v2/userinfo.
  // Classic API scopes (`r_liteprofile`) return profile from /v2/me.
  profileUrl: linkedinProfileUrl,
  scopes: configuredScopes,
});

export default linkedinService;
