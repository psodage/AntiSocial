import { createMetaOAuthService, META_SCOPE_SETS } from "./meta.service.js";

// `pages_show_list` is required for Graph `GET /me/accounts` (pages shown on Connected Platform detail).
// `pages_manage_posts` + `pages_read_engagement` are required for publishing as a Page.
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
