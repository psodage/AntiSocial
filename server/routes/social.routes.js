import { Router } from "express";
import {
  connectMetaUpgradePlatform,
  connectMetaPlatform,
  connectSocialPlatform,
  debugSocialEnvCheck,
  disconnectSocialPlatform,
  listSocialAccounts,
  metaOauthCallback,
  oauthCallback,
  refreshSocialPlatform,
  socialPlatformStatus,
} from "../controllers/social.controller.js";

export function createSocialRoutes(requireAuth) {
  const router = Router();

  router.get("/debug/env-check", requireAuth, debugSocialEnvCheck);
  router.get("/accounts", requireAuth, listSocialAccounts);
  router.get("/meta/connect", requireAuth, connectMetaPlatform);
  router.get("/meta/upgrade/connect", requireAuth, connectMetaUpgradePlatform);
  router.get("/meta/callback", metaOauthCallback);
  router.get("/:platform/connect", requireAuth, connectSocialPlatform);
  router.get("/:platform/callback", oauthCallback);
  router.post("/:platform/disconnect", requireAuth, disconnectSocialPlatform);
  router.post("/:platform/refresh", requireAuth, refreshSocialPlatform);
  router.get("/:platform/status", requireAuth, socialPlatformStatus);

  return router;
}
