import axios from "axios";
import { createOAuthService } from "./sharedOAuth.js";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const defaultScopes = ["r_liteprofile", "w_member_social", "r_organization_social", "w_organization_social"];
const configuredScopes = process.env.LINKEDIN_SCOPES
  ? process.env.LINKEDIN_SCOPES.split(/[,\s]+/).filter(Boolean)
  : defaultScopes;
const hasOpenIdScopes = configuredScopes.some((scope) => ["openid", "profile", "email"].includes(scope));
const linkedinProfileUrl = hasOpenIdScopes ? "https://api.linkedin.com/v2/userinfo" : "https://api.linkedin.com/v2/me";

function extractOrganizationId(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/organization:(\d+)/i);
    return match?.[1] || "";
  }
  if (typeof value === "object") {
    const urn = value.urn || value.id || value.organizationalTarget || value.organizationalTargetUrn;
    if (typeof urn === "string") {
      const match = urn.match(/organization:(\d+)/i);
      return match?.[1] || "";
    }
  }
  return "";
}

function pickLinkedInOrgLogo(org) {
  const candidates =
    org?.logoV2?.["original~"]?.elements ||
    org?.logoV2?.original || // non-standard
    org?.logoV2?.elements ||
    [];
  if (!Array.isArray(candidates)) return "";
  for (const el of candidates) {
    const identifiers = el?.identifiers;
    if (!Array.isArray(identifiers)) continue;
    const first = identifiers.find((item) => typeof item?.identifier === "string" && item.identifier.startsWith("http"));
    if (first?.identifier) return first.identifier;
  }
  return "";
}

const linkedinService = createOAuthService({
  platform: "linkedin",
  clientId: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  redirectUri: resolveProviderRedirectUri("linkedin"),
  authUrl: "https://www.linkedin.com/oauth/v2/authorization",
  tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
  // OIDC (`openid profile email`) returns user info from /v2/userinfo.
  // Classic API scopes (`r_liteprofile`) return profile from /v2/me.
  profileUrl: linkedinProfileUrl,
  scopes: configuredScopes,
});

linkedinService.getManagedEntities = async function getManagedEntities(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
  };

  let acl;
  try {
    const response = await axios.get("https://api.linkedin.com/v2/organizationalEntityAcls", {
      headers,
      params: {
        q: "roleAssignee",
        role: "ADMINISTRATOR",
        state: "APPROVED",
      },
    });
    acl = response.data;
  } catch (error) {
    const status = error?.response?.status || 500;
    const message = error?.response?.data?.message || error?.message || "LinkedIn organization lookup failed.";
    const err = new Error(message);
    err.status = status;
    err.code = status === 403 ? "linkedin_orgs_forbidden" : "linkedin_orgs_failed";
    throw err;
  }

  const elements = Array.isArray(acl?.elements) ? acl.elements : [];
  const orgIds = Array.from(
    new Set(
      elements
        .map((item) => extractOrganizationId(item?.organizationalTarget || item?.organizationalTargetUrn || item))
        .filter(Boolean)
    )
  );
  if (!orgIds.length) return [];

  const organizations = await Promise.all(
    orgIds.map(async (orgId) => {
      try {
        const response = await axios.get(`https://api.linkedin.com/v2/organizations/${orgId}`, {
          headers,
          params: {
            projection: "(id,localizedName,vanityName,logoV2(original~:playableStreams))",
          },
        });
        const org = response.data || {};
        return {
          entityType: "organization",
          entityId: orgId.toString(),
          name: org.localizedName || org.vanityName || `Organization ${orgId}`,
          profileImage: pickLinkedInOrgLogo(org),
          metadata: {
            vanityName: org.vanityName || "",
            rawOrganization: org,
          },
        };
      } catch {
        return {
          entityType: "organization",
          entityId: orgId.toString(),
          name: `Organization ${orgId}`,
          profileImage: "",
          metadata: {},
        };
      }
    })
  );

  return organizations;
};

export default linkedinService;
