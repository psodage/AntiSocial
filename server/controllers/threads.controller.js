import { ObjectId } from "mongodb";
import { getAppConfig } from "../config/social.config.js";
import { createOAuthState, validateOAuthState } from "../utils/oauthState.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";
import threadsService from "../services/social/threads.service.js";
import { validateProviderConfig, getSafeProviderDebugInfo } from "../utils/providerConfig.util.js";
import { disconnectAccount, upsertConnectedAccount } from "../services/social/socialAccount.service.js";

const THREADS_SCOPE_SETS = {
  basic: ["threads_basic"],
  publish: ["threads_basic", "threads_content_publish"],
  insights: ["threads_basic", "threads_manage_insights"],
  replies: ["threads_basic", "threads_read_replies", "threads_manage_replies"],
};

function getClientUrl() {
  return getAppConfig().clientBaseUrl;
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
  if (normalized.includes("redirect uri")) return "callback_mismatch";
  if (normalized.includes("token exchange")) return "token_error";
  if (normalized.includes("invalid scope")) return "invalid_scope";
  return "oauth_callback_failed";
}

function resolveRequestedThreadsScopes(req) {
  const scopeSetKey = (req.query?.scope_set || "").toString().trim().toLowerCase();
  if (scopeSetKey && THREADS_SCOPE_SETS[scopeSetKey]) {
    return { scopeSet: scopeSetKey, scopes: THREADS_SCOPE_SETS[scopeSetKey] };
  }

  const rawScopes = (req.query?.scopes || "").toString().trim();
  const scopes = rawScopes
    ? rawScopes
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : ["threads_basic"];

  return { scopeSet: scopeSetKey || "basic", scopes };
}

export async function connectThreads(req, res) {
  try {
    const flow = req.query?.flow === "onboarding" ? "onboarding" : "settings";
    const providerConfig = validateProviderConfig("threads");
    if (!providerConfig.valid) {
      return errorResponse(res, "threads OAuth config is missing required environment variables.", 400, providerConfig.missing);
    }

    const state = createOAuthState({ userId: req.auth.userId, platform: "threads", flow });
    const { scopeSet, scopes } = resolveRequestedThreadsScopes(req);
    const authUrl = threadsService.getAuthUrl(state, scopes);

    console.info("[oauth:threads:connect:start]", {
      platform: "threads",
      flow,
      userId: req.auth.userId,
      hasThreadsAppId: Boolean(process.env.THREADS_APP_ID),
      redirectUri: getAppConfig().threadsRedirectUri || "missing",
      authEndpoint: "https://threads.net/oauth/authorize",
      scopeSet,
      scopes,
      debug: getSafeProviderDebugInfo("threads"),
    });

    return successResponse(res, { url: authUrl, state, scopeSet, scopes }, "Threads OAuth URL generated.");
  } catch (error) {
    console.error("[oauth:threads:connect:error]", {
      platform: "threads",
      userId: req.auth?.userId,
      message: error?.message,
      code: error?.code,
    });
    return errorResponse(res, error.message || "Unable to start Threads OAuth flow.", error?.status || 400, error?.code || error.message);
  }
}

export async function threadsOauthCallback(req, res) {
  const { code, state, error, error_description: errorDescription } = req.query;
  const clientBaseUrl = getClientUrl();
  const makeRedirectUrl = (flow, status, reason = "") => {
    const path = flow === "onboarding" ? "/onboarding/platforms" : "/settings";
    const reasonParam = reason ? `&reason=${encodeURIComponent(reason)}` : "";
    return `${clientBaseUrl}${path}?social_platform=threads&social_status=${status}${reasonParam}`;
  };

  let flowForRedirect = "settings";
  try {
    const decodedState = validateOAuthState(state, "threads");
    const flow = decodedState?.flow === "onboarding" ? "onboarding" : "settings";
    flowForRedirect = flow;

    if (error) {
      console.error("[oauth:threads:callback:provider-error]", {
        platform: "threads",
        flow,
        userId: decodedState?.userId,
        providerError: error,
        providerErrorDescription: errorDescription,
      });
      return res.redirect(makeRedirectUrl(flow, "error", mapProviderErrorReason(error, errorDescription)));
    }

    if (!code) {
      const missing = new Error("Missing authorization code.");
      missing.code = "missing_code";
      missing.status = 400;
      throw missing;
    }

    const tokenData = await threadsService.exchangeCodeForToken(code);
    if (!tokenData?.accessToken) {
      throw new Error("No access token received from Threads.");
    }

    const profile = await threadsService.getProfile(tokenData.accessToken);
    if (!profile?.platformUserId) {
      throw new Error("Unable to identify Threads account from profile.");
    }

    await upsertConnectedAccount({
      userId: new ObjectId(decodedState.userId),
      platform: "threads",
      profile,
      tokenData,
    });

    console.info("[oauth:threads:callback:result]", {
      platform: "threads",
      flow,
      userId: decodedState.userId,
      status: "connected",
    });

    return res.redirect(makeRedirectUrl(flow, "connected"));
  } catch (callbackError) {
    console.error("[oauth:threads:callback:error]", {
      platform: "threads",
      message: callbackError?.message,
      code: callbackError?.code,
      details: callbackError?.details ? "present" : "none",
    });
    return res.redirect(makeRedirectUrl(flowForRedirect, "error", mapCallbackReason(callbackError)));
  }
}

export async function disconnectThreads(req, res) {
  try {
    await threadsService.disconnectAccount();
    const account = await disconnectAccount(new ObjectId(req.auth.userId), "threads");
    return successResponse(res, { account }, "threads disconnected.");
  } catch (error) {
    return errorResponse(res, error.message || "Unable to disconnect threads.", 400, error?.code || error.message);
  }
}

