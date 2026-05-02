import { Router } from "express";
import {
  connectInstagramPlatform,
  connectMetaUpgradePlatform,
  connectMetaPlatform,
  connectSocialPlatform,
  createFacebookPost,
  createLinkedInPost,
  createXPost,
  debugSocialEnvCheck,
  disconnectSocialPlatform,
  instagramOauthCallback,
  listSocialAccounts,
  listSocialPostHistory,
  manualConnectSocialPlatform,
  metaOauthCallback,
  oauthCallback,
  postToInstagram,
  refreshSocialPlatform,
  socialPlatformStatus,
} from "../controllers/social.controller.js";
import {
  connectThreads,
  createThreadsPost,
  disconnectThreads,
  threadsOauthCallback,
} from "../controllers/threads.controller.js";
import { handleSocialPublicUpload, uploadPublicSocialMedia } from "../controllers/upload.controller.js";

export function createSocialRoutes(requireAuth) {
  const router = Router();

  router.get("/debug/env-check", requireAuth, debugSocialEnvCheck);
  router.post("/linkedin/post", requireAuth, createLinkedInPost);
  router.post("/facebook/post", requireAuth, createFacebookPost);
  router.post("/x/post", requireAuth, createXPost);
  router.get("/accounts", requireAuth, listSocialAccounts);
  router.get("/history", requireAuth, listSocialPostHistory);
  router.get("/threads/connect", requireAuth, connectThreads);
  router.get("/threads/callback", threadsOauthCallback);
  router.post("/threads/disconnect", requireAuth, disconnectThreads);
  router.post("/threads/post", requireAuth, createThreadsPost);
  router.post("/upload/public-media", requireAuth, handleSocialPublicUpload, uploadPublicSocialMedia);
  router.get("/meta/connect", requireAuth, connectMetaPlatform);
  router.get("/meta/upgrade/connect", requireAuth, connectMetaUpgradePlatform);
  router.get("/meta/callback", metaOauthCallback);
  router.get("/instagram/login", requireAuth, connectInstagramPlatform);
  router.get("/instagram/callback", instagramOauthCallback);
  router.post("/instagram/post", requireAuth, postToInstagram);
  router.get("/:platform/connect", requireAuth, connectSocialPlatform);
  router.post("/:platform/manual-connect", requireAuth, manualConnectSocialPlatform);
  router.get("/:platform/callback", oauthCallback);
  router.post("/:platform/disconnect", requireAuth, disconnectSocialPlatform);
  router.post("/:platform/refresh", requireAuth, refreshSocialPlatform);
  router.get("/:platform/status", requireAuth, socialPlatformStatus);

  return router;
}
