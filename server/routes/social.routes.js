import { Router } from "express";
import {
  connectInstagramPlatform,
  connectMetaUpgradePlatform,
  connectMetaPlatform,
  connectSocialPlatform,
  createXPost,
  debugSocialEnvCheck,
  disconnectSocialPlatform,
  instagramOauthCallback,
  listSocialAccounts,
  manualConnectSocialPlatform,
  metaOauthCallback,
  oauthCallback,
  refreshSocialPlatform,
  socialPlatformStatus,
} from "../controllers/social.controller.js";
import { connectThreads, disconnectThreads, threadsOauthCallback } from "../controllers/threads.controller.js";

export function createSocialRoutes(requireAuth) {
  const router = Router();

  router.get("/debug/env-check", requireAuth, debugSocialEnvCheck);
  router.post("/x/post", requireAuth, createXPost);
  router.get("/accounts", requireAuth, listSocialAccounts);
  router.get("/threads/connect", requireAuth, connectThreads);
  router.get("/threads/callback", threadsOauthCallback);
  router.post("/threads/disconnect", requireAuth, disconnectThreads);
  router.get("/meta/connect", requireAuth, connectMetaPlatform);
  router.get("/meta/upgrade/connect", requireAuth, connectMetaUpgradePlatform);
  router.get("/meta/callback", metaOauthCallback);
  router.get("/instagram/login", requireAuth, connectInstagramPlatform);
  router.get("/instagram/callback", instagramOauthCallback);
  router.get("/:platform/connect", requireAuth, connectSocialPlatform);
  router.post("/:platform/manual-connect", requireAuth, manualConnectSocialPlatform);
  router.get("/:platform/callback", oauthCallback);
  router.post("/:platform/disconnect", requireAuth, disconnectSocialPlatform);
  router.post("/:platform/refresh", requireAuth, refreshSocialPlatform);
  router.get("/:platform/status", requireAuth, socialPlatformStatus);

  return router;
}
