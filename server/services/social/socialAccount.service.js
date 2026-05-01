import SocialAccount from "../../models/SocialAccount.js";
import { SOCIAL_PLATFORMS } from "./providerRegistry.js";
import { getPlatformCapabilities } from "../../config/platformCapabilities.js";
import { encryptToken } from "../../utils/crypto.js";

function normalizePlatform(platform) {
  if (platform === "google") return "youtube";
  return platform;
}

function mapAccount(account) {
  const expiresAt = account.expiresAt ? new Date(account.expiresAt) : null;
  const isExpired = !!expiresAt && expiresAt.getTime() <= Date.now();
  return {
    id: account._id,
    platform: account.platform,
    platformUserId: account.platformUserId,
    entityType: account.entityType || "profile",
    entityId: account.entityId || "",
    accountName: account.accountName,
    username: account.username,
    email: account.email,
    profileImage: account.profileImage,
    tokenType: account.tokenType,
    expiresAt,
    isTokenExpired: isExpired,
    scopes: account.scopes || [],
    capabilities: account.capabilities || [],
    isConnected: account.isConnected,
    isPrimary: Boolean(account.isPrimary),
    parentAccountId: account.parentAccountId || null,
    connectedByUserId: account.connectedByUserId || account.userId,
    metadata: account.metadata || {},
    lastSyncedAt: account.lastSyncedAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export async function getAccountsForUser(userId) {
  const docs = await SocialAccount.find({ userId }).sort({ createdAt: -1 });
  const grouped = docs.reduce((acc, item) => {
    const key = item.platform;
    if (!acc[key]) acc[key] = [];
    acc[key].push(mapAccount(item));
    return acc;
  }, {});

  return SOCIAL_PLATFORMS.map((platform) => {
    const entities = grouped[platform] || [];
    const primary = entities.find((entity) => entity.isPrimary) || entities[0] || null;
    return {
      platform,
      isConnected: entities.some((entity) => entity.isConnected),
      capabilities: getPlatformCapabilities(platform)?.badges || [],
      supportLevel: getPlatformCapabilities(platform)?.supportLevel || "limited",
      accountName: primary?.accountName || "",
      username: primary?.username || "",
      profileImage: primary?.profileImage || "",
      entityType: primary?.entityType || "profile",
      platformUserId: primary?.platformUserId || "",
      metadata: primary?.metadata || {},
      lastSyncedAt: primary?.lastSyncedAt || null,
      entities,
    };
  });
}

export async function getAccountStatus(userId, platform) {
  const normalizedPlatform = normalizePlatform(platform);
  const account = await SocialAccount.findOne({ userId, platform: normalizedPlatform });
  if (!account) return { platform: normalizedPlatform, isConnected: false };
  return mapAccount(account);
}

export async function upsertConnectedAccount({ userId, platform, profile, tokenData }) {
  const normalizedPlatform = normalizePlatform(platform);
  const entityType = profile.entityType || "profile";
  const entityId = profile.entityId || profile.platformUserId;

  const alreadyLinked = await SocialAccount.findOne({
    platform: normalizedPlatform,
    platformUserId: profile.platformUserId,
    userId: { $ne: userId },
  });
  if (alreadyLinked) {
    throw new Error("This social account is already linked to another ProBlogBooster user.");
  }

  const now = new Date();
  const account = await SocialAccount.findOneAndUpdate(
    { userId, platform: normalizedPlatform, entityType, entityId },
    {
      $set: {
        platformUserId: profile.platformUserId,
        entityType,
        entityId,
        accountName: profile.accountName || "",
        username: profile.username || "",
        email: profile.email || "",
        profileImage: profile.profileImage || "",
        tokenType: tokenData.tokenType || "Bearer",
        expiresAt: tokenData.expiresIn ? new Date(Date.now() + tokenData.expiresIn * 1000) : null,
        scopes: tokenData.scopes || [],
        isConnected: true,
        isPrimary: profile.isPrimary !== false,
        capabilities: Array.isArray(profile.capabilities) ? profile.capabilities : profile?.metadata?.capabilities || [],
        metadata: profile.metadata || {},
        lastSyncedAt: now,
        accessToken: encryptToken(tokenData.accessToken || ""),
        refreshToken: encryptToken(tokenData.refreshToken || ""),
        connectedByUserId: userId,
      },
      $setOnInsert: {
        userId,
        platform: normalizedPlatform,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  return mapAccount(account);
}

export async function disconnectAccount(userId, platform) {
  const normalizedPlatform = normalizePlatform(platform);
  await SocialAccount.deleteMany({ userId, platform: normalizedPlatform });
  return { platform: normalizedPlatform, isConnected: false };
}

export async function refreshAccountToken(userId, platform, refreshed) {
  const normalizedPlatform = normalizePlatform(platform);
  const account = await SocialAccount.findOne({ userId, platform: normalizedPlatform });
  if (!account) {
    throw new Error("No account connected for this platform.");
  }

  account.setEncryptedAccessToken(refreshed.accessToken);
  if (refreshed.refreshToken) account.setEncryptedRefreshToken(refreshed.refreshToken);
  account.tokenType = refreshed.tokenType || account.tokenType;
  account.expiresAt = refreshed.expiresIn ? new Date(Date.now() + refreshed.expiresIn * 1000) : account.expiresAt;
  account.lastSyncedAt = new Date();
  account.isConnected = true;
  await account.save();

  return mapAccount(account);
}

export async function getStoredAccountForProvider(userId, platform) {
  return SocialAccount.findOne({ userId, platform: normalizePlatform(platform) });
}
