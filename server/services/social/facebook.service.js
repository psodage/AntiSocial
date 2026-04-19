import { createMetaOAuthService, META_SCOPE_SETS } from "./meta.service.js";

const facebookService = createMetaOAuthService({
  platform: "facebook",
  profileFields: "id,name,email,picture",
  scopes: META_SCOPE_SETS.initialLogin,
});

export default facebookService;
