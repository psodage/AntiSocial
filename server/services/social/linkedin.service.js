import axios from "axios";
import { createOAuthService } from "./sharedOAuth.js";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

// `r_organization_admin` / org posting scopes are required for company page ACLs + posting.
// See: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-access-control-by-role
const defaultScopes = [
  "r_liteprofile",
  "w_member_social",
  "r_organization_social",
  "w_organization_social",
  "r_organization_admin",
];
const configuredScopes = process.env.LINKEDIN_SCOPES
  ? process.env.LINKEDIN_SCOPES.split(/[,\s]+/).filter(Boolean)
  : defaultScopes;
const hasOpenIdScopes = configuredScopes.some((scope) => ["openid", "profile", "email"].includes(scope));
const linkedinProfileUrl = hasOpenIdScopes ? "https://api.linkedin.com/v2/userinfo" : "https://api.linkedin.com/v2/me";

function extractOrganizationId(value) {
  if (!value) return "";
  if (typeof value === "string") {
    let match = value.match(/organization:(\d+)/i);
    if (match?.[1]) return match[1];
    match = value.match(/organizationBrand:(\d+)/i);
    return match?.[1] || "";
  }
  if (typeof value === "object") {
    const urn =
      value.urn ||
      value.id ||
      value.organizationalTarget ||
      value.organizationalTargetUrn ||
      value.organizationTarget ||
      value.organization;
    if (typeof urn === "string") {
      return extractOrganizationId(urn);
    }
  }
  return "";
}

/** ACL finder returns different field names depending on API version. */
function organizationIdFromAclElement(item) {
  if (!item || typeof item !== "object") return "";
  const direct = extractOrganizationId(
    item.organizationalTarget ||
      item.organizationalTargetUrn ||
      item.organizationTarget ||
      item.organization
  );
  if (direct) return direct;
  return extractOrganizationId(item);
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

const ACL_ROLES_FOR_PAGES = ["ADMINISTRATOR", "CONTENT_ADMINISTRATOR", "CURATOR", "ANALYST"];

linkedinService.getManagedEntities = async function getManagedEntities(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
  };

  let acl;
  try {
    const baseParams = { q: "roleAssignee", state: "APPROVED" };
    const fetchByRoles = async () => {
      const mergedElements = [];
      for (const role of ACL_ROLES_FOR_PAGES) {
        try {
          const r = await axios.get("https://api.linkedin.com/v2/organizationalEntityAcls", {
            headers,
            params: { ...baseParams, role },
          });
          const els = Array.isArray(r.data?.elements) ? r.data.elements : [];
          mergedElements.push(...els);
        } catch {
          /* continue */
        }
      }
      return mergedElements;
    };

    let response;
    try {
      response = await axios.get("https://api.linkedin.com/v2/organizationalEntityAcls", {
        headers,
        params: { ...baseParams },
      });
    } catch (unfilteredError) {
      const mergedElements = await fetchByRoles();
      if (!mergedElements.length) throw unfilteredError;
      acl = { elements: mergedElements };
      response = { data: acl };
    }

    if (!response) {
      throw new Error("LinkedIn ACL response missing.");
    }

    acl = response.data;
    const firstElements = Array.isArray(acl?.elements) ? acl.elements : [];
    if (!firstElements.length) {
      const mergedElements = await fetchByRoles();
      acl = { elements: mergedElements };
    }
  } catch (error) {
    const status = error?.response?.status || 500;
    const message = error?.response?.data?.message || error?.message || "LinkedIn organization lookup failed.";
    const err = new Error(message);
    err.status = status;
    err.code = status === 403 ? "linkedin_orgs_forbidden" : "linkedin_orgs_failed";
    throw err;
  }

  const elements = Array.isArray(acl?.elements) ? acl.elements : [];
  const orgIds = Array.from(new Set(elements.map((item) => organizationIdFromAclElement(item)).filter(Boolean)));
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

/**
 * @param {string} accessToken
 * @param {{ authorUrn: string, commentary: string, mediaType: 'TEXT' | 'LINK', linkUrl?: string }} options
 */
linkedinService.createUgcPost = async function createUgcPost(accessToken, { authorUrn, commentary, mediaType, linkUrl }) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };

  const trimmedCommentary = typeof commentary === "string" ? commentary.trim() : "";
  const isLink = mediaType === "LINK" && linkUrl;

  const shareContent = {
    shareCommentary: {
      text: trimmedCommentary || (isLink ? "Shared link" : ""),
    },
    shareMediaCategory: isLink ? "ARTICLE" : "NONE",
  };

  if (isLink) {
    const titleText = trimmedCommentary.slice(0, 200) || "Link";
    shareContent.media = [
      {
        status: "READY",
        originalUrl: linkUrl,
        title: { text: titleText },
      },
    ];
  }

  const body = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": shareContent,
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  try {
    const response = await axios.post("https://api.linkedin.com/v2/ugcPosts", body, { headers });
    const id = response.data?.id ? String(response.data.id) : "";
    return { id, raw: response.data };
  } catch (error) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const msg =
      (typeof data?.message === "string" && data.message) ||
      (typeof data?.errorDetail === "string" && data.errorDetail) ||
      error?.message ||
      "LinkedIn publish request failed.";
    const err = new Error(msg);
    err.status = status || 502;
    err.code = status === 401 || status === 403 ? "linkedin_unauthorized" : "linkedin_post_failed";
    err.details = data;
    throw err;
  }
};

export default linkedinService;
