import { ObjectId } from "mongodb";
import { getAppConfig, getProviderEnvStatus, getRequiredEnvStatus } from "../config/social.config.js";
import { createOAuthState, validateOAuthState } from "../utils/oauthState.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";
import { getProvider } from "../services/social/providerRegistry.js";
import { META_SCOPE_SETS } from "../services/social/meta.service.js";
import { getSafeProviderDebugInfo, validateProviderConfig } from "../utils/providerConfig.util.js";
import {
  disconnectAccount,
  getAccountsForUser,
  getAccountStatus,
  getStoredAccountForProvider,
  refreshAccountToken,
  upsertConnectedAccount,
} from "../services/social/socialAccount.service.js";

const META_PLATFORMS = new Set(["facebook"]);
const META_UPGRADE_SCOPE_SETS = {
  pages_show_list: META_SCOPE_SETS.pages,
  instagram_basic: [...META_SCOPE_SETS.pages, ...META_SCOPE_SETS.instagramBasic],
  publishing: [...META_SCOPE_SETS.pages, ...META_SCOPE_SETS.instagramBasic, ...META_SCOPE_SETS.publishing],
  insights: [...META_SCOPE_SETS.pages, ...META_SCOPE_SETS.instagramBasic, ...META_SCOPE_SETS.insights],
  all: [
    ...META_SCOPE_SETS.pages,
    ...META_SCOPE_SETS.instagramBasic,
    ...META_SCOPE_SETS.publishing,
    ...META_SCOPE_SETS.insights,
  ],
};

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
  if (normalized.includes("unable to read facebook pages")) return "no_page_found";
  if (normalized.includes("already linked to another antisocial user")) return "account_already_linked";
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
    const state = createOAuthState({ userId: req.auth.userId, platform, flow });
    const authUrl = provider.getAuthUrl(state);
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
      scopes: "public_profile,email",
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

    const tokenData = await provider.exchangeCodeForToken(code);
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
      await upsertConnectedAccount({
        userId: new ObjectId(decodedState.userId),
        platform: "facebook",
        profile: {
          ...userProfile,
          entityType: "profile",
          entityId: userProfile.platformUserId,
          capabilities: ["posting", "analytics"],
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
      await upsertConnectedAccount({
        userId: new ObjectId(decodedState.userId),
        platform,
        profile: {
          ...profile,
          entityType: profile.entityType || "profile",
          entityId: profile.entityId || profile.platformUserId,
        },
        tokenData,
      });

      const managedEntities = await provider.getManagedEntities(tokenData.accessToken, profile);
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
    return res.redirect(makeRedirectUrl(flow, "connected"));
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
