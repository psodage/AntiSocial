import { createMetaOAuthService, META_SCOPE_SETS } from "./meta.service.js";

// `pages_show_list` is required for Graph `GET /me/accounts` (pages shown on Connected Platform detail).
// Without it, OAuth succeeds but `metadata.pages` is always empty / discovery sets `pageDiscoveryErrorCode`.
const facebookLoginScopes = [...META_SCOPE_SETS.initialLogin, ...META_SCOPE_SETS.pages];

const facebookService = createMetaOAuthService({
  platform: "facebook",
  profileFields: "id,name,email,picture",
  scopes: facebookLoginScopes,
});

export default facebookService;
