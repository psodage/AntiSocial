import { ObjectId } from "mongodb";
import crypto from "crypto";
import { getAppConfig, getProviderEnvStatus, getRequiredEnvStatus } from "../config/social.config.js";
import { createOAuthState, validateOAuthState } from "../utils/oauthState.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";
import { getProvider } from "../services/social/providerRegistry.js";
import instagramService, { publishInstagramContent, INSTAGRAM_CAPTION_MAX_LENGTH } from "../services/social/instagram.service.js";
import { META_SCOPE_SETS } from "../services/social/meta.service.js";
import { decryptToken, encryptToken } from "../utils/crypto.js";
import { publishFacebookPagePost } from "../services/social/facebookPublish.service.js";
import { getSafeProviderDebugInfo, validateProviderConfig } from "../utils/providerConfig.util.js";
import { getPlatformCapabilities } from "../config/platformCapabilities.js";
import {
  disconnectAccount,
  getAccountsForUser,
  getAccountStatus,
  getLinkedInAccountForToken,
  getLinkedInOrganizationAccount,
  getStoredAccountForProvider,
  refreshAccountToken,
  upsertConnectedAccount,
} from "../services/social/socialAccount.service.js";
import linkedinProvider from "../services/social/linkedin.service.js";

const META_PLATFORMS = new Set(["facebook"]);
const META_UPGRADE_SCOPE_SETS = {
  pages_show_list: [...META_SCOPE_SETS.pages, ...META_SCOPE_SETS.pagePosting],
  instagram_basic: [...META_SCOPE_SETS.pages, ...META_SCOPE_SETS.pagePosting, ...META_SCOPE_SETS.instagramBasic],
  publishing: [
    ...META_SCOPE_SETS.pages,
    ...META_SCOPE_SETS.pagePosting,
    ...META_SCOPE_SETS.instagramBasic,
    ...META_SCOPE_SETS.publishing,
  ],
  insights: [
    ...META_SCOPE_SETS.pages,
    ...META_SCOPE_SETS.pagePosting,
    ...META_SCOPE_SETS.instagramBasic,
    ...META_SCOPE_SETS.insights,
  ],
  all: [
    ...META_SCOPE_SETS.pages,
    ...META_SCOPE_SETS.pagePosting,
    ...META_SCOPE_SETS.instagramBasic,
    ...META_SCOPE_SETS.publishing,
    ...META_SCOPE_SETS.insights,
  ],
};

function toBase64Url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createPkcePair() {
  const verifier = toBase64Url(crypto.randomBytes(48));
  const challenge = toBase64Url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function getClientUrl() {
  return getAppConfig().clientBaseUrl;
}

function normalizePlatform(platform) {
  if (platform === "google") return "youtube";
  return platform;
}

function resolvePlatform(platform) {
  const normalized = normalizePlatform(platform);
  const provider = getProvider(normalized);
  if (!provider) {
    throw new Error("Unsupported social platform.");
  }
  return { platform: normalized, provider };
}

function mapProviderErrorReason(error, errorDescription = "") {
  const normalizedDescription = (errorDescription || "").toLowerCase();
  if (error === "access_denied") return "login_canceled";
  if (error === "invalid_scope") return "invalid_scope";
  if (normalizedDescription.includes("invalid scopes")) return "invalid_scope";
  return errorDescription || error || "oauth_error";
}

function mapCallbackReason(callbackError) {
  if (!callbackError?.message) return "oauth_callback_failed";
  const normalized = callbackError.message.toLowerCase();
  if (callbackError?.code) return callbackError.code;
  if (normalized.includes("missing authorization code")) return "missing_code";
  if (normalized.includes("missing oauth state") || normalized.includes("invalid oauth state")) return "invalid_state";
  if (normalized.includes("no facebook pages")) return "no_facebook_pages";
  if (normalized.includes("no linked instagram professional account")) return "no_instagram_professional_account";
  if (normalized.includes("invalid scope")) return "invalid_scope";
  if (normalized.includes("permission")) return "invalid_scope";
  if (normalized.includes("profile fetch failed")) return "invalid_scope";
  if (normalized.includes("unable to identify social account")) return "profile_identification_failed";
  if (normalized.includes("unable to read facebook pages")) return "no_page_found";
  if (normalized.includes("already linked to another problogbooster user")) return "account_already_linked";
  if (normalized.includes("token")) return "token_error";
  return "oauth_callback_failed";
}

function resolveMetaUpgradeScopes(scopeSet) {
  const normalizedScopeSet = (scopeSet || "all").toString().toLowerCase();
  const scopes = META_UPGRADE_SCOPE_SETS[normalizedScopeSet];
  if (!scopes) {
    const error = new Error("Invalid scope_set. Use pages_show_list, instagram_basic, publishing, insights, or all.");
    error.code = "invalid_scope_set";
    error.status = 400;
    throw error;
  }
  return { normalizedScopeSet, scopes };
}

export async function listSocialAccounts(req, res) {
  try {
    const accounts = await getAccountsForUser(new ObjectId(req.auth.userId));
    return successResponse(res, { accounts }, "Fetched social accounts.");
  } catch (error) {
    return errorResponse(res, "Unable to fetch connected accounts.", 500, error.message);
  }
}

export async function connectSocialPlatform(req, res) {
  try {
    const requestedPlatform = req.params.platform;
    const flow = req.query?.flow === "onboarding" ? "onboarding" : "settings";
    const { platform, provider } = resolvePlatform(requestedPlatform);
    const providerConfig = validateProviderConfig(platform);
    if (!providerConfig.valid) {
      return errorResponse(res, `${platform} OAuth config is missing required environment variables.`, 400, providerConfig.missing);
    }
    const pkce = platform === "x" ? createPkcePair() : null;
    const state = createOAuthState({
      userId: req.auth.userId,
      platform,
      flow,
      ...(pkce ? { pkceVerifier: pkce.verifier } : {}),
    });
    const authUrl = provider.getAuthUrl(
      state,
      pkce
        ? {
            code_challenge: pkce.challenge,
            code_challenge_method: "S256",
          }
        : {}
    );
    console.info("[oauth:connect:start]", {
      platform,
      flow,
      userId: req.auth.userId,
      callbackPath: `/api/social/${requestedPlatform}/callback`,
      debug: getSafeProviderDebugInfo(platform),
    });
    return successResponse(res, { url: authUrl, state }, "OAuth URL generated.");
  } catch (error) {
    console.error("[oauth:connect:error]", {
      platform: req.params?.platform,
      userId: req.auth?.userId,
      message: error?.message,
    });
    return errorResponse(res, error.message || "Unable to start OAuth flow.", 400, error.message);
  }
}

export async function manualConnectSocialPlatform(req, res) {
  try {
    const requestedPlatform = req.params.platform;
    const { platform, provider } = resolvePlatform(requestedPlatform);
    const capabilities = getPlatformCapabilities(platform);
    if (capabilities?.oauth !== false) {
      return errorResponse(res, `${platform} uses OAuth connect flow.`, 400, "oauth_required");
    }

    const providerConfig = validateProviderConfig(platform);
    if (!providerConfig.valid) {
      return errorResponse(res, `${platform} manual setup is missing required environment variables.`, 400, providerConfig.missing);
    }

    const profile = await provider.getProfile();
    if (!profile?.platformUserId) {
      return errorResponse(res, `Unable to identify ${platform} profile from environment settings.`, 400, "profile_identification_failed");
    }

    const tokenData = {
      accessToken: process.env.TELEGRAM_BOT_TOKEN || "",
      refreshToken: "",
      tokenType: "Bot",
      expiresIn: null,
      scopes: [],
    };

    const account = await upsertConnectedAccount({
      userId: new ObjectId(req.auth.userId),
      platform,
      profile: {
        ...profile,
        entityType: profile.entityType || "bot",
        entityId: profile.entityId || profile.platformUserId,
      },
      tokenData,
    });

    return successResponse(res, { account }, `${platform} connected via manual bot setup.`);
  } catch (error) {
    return errorResponse(res, error.message || "Unable to manually connect platform.", 400, error.message);
  }
}

export async function connectInstagramPlatform(req, res) {
  req.params.platform = "instagram";
  return connectSocialPlatform(req, res);
}

export async function connectMetaPlatform(req, res) {
  const requestedMetaPlatform = (req.query?.platform || "facebook").toString().toLowerCase();
  if (!["facebook", "instagram"].includes(requestedMetaPlatform)) {
    return errorResponse(res, "Invalid Meta platform. Use facebook or instagram.", 400);
  }
  const flow = req.query?.flow === "onboarding" ? "onboarding" : "settings";
  try {
    const provider = getProvider(requestedMetaPlatform);
    if (!provider) {
      return errorResponse(res, "Unsupported Meta platform.", 400);
    }
    const providerConfig = validateProviderConfig(requestedMetaPlatform);
    if (!providerConfig.valid) {
      return errorResponse(res, `${requestedMetaPlatform} OAuth config is missing required environment variables.`, 400, providerConfig.missing);
    }
    const state = createOAuthState({ userId: req.auth.userId, platform: requestedMetaPlatform, flow });
    const authUrl = provider.getAuthUrl(state);
    console.info("[oauth:meta:connect:start]", {
      requestedMetaPlatform,
      flow,
      userId: req.auth.userId,
      hasMetaAppId: Boolean(process.env.META_APP_ID),
      redirectUri: getAppConfig().metaRedirectUri || "missing",
      authMode: "classic_scope",
      scopes:
        requestedMetaPlatform === "facebook"
          ? "public_profile,email,pages_show_list,pages_read_engagement,pages_manage_posts"
          : "public_profile,email",
    });
    return successResponse(res, { url: authUrl, state }, "Meta OAuth URL generated.");
  } catch (error) {
    console.error("[oauth:meta:connect:error]", {
      requestedMetaPlatform,
      userId: req.auth?.userId,
      message: error?.message,
      code: error?.code,
    });
    return errorResponse(res, error.message || "Unable to start Meta OAuth flow.", error?.status || 400, error?.code || error.message);
  }
}

export async function connectMetaUpgradePlatform(req, res) {
  const requestedMetaPlatform = (req.query?.platform || "facebook").toString().toLowerCase();
  if (!["facebook", "instagram"].includes(requestedMetaPlatform)) {
    return errorResponse(res, "Invalid Meta platform. Use facebook or instagram.", 400);
  }

  try {
    const provider = getProvider(requestedMetaPlatform);
    if (!provider?.getAdvancedAuthUrl) {
      return errorResponse(res, "Unsupported Meta provider for permission upgrade.", 400);
    }
    const providerConfig = validateProviderConfig(requestedMetaPlatform);
    if (!providerConfig.valid) {
      return errorResponse(res, `${requestedMetaPlatform} OAuth config is missing required environment variables.`, 400, providerConfig.missing);
    }
    const { normalizedScopeSet, scopes } = resolveMetaUpgradeScopes(req.query?.scope_set);
    const flow = req.query?.flow === "onboarding" ? "onboarding" : "settings";
    const state = createOAuthState({ userId: req.auth.userId, platform: requestedMetaPlatform, flow });
    const authUrl = provider.getAdvancedAuthUrl(state, scopes);
    return successResponse(
      res,
      { url: authUrl, state, scopeSet: normalizedScopeSet, scopes },
      "Meta permission upgrade URL generated."
    );
  } catch (error) {
    return errorResponse(
      res,
      error.message || "Unable to start Meta permission upgrade flow.",
      error?.status || 400,
      error?.code || error.message
    );
  }
}

async function handleOAuthCallback(req, res, requestedPlatform) {
  const normalizedPlatform = normalizePlatform(requestedPlatform || "meta");
  const { code, state, error, error_description: errorDescription } = req.query;
  const clientBaseUrl = getClientUrl();

  const makeRedirectUrl = (flow, status, reason = "", platform = normalizedPlatform) => {
    const path = flow === "onboarding" ? "/onboarding/platforms" : "/settings";
    const reasonParam = reason ? `&reason=${encodeURIComponent(reason)}` : "";
    return `${clientBaseUrl}${path}?social_platform=${platform}&social_status=${status}${reasonParam}`;
  };

  let flowForRedirect = "settings";
  let platformForRedirect = normalizedPlatform;
  try {
    const decodedState = validateOAuthState(state, requestedPlatform === "meta" ? undefined : normalizedPlatform);
    const statePlatform = normalizePlatform(decodedState.platform);
    const { platform, provider } = resolvePlatform(statePlatform);
    const flow = decodedState?.flow === "onboarding" ? "onboarding" : "settings";
    flowForRedirect = flow;
    platformForRedirect = platform;
    if (error) {
      console.error("[oauth:callback:provider-error]", {
        platform,
        flow,
        userId: decodedState?.userId,
        providerError: error,
        providerErrorDescription: errorDescription,
      });
      return res.redirect(makeRedirectUrl(flow, "error", mapProviderErrorReason(error, errorDescription)));
    }
    if (!code) {
      throw new Error("Missing authorization code.");
    }

    const tokenData = await provider.exchangeCodeForToken(code, {
      ...(platform === "x" && decodedState?.pkceVerifier ? { codeVerifier: decodedState.pkceVerifier } : {}),
      ...(platform === "x" ? { useBasicClientAuth: true } : {}),
    });
    if (!tokenData?.accessToken) {
      throw new Error("No access token received from provider.");
    }
    if (META_PLATFORMS.has(platform)) {
      const userProfile = await provider.getUserProfile(tokenData.accessToken);
      if (!userProfile?.platformUserId) {
        throw new Error("Unable to identify Facebook account from Meta profile.");
      }

      let pages = [];
      let pageDiscoveryErrorCode = null;
      try {
        pages = await provider.getPages(tokenData.accessToken);
      } catch (pagesError) {
        if (pagesError?.code === "meta_pages_permission_missing") {
          pageDiscoveryErrorCode = pagesError.code;
        } else {
          throw pagesError;
        }
      }

      const linkedInstagram = pages.length ? await provider.getLinkedInstagramAccount(tokenData.accessToken, pages) : null;
      const pagePublishingTokens = {};
      for (const page of pages) {
        const pid = page?.id != null ? String(page.id) : "";
        if (!pid || !page.access_token) continue;
        const enc = encryptToken(page.access_token);
        if (enc) pagePublishingTokens[pid] = enc;
      }
      await upsertConnectedAccount({
        userId: new ObjectId(decodedState.userId),
        platform: "facebook",
        profile: {
          ...userProfile,
          entityType: "profile",
          entityId: userProfile.platformUserId,
          capabilities: ["posting", "analytics"],
          pagePublishingTokens,
          metadata: {
            ...(userProfile.metadata || {}),
            pages: pages.map((page) => ({
              id: page.id || "",
              name: page.name || "",
              hasLinkedInstagram: Boolean(page.instagram_business_account?.id),
              linkedInstagramId: page.instagram_business_account?.id || "",
            })),
            linkedInstagramAccount: linkedInstagram?.profile
              ? {
                  id: linkedInstagram.profile.platformUserId,
                  username: linkedInstagram.profile.username,
                  name: linkedInstagram.profile.accountName,
                }
              : null,
            pageDiscoveryErrorCode,
          },
        },
        tokenData,
      });
    } else {
      const profile = await provider.getProfile(tokenData.accessToken);
      if (!profile?.platformUserId) {
        throw new Error("Unable to identify social account from provider profile.");
      }

      let managedEntities = [];
      let organizationDiscoveryErrorCode = null;
      if (typeof provider.getManagedEntities === "function") {
        try {
          managedEntities = await provider.getManagedEntities(tokenData.accessToken, profile);
        } catch (discoveryError) {
          const code = discoveryError?.code;
          if (
            platform === "linkedin" &&
            (code === "linkedin_orgs_forbidden" || code === "linkedin_orgs_failed")
          ) {
            organizationDiscoveryErrorCode = code;
            console.warn("[oauth:callback:linkedin-orgs]", {
              userId: decodedState.userId,
              code,
              message: discoveryError?.message,
            });
          } else {
            throw discoveryError;
          }
        }
      }

      await upsertConnectedAccount({
        userId: new ObjectId(decodedState.userId),
        platform,
        profile: {
          ...profile,
          entityType: profile.entityType || "profile",
          entityId: profile.entityId || profile.platformUserId,
          metadata: {
            ...(profile.metadata || {}),
            ...(organizationDiscoveryErrorCode ? { organizationDiscoveryErrorCode } : {}),
          },
        },
        tokenData,
      });

      if (Array.isArray(managedEntities) && managedEntities.length) {
        for (const entity of managedEntities) {
          if (!entity?.entityId) continue;
          await upsertConnectedAccount({
            userId: new ObjectId(decodedState.userId),
            platform,
            profile: {
              platformUserId: profile.platformUserId,
              entityType: entity.entityType || "page",
              entityId: entity.entityId,
              accountName: entity.name || profile.accountName || "",
              username: profile.username || "",
              email: profile.email || "",
              profileImage: entity.profileImage || profile.profileImage || "",
              capabilities: profile.capabilities || profile?.metadata?.capabilities || [],
              metadata: {
                ...profile.metadata,
                managedEntity: entity,
              },
              isPrimary: false,
            },
            tokenData,
          });
        }
      }
    }
    console.info("[oauth:callback:result]", {
      platform,
      flow,
      userId: decodedState.userId,
      status: "connected",
    });
    return res.redirect(makeRedirectUrl(flow, "connected", "", platform));
  } catch (callbackError) {
    console.error("[oauth:callback:error]", {
      platform: platformForRedirect,
      message: callbackError?.message,
      code: callbackError?.code,
    });
    console.info("[oauth:callback:result]", {
      platform: platformForRedirect,
      flow: flowForRedirect,
      status: "error",
      code: callbackError?.code || "oauth_callback_failed",
    });
    return res.redirect(
      makeRedirectUrl(flowForRedirect, "error", mapCallbackReason(callbackError), platformForRedirect)
    );
  }
}

export async function oauthCallback(req, res) {
  return handleOAuthCallback(req, res, req.params.platform);
}

export async function metaOauthCallback(req, res) {
  return handleOAuthCallback(req, res, "meta");
}

export async function instagramOauthCallback(req, res) {
  return handleOAuthCallback(req, res, "instagram");
}

export async function disconnectSocialPlatform(req, res) {
  try {
    const { platform } = req.params;
    const { provider, platform: normalizedPlatform } = resolvePlatform(platform);
    await provider.disconnectAccount();
    const account = await disconnectAccount(new ObjectId(req.auth.userId), normalizedPlatform);
    return successResponse(res, { account }, `${normalizedPlatform} disconnected.`);
  } catch (error) {
    return errorResponse(res, error.message || "Unable to disconnect account.", 400, error.message);
  }
}

export async function refreshSocialPlatform(req, res) {
  try {
    const { platform } = req.params;
    const { provider, platform: normalizedPlatform } = resolvePlatform(platform);
    const account = await getStoredAccountForProvider(new ObjectId(req.auth.userId), normalizedPlatform);
    if (!account) {
      return errorResponse(res, "No connected account found.", 404, "Account not found.");
    }
    const refreshed = await provider.refreshTokenIfNeeded(account);
    if (!refreshed) {
      const status = await getAccountStatus(new ObjectId(req.auth.userId), normalizedPlatform);
      return successResponse(res, { account: status, refreshed: false }, "Token still valid.");
    }
    const status = await refreshAccountToken(new ObjectId(req.auth.userId), normalizedPlatform, refreshed);
    return successResponse(res, { account: status, refreshed: true }, "Token refreshed.");
  } catch (error) {
    return errorResponse(res, error.message || "Unable to refresh token.", 400, error.message);
  }
}

export async function socialPlatformStatus(req, res) {
  try {
    const { platform } = req.params;
    resolvePlatform(platform);
    const account = await getAccountStatus(new ObjectId(req.auth.userId), platform);
    return successResponse(res, { account }, "Fetched platform status.");
  } catch (error) {
    return errorResponse(res, error.message || "Unable to fetch status.", 400, error.message);
  }
}

const X_POST_MAX_LENGTH = 280;

function parseXContent(body) {
  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Invalid request body.");
    err.status = 400;
    err.code = "invalid_body";
    throw err;
  }
  const { content } = body;
  if (content === undefined || content === null) {
    const err = new Error("Post content is required.");
    err.status = 400;
    throw err;
  }
  if (typeof content !== "string") {
    const err = new Error("Post content must be a string.");
    err.status = 400;
    throw err;
  }
  if (content.length > 4096) {
    const err = new Error(`Post content cannot exceed ${X_POST_MAX_LENGTH} characters.`);
    err.status = 400;
    throw err;
  }
  const trimmed = content.trim();
  if (!trimmed.length) {
    const err = new Error("Post content cannot be empty.");
    err.status = 400;
    throw err;
  }
  if (trimmed.length > X_POST_MAX_LENGTH) {
    const err = new Error(`Post content cannot exceed ${X_POST_MAX_LENGTH} characters.`);
    err.status = 400;
    throw err;
  }
  return trimmed;
}

export async function createXPost(req, res) {
  let content;
  try {
    content = parseXContent(req.body);
  } catch (validationError) {
    return errorResponse(res, validationError.message, validationError.status || 400, validationError.code || "validation_error");
  }

  const userId = new ObjectId(req.auth.userId);

  try {
    const account = await getStoredAccountForProvider(userId, "x");
    if (!account || !account.isConnected) {
      return errorResponse(
        res,
        "X account is not connected or token expired. Please reconnect your X account.",
        401,
        "not_connected"
      );
    }

    const { provider } = resolvePlatform("x");
    if (typeof provider.createTweet !== "function") {
      return errorResponse(res, "X publishing is not available.", 500, "provider_error");
    }

    let accessToken = account.getDecryptedAccessToken();
    if (!accessToken) {
      return errorResponse(
        res,
        "X account is not connected or token expired. Please reconnect your X account.",
        401,
        "no_token"
      );
    }

    const tokenExpired = account.expiresAt && new Date(account.expiresAt).getTime() <= Date.now();
    if (tokenExpired) {
      try {
        const refreshed = await provider.refreshTokenIfNeeded(account);
        if (refreshed) {
          await refreshAccountToken(userId, "x", refreshed);
          accessToken = refreshed.accessToken;
        }
      } catch (refreshError) {
        console.error("[x:post:refresh:error]", { message: refreshError?.message, code: refreshError?.code });
        return errorResponse(
          res,
          refreshError.message || "X account is not connected or token expired. Please reconnect your X account.",
          refreshError.status || 401,
          refreshError.code || "token_refresh_failed"
        );
      }
    }

    if (!accessToken) {
      return errorResponse(
        res,
        "X account is not connected or token expired. Please reconnect your X account.",
        401,
        "no_token"
      );
    }

    let tweetData;
    let retriedUnauthorized = false;
    for (;;) {
      try {
        tweetData = await provider.createTweet(accessToken, content);
        break;
      } catch (apiError) {
        const canRetry =
          apiError.code === "x_unauthorized" &&
          !retriedUnauthorized &&
          typeof account.getDecryptedRefreshToken === "function" &&
          account.getDecryptedRefreshToken();
        if (canRetry) {
          retriedUnauthorized = true;
          try {
            const refreshed = await provider.refreshTokenIfNeeded({
              expiresAt: new Date(0),
              getDecryptedRefreshToken: () => account.getDecryptedRefreshToken(),
            });
            if (refreshed) {
              await refreshAccountToken(userId, "x", refreshed);
              accessToken = refreshed.accessToken;
              continue;
            }
          } catch (retryRefreshError) {
            console.error("[x:post:retry-refresh:error]", { message: retryRefreshError?.message });
          }
        }
        console.error("[x:post:api:error]", {
          message: apiError?.message,
          code: apiError?.code,
          status: apiError?.status,
        });
        const clientMessage =
          apiError.status === 401 || apiError.status === 403
            ? "X account is not connected or token expired. Please reconnect your X account."
            : apiError.message || "Could not publish post on X.";
        return errorResponse(res, clientMessage, apiError.status >= 400 && apiError.status < 600 ? apiError.status : 502, apiError.code || "x_post_failed");
      }
    }

    const postId = tweetData?.data?.id ? String(tweetData.data.id) : "";
    const safePayload = {
      id: tweetData?.data?.id ? String(tweetData.data.id) : undefined,
      text: typeof tweetData?.data?.text === "string" ? tweetData.data.text : undefined,
    };

    return successResponse(
      res,
      { postId, data: safePayload },
      "Post published successfully on X"
    );
  } catch (error) {
    console.error("[x:post:error]", { message: error?.message });
    return errorResponse(res, error.message || "Could not publish post on X.", 500, error.code || "x_post_error");
  }
}

const LINKEDIN_POST_MAX_LENGTH = 3000;

function isValidHttpUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function parseLinkedInPostBody(body) {
  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Invalid request body.");
    err.status = 400;
    err.code = "invalid_body";
    throw err;
  }

  const targetType = typeof body.targetType === "string" ? body.targetType.trim().toLowerCase() : "";
  if (!targetType) {
    const err = new Error("targetType is required.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  if (!["profile", "organization"].includes(targetType)) {
    const err = new Error("targetType must be profile or organization.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  let organizationId = null;
  if (body.organizationId !== undefined && body.organizationId !== null && body.organizationId !== "") {
    organizationId = String(body.organizationId).trim();
  }

  if (targetType === "organization") {
    if (!organizationId) {
      const err = new Error("organizationId is required for organization posts.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!/^\d+$/.test(organizationId)) {
      const err = new Error("organizationId must be a numeric LinkedIn organization ID.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  } else if (organizationId) {
    const err = new Error("organizationId must be omitted when targetType is profile.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  const mediaTypeRaw = typeof body.mediaType === "string" ? body.mediaType.trim().toUpperCase() : "TEXT";
  if (!["TEXT", "IMAGE", "VIDEO", "LINK"].includes(mediaTypeRaw)) {
    const err = new Error("mediaType must be one of: TEXT, IMAGE, VIDEO, LINK.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (mediaTypeRaw === "IMAGE" || mediaTypeRaw === "VIDEO") {
    const err = new Error("Image and video posts are not supported yet. Use text or link post, or reconnect after a future update.");
    err.status = 400;
    err.code = "media_not_supported";
    throw err;
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  const mediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl.trim() : "";
  const linkUrl = typeof body.linkUrl === "string" ? body.linkUrl.trim() : "";

  if (mediaUrl) {
    const err = new Error("Media URL upload is not supported yet for LinkedIn in this app.");
    err.status = 400;
    err.code = "media_not_supported";
    throw err;
  }

  if (mediaTypeRaw === "LINK") {
    if (!linkUrl) {
      const err = new Error("linkUrl is required for link posts.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!isValidHttpUrl(linkUrl)) {
      const err = new Error("linkUrl must be a valid http(s) URL.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  } else {
    if (linkUrl) {
      const err = new Error("linkUrl is only allowed when mediaType is LINK.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!content) {
      const err = new Error("Post content is required for text posts and cannot be only spaces.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  }

  const hasPayload = Boolean(content || linkUrl || mediaUrl);
  if (!hasPayload) {
    const err = new Error("Either content, mediaUrl, or linkUrl is required.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (content.length > LINKEDIN_POST_MAX_LENGTH) {
    const err = new Error(`Post content cannot exceed ${LINKEDIN_POST_MAX_LENGTH} characters.`);
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  return {
    targetType,
    organizationId: targetType === "organization" ? organizationId : null,
    mediaType: mediaTypeRaw,
    content,
    linkUrl: mediaTypeRaw === "LINK" ? linkUrl : "",
  };
}

const FACEBOOK_MESSAGE_MAX = 63206;

function parseFacebookPostBody(body) {
  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Invalid request body.");
    err.status = 400;
    err.code = "invalid_body";
    throw err;
  }

  const pageId = typeof body.pageId === "string" ? body.pageId.trim() : body.pageId != null ? String(body.pageId).trim() : "";
  if (!pageId) {
    const err = new Error("pageId is required.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  const mediaTypeRaw = typeof body.mediaType === "string" ? body.mediaType.trim().toUpperCase() : "";
  if (!mediaTypeRaw || !["TEXT", "IMAGE", "VIDEO", "LINK"].includes(mediaTypeRaw)) {
    const err = new Error("mediaType is required and must be one of: TEXT, IMAGE, VIDEO, LINK.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (typeof body.message !== "string" && body.message != null) {
    const err = new Error("message must be a string if provided.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  if (typeof body.mediaUrl !== "string" && body.mediaUrl != null) {
    const err = new Error("mediaUrl must be a string if provided.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  if (typeof body.linkUrl !== "string" && body.linkUrl != null) {
    const err = new Error("linkUrl must be a string if provided.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const mediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl.trim() : "";
  const linkUrl = typeof body.linkUrl === "string" ? body.linkUrl.trim() : "";

  if (message.length > FACEBOOK_MESSAGE_MAX) {
    const err = new Error(`message cannot exceed ${FACEBOOK_MESSAGE_MAX} characters.`);
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (body.message != null && typeof body.message === "string" && body.message.length > 0 && !message.length) {
    const err = new Error("message cannot be only spaces.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (mediaTypeRaw === "TEXT") {
    if (mediaUrl || linkUrl) {
      const err = new Error("mediaUrl and linkUrl must be empty when mediaType is TEXT.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!message) {
      const err = new Error("message is required for text posts.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  }

  if (mediaTypeRaw === "LINK") {
    if (mediaUrl) {
      const err = new Error("mediaUrl is not used for link posts.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!linkUrl) {
      const err = new Error("linkUrl is required for link posts.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!isValidHttpUrl(linkUrl)) {
      const err = new Error("linkUrl must be a valid http(s) URL.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  }

  if (mediaTypeRaw === "IMAGE" || mediaTypeRaw === "VIDEO") {
    if (linkUrl) {
      const err = new Error("linkUrl must be empty for image or video posts.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!mediaUrl) {
      const err = new Error(`mediaUrl is required for ${mediaTypeRaw.toLowerCase()} posts.`);
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!isValidHttpUrl(mediaUrl)) {
      const err = new Error("mediaUrl must be a valid http(s) URL.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  }

  const hasPayload = Boolean(message || mediaUrl || linkUrl);
  if (!hasPayload) {
    const err = new Error("Either message, mediaUrl, or linkUrl is required.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  return {
    pageId,
    mediaType: mediaTypeRaw,
    message,
    mediaUrl: mediaTypeRaw === "IMAGE" || mediaTypeRaw === "VIDEO" ? mediaUrl : "",
    linkUrl: mediaTypeRaw === "LINK" ? linkUrl : "",
  };
}

export async function createFacebookPost(req, res) {
  let parsed;
  try {
    parsed = parseFacebookPostBody(req.body);
  } catch (validationError) {
    return errorResponse(res, validationError.message, validationError.status || 400, validationError.code || "validation_error");
  }

  const userId = new ObjectId(req.auth.userId);
  const reconnectMessage = "Facebook Page is not connected or token expired. Please reconnect your Facebook Page.";

  try {
    const account = await getStoredAccountForProvider(userId, "facebook");
    if (!account || !account.isConnected) {
      return errorResponse(res, reconnectMessage, 401, "not_connected");
    }

    const allowedIds = new Set(
      (Array.isArray(account.metadata?.pages) ? account.metadata.pages : [])
        .map((p) => (p?.id != null ? String(p.id) : ""))
        .filter(Boolean)
    );
    if (!allowedIds.has(parsed.pageId)) {
      return errorResponse(
        res,
        "You cannot post to a Facebook Page you do not manage, or the page is not connected.",
        403,
        "page_not_allowed"
      );
    }

    const enc =
      account.pagePublishingTokens?.[parsed.pageId] ||
      account.pagePublishingTokens?.[String(parsed.pageId)];
    const pageToken = enc ? decryptToken(enc) : null;
    if (!pageToken) {
      console.warn("[facebook:post:missing-page-token]", { userId: String(userId), pageId: parsed.pageId });
      return errorResponse(res, reconnectMessage, 401, "page_token_missing");
    }

    let result;
    try {
      result = await publishFacebookPagePost({
        pageId: parsed.pageId,
        pageAccessToken: pageToken,
        mediaType: parsed.mediaType,
        message: parsed.message,
        mediaUrl: parsed.mediaUrl,
        linkUrl: parsed.linkUrl,
      });
    } catch (apiError) {
      console.error("[facebook:post:api:error]", {
        message: apiError?.message,
        code: apiError?.code,
        status: apiError?.status,
      });
      const code = apiError?.details?.error?.code;
      const sub = apiError?.details?.error?.error_subcode;
      const expiredOrAuth =
        apiError?.status === 401 ||
        apiError?.status === 403 ||
        code === 190 ||
        code === 102 ||
        code === 10 ||
        sub === 463 ||
        sub === 467;
      const clientMessage = expiredOrAuth ? reconnectMessage : apiError.message || "Could not publish post on Facebook.";
      return errorResponse(
        res,
        clientMessage,
        apiError.status >= 400 && apiError.status < 600 ? apiError.status : 502,
        apiError.code || "facebook_post_failed"
      );
    }

    const safeRaw = result.raw && typeof result.raw === "object" ? result.raw : {};
    return successResponse(res, { postId: result.postId, data: safeRaw }, "Post published successfully on Facebook");
  } catch (error) {
    console.error("[facebook:post:error]", { message: error?.message });
    return errorResponse(res, error.message || "Could not publish post on Facebook.", 500, error.code || "facebook_post_error");
  }
}

export async function createLinkedInPost(req, res) {
  let parsed;
  try {
    parsed = parseLinkedInPostBody(req.body);
  } catch (validationError) {
    return errorResponse(res, validationError.message, validationError.status || 400, validationError.code || "validation_error");
  }

  const userId = new ObjectId(req.auth.userId);
  const reconnectMessage = "LinkedIn account is not connected or token expired. Please reconnect your LinkedIn account.";

  try {
    const tokenAccount = await getLinkedInAccountForToken(userId);
    if (!tokenAccount || !tokenAccount.isConnected) {
      return errorResponse(res, reconnectMessage, 401, "not_connected");
    }

    let accessToken = tokenAccount.getDecryptedAccessToken();
    if (!accessToken) {
      return errorResponse(res, reconnectMessage, 401, "no_token");
    }

    const tokenExpired = tokenAccount.expiresAt && new Date(tokenAccount.expiresAt).getTime() <= Date.now();
    if (tokenExpired) {
      console.warn("[linkedin:post:token-expired]", { userId: String(userId) });
      return errorResponse(res, reconnectMessage, 401, "token_expired");
    }

    const personId = tokenAccount.platformUserId ? String(tokenAccount.platformUserId).trim() : "";
    if (!personId) {
      console.error("[linkedin:post:missing-person-id]", { userId: String(userId) });
      return errorResponse(res, reconnectMessage, 401, "invalid_account");
    }

    let authorUrn;
    if (parsed.targetType === "profile") {
      authorUrn = `urn:li:person:${personId}`;
    } else {
      const orgAccount = await getLinkedInOrganizationAccount(userId, parsed.organizationId);
      if (!orgAccount) {
        return errorResponse(
          res,
          "You do not have access to post as this LinkedIn company page, or it is not connected. Pick a page you manage or reconnect LinkedIn.",
          403,
          "organization_not_allowed"
        );
      }
      authorUrn = `urn:li:organization:${parsed.organizationId}`;
    }

    const commentary = parsed.content;
    const apiMediaType = parsed.mediaType === "LINK" ? "LINK" : "TEXT";
    const linkUrl = parsed.linkUrl || "";

    let result;
    try {
      result = await linkedinProvider.createUgcPost(accessToken, {
        authorUrn,
        commentary,
        mediaType: apiMediaType,
        linkUrl: apiMediaType === "LINK" ? linkUrl : undefined,
      });
    } catch (apiError) {
      console.error("[linkedin:post:api:error]", {
        message: apiError?.message,
        code: apiError?.code,
        status: apiError?.status,
      });
      const clientMessage =
        apiError?.status === 401 || apiError?.status === 403 || apiError?.code === "linkedin_unauthorized"
          ? reconnectMessage
          : apiError.message || "Could not publish post on LinkedIn.";
      return errorResponse(
        res,
        clientMessage,
        apiError.status >= 400 && apiError.status < 600 ? apiError.status : 502,
        apiError.code || "linkedin_post_failed"
      );
    }

    const postId = result.id || "";

    return successResponse(
      res,
      { postId, data: { id: postId } },
      "Post published successfully on LinkedIn"
    );
  } catch (error) {
    console.error("[linkedin:post:error]", { message: error?.message });
    return errorResponse(res, error.message || "Could not publish post on LinkedIn.", 500, error.code || "linkedin_post_error");
  }
}

export async function debugSocialEnvCheck(req, res) {
  const appConfig = getAppConfig();
  return successResponse(
    res,
    {
      required: getRequiredEnvStatus(),
      providers: getProviderEnvStatus(),
      appConfig: {
        appBaseUrl: appConfig.appBaseUrl,
        clientBaseUrl: appConfig.clientBaseUrl,
        googleRedirectUri: appConfig.googleRedirectUri || "missing",
        googleBusinessRedirectUri: appConfig.googleBusinessRedirectUri || "missing",
        linkedinRedirectUri: appConfig.linkedinRedirectUri || "missing",
        metaRedirectUri: appConfig.metaRedirectUri || "missing",
        instagramRedirectUri: appConfig.instagramRedirectUri || "missing",
        hasInstagramClientId: Boolean(appConfig.instagramClientId),
      },
    },
    "Environment diagnostics loaded."
  );
}

const INSTAGRAM_RECONNECT_MESSAGE =
  "Instagram account is not connected or token expired. Please reconnect your Instagram account.";

function stripInstagramCaption(caption) {
  if (caption == null) return "";
  return String(caption).replace(/\u0000/g, "").trim();
}

function validateInstagramMediaUrl(url, label = "mediaUrl") {
  if (url == null || typeof url !== "string" || !url.trim()) {
    const err = new Error(`${label} is required.`);
    err.code = "validation";
    err.status = 400;
    throw err;
  }
  const trimmed = url.trim();
  if (trimmed.length > 2048) {
    const err = new Error(`${label} is too long.`);
    err.code = "validation";
    err.status = 400;
    throw err;
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    const err = new Error(`${label} must be a valid URL.`);
    err.code = "validation";
    err.status = 400;
    throw err;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    const err = new Error(`${label} must use http or https.`);
    err.code = "validation";
    err.status = 400;
    throw err;
  }
  return trimmed;
}

function parseInstagramCarouselUrls(body) {
  const raw = body?.mediaUrls;
  if (Array.isArray(raw)) {
    return raw.map((u) => (u != null ? String(u).trim() : "")).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/[\n,]/)
      .map((u) => u.trim())
      .filter(Boolean);
  }
  return [];
}

export async function postToInstagram(req, res) {
  try {
    const userId = new ObjectId(req.auth.userId);
    const captionRaw = stripInstagramCaption(req.body?.caption);
    if (captionRaw.length > INSTAGRAM_CAPTION_MAX_LENGTH) {
      return errorResponse(res, `Caption must be at most ${INSTAGRAM_CAPTION_MAX_LENGTH} characters.`, 400, "caption_too_long");
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "caption") && captionRaw.length > 0 && !captionRaw.replace(/\s/g, "").length) {
      return errorResponse(res, "Caption cannot be only spaces.", 400, "caption_whitespace_only");
    }

    const mediaType = (req.body?.mediaType || "").toString().trim().toUpperCase();
    if (!["IMAGE", "VIDEO", "REEL", "CAROUSEL"].includes(mediaType)) {
      return errorResponse(res, "mediaType must be IMAGE, VIDEO, REEL, or CAROUSEL.", 400, "invalid_media_type");
    }

    let account = await getStoredAccountForProvider(userId, "instagram");
    if (!account?.isConnected) {
      return errorResponse(res, INSTAGRAM_RECONNECT_MESSAGE, 401, "instagram_not_connected");
    }

    const accountType = (account.metadata?.accountType || "").toString().toUpperCase();
    if (accountType === "PERSONAL") {
      return errorResponse(
        res,
        "This Instagram account is a personal profile. Connect a Business or Creator account to publish.",
        400,
        "instagram_personal_account"
      );
    }

    let accessToken = account.getDecryptedAccessToken?.();
    if (!accessToken) {
      return errorResponse(res, INSTAGRAM_RECONNECT_MESSAGE, 401, "instagram_token_missing");
    }

    if (account.expiresAt && new Date(account.expiresAt).getTime() <= Date.now()) {
      try {
        const refreshed = await instagramService.refreshTokenIfNeeded(account);
        if (refreshed?.accessToken) {
          await refreshAccountToken(userId, "instagram", refreshed);
          account = await getStoredAccountForProvider(userId, "instagram");
          accessToken = account.getDecryptedAccessToken?.();
        } else {
          return errorResponse(res, INSTAGRAM_RECONNECT_MESSAGE, 401, "instagram_token_expired");
        }
      } catch (refreshErr) {
        console.warn("[instagram:post:refresh-failed]", { message: refreshErr?.message });
        return errorResponse(res, INSTAGRAM_RECONNECT_MESSAGE, 401, "instagram_token_expired");
      }
    }

    if (!accessToken) {
      return errorResponse(res, INSTAGRAM_RECONNECT_MESSAGE, 401, "instagram_token_missing");
    }

    const igUserId = account.platformUserId?.toString() || "";
    if (!igUserId) {
      return errorResponse(res, INSTAGRAM_RECONNECT_MESSAGE, 401, "instagram_user_unknown");
    }

    let mediaUrl;
    let mediaUrls;

    try {
      if (mediaType === "CAROUSEL") {
        const list = parseInstagramCarouselUrls(req.body);
        mediaUrls = list.map((u, i) => validateInstagramMediaUrl(u, `mediaUrls[${i}]`));
        if (mediaUrls.length < 2 || mediaUrls.length > 10) {
          return errorResponse(res, "Carousel requires between 2 and 10 media URLs.", 400, "instagram_carousel_count");
        }
      } else {
        mediaUrl = validateInstagramMediaUrl(req.body?.mediaUrl, "mediaUrl");
      }
    } catch (validationErr) {
      return errorResponse(res, validationErr.message || "Invalid request.", validationErr.status || 400, validationErr.code || "validation");
    }

    const result = await publishInstagramContent({
      accessToken,
      igUserId,
      mediaType,
      mediaUrl,
      mediaUrls,
      caption: captionRaw.length ? captionRaw : undefined,
    });

    return res.status(200).json({
      success: true,
      message: "Post published successfully on Instagram",
      postId: result.postId,
      data: { creationId: result.creationId },
    });
  } catch (error) {
    const code = error?.code || "";
    const status = Number(error?.status) || 500;
    const metaCode = error?.details?.error?.code;
    console.error("[instagram:post:error]", {
      code,
      message: error?.message,
      metaCode,
    });

    if (
      code === "instagram_token_missing" ||
      code === "instagram_token_refresh_failed" ||
      status === 401 ||
      metaCode === 190
    ) {
      return errorResponse(res, INSTAGRAM_RECONNECT_MESSAGE, 401, code || "instagram_auth");
    }

    if (code === "instagram_graph_error" && error?.details?.error?.message) {
      const httpStatus = status >= 400 && status < 600 ? status : 400;
      return errorResponse(res, error.details.error.message, httpStatus, code);
    }

    const httpStatus = status >= 400 && status < 600 ? status : 500;
    return errorResponse(res, error.message || "Unable to publish to Instagram.", httpStatus, code);
  }
}
