import { createOAuthService } from "./sharedOAuth.js";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const defaultScopes = ["r_liteprofile", "w_member_social"];
const configuredScopes = process.env.LINKEDIN_SCOPES
  ? process.env.LINKEDIN_SCOPES.split(/[,\s]+/).filter(Boolean)
  : defaultScopes;

const linkedinService = createOAuthService({
  platform: "linkedin",
  clientId: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  redirectUri: resolveProviderRedirectUri("linkedin"),
  authUrl: "https://www.linkedin.com/oauth/v2/authorization",
  tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
  // OIDC (`openid profile email`) requires a dedicated LinkedIn product.
  // Default to classic LinkedIn API scopes unless explicitly configured.
  profileUrl: "https://api.linkedin.com/v2/me",
  scopes: configuredScopes,
});

export default linkedinService;
