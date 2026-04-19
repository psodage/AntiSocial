import { createMetaOAuthService, META_SCOPE_SETS } from "./meta.service.js";

const instagramService = createMetaOAuthService({
  platform: "instagram",
  profileFields: "id,name,email,picture",
  scopes: META_SCOPE_SETS.initialLogin,
});

export default instagramService;
