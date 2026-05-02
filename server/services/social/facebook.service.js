import { createMetaOAuthService, META_SCOPE_SETS } from "./meta.service.js";

// `pages_show_list` is required for Graph `GET /me/accounts` (Pages list / Instagram linkage metadata).
// `pages_manage_posts` + `pages_read_engagement` keep Page tokens available for Meta-linked features; Facebook posts use the user token (`/me/*`), not Page endpoints.
const facebookLoginScopes = [
  ...META_SCOPE_SETS.initialLogin,
  ...META_SCOPE_SETS.pages,
  ...META_SCOPE_SETS.pagePosting,
];

const facebookService = createMetaOAuthService({
  platform: "facebook",
  profileFields: "id,name,email,picture",
  scopes: facebookLoginScopes,
});

export default facebookService;
