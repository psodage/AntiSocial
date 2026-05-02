/** @typedef {'profile' | 'page' | 'organization' | 'channel' | 'account'} PostingTargetBadge */

/**
 * @typedef {object} PostingTargetCard
 * @property {string} key
 * @property {PostingTargetBadge} badge
 * @property {string} title
 * @property {string} sublabel
 * @property {string} imageUrl
 * @property {string} path
 */

/**
 * @typedef {object} PostingTargetsConfig
 * @property {string} title
 * @property {string} description
 * @property {string} [primaryCtaLabel]
 * @property {string} [primaryCtaPath]
 * @property {PostingTargetCard[]} cards
 * @property {{ tone: 'neutral' | 'amber', text: string } | null} [emptyBanner]
 */

function entityDisplayName(entity) {
  return entity?.accountName || entity?.name || entity?.username || "Untitled";
}

function placeholderImage(platformKey) {
  const abbrev =
    {
      instagram: "IG",
      threads: "TH",
      youtube: "YT",
      x: "X",
      reddit: "RD",
      pinterest: "PI",
      telegram: "TG",
      discord: "DC",
      googleBusiness: "GB",
      facebook: "FB",
      linkedin: "LI",
    }[platformKey] || "PO";
  return `https://placehold.co/96x96/0f172a/94a3b8?text=${encodeURIComponent(abbrev)}`;
}

function getFacebookPagesList(account) {
  const fromMetadata = Array.isArray(account.metadata?.pages) ? account.metadata.pages : [];
  if (fromMetadata.length) {
    return fromMetadata.filter((p) => p?.id).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }
  return (Array.isArray(account.entities) ? account.entities : []).filter((entity) => entity.entityType === "page");
}

/**
 * @param {string} platformKey
 * @param {object | null | undefined} account Grouped social account from API (`entities`, `metadata`, …).
 * @returns {PostingTargetsConfig | null}
 */
export function buildPostingTargetsConfig(platformKey, account) {
  if (!account?.isConnected) return null;

  const entities = Array.isArray(account.entities) ? account.entities : [];

  const primaryRow = () => ({
    entityId: account.entityId || account.platformUserId,
    accountName: account.accountName,
    username: account.username,
    profileImage: account.profileImage,
  });

  if (platformKey === "facebook") {
    const facebookPagesList = getFacebookPagesList(account);
    const profileEntity = entities.find((e) => e.entityType === "profile") || null;
    const profileRow = profileEntity || { ...primaryRow(), entityType: "profile" };
    /** @type {PostingTargetCard[]} */
    const cards = [
      {
        key: `profile-${profileRow.entityId || account.platformUserId}`,
        badge: "profile",
        title: entityDisplayName(profileRow),
        sublabel: "Personal profile",
        imageUrl: profileRow.profileImage || placeholderImage("facebook"),
        path: "/create-post?platform=facebook",
      },
    ];
    for (const page of facebookPagesList) {
      cards.push({
        key: `page-${page.id}`,
        badge: "page",
        title: page.name || "Untitled page",
        sublabel: `Facebook Page · ID ${page.id}${page.hasLinkedInstagram ? " · Instagram linked" : ""}`,
        imageUrl: placeholderImage("facebook"),
        path: `/create-post?platform=facebook&entityId=${encodeURIComponent(page.id)}`,
      });
    }
    const pageDiscoveryErrorCode = account.metadata?.pageDiscoveryErrorCode;
    const emptyBanner =
      facebookPagesList.length === 0
        ? {
            tone: pageDiscoveryErrorCode === "meta_pages_permission_missing" ? "amber" : "neutral",
            text:
              pageDiscoveryErrorCode === "meta_pages_permission_missing"
                ? "Meta did not return Pages for this token (often missing pages_show_list or Page access in your app). Your personal profile card above still works; update Meta Login permissions and reconnect."
                : "No Facebook Pages were returned for this login. Ensure your Meta app requests Page access and that you manage at least one Page, then reconnect.",
          }
        : null;

    return {
      title: "Available pages",
      description:
        "Post as your personal profile or as a Facebook Page. Choose a card to open the composer with the right target.",
      primaryCtaLabel: "Create post (profile)",
      primaryCtaPath: "/create-post?platform=facebook",
      cards,
      emptyBanner,
    };
  }

  if (platformKey === "linkedin") {
    const profileRow =
      entities.find((e) => e.entityType === "profile") ||
      entities.find((e) => e.isPrimary && e.entityType !== "organization") ||
      null;
    const orgRows = entities
      .filter((e) => e.entityType === "organization")
      .sort((a, b) => entityDisplayName(a).localeCompare(entityDisplayName(b)));

    /** @type {PostingTargetCard[]} */
    const cards = [];
    if (profileRow) {
      cards.push({
        key: `profile-${profileRow.entityId || account.platformUserId}`,
        badge: "profile",
        title: entityDisplayName(profileRow),
        sublabel: "Personal profile",
        imageUrl: profileRow.profileImage || placeholderImage("linkedin"),
        path: "/create-post?platform=linkedin",
      });
    } else {
      const row = { ...primaryRow(), entityType: "profile" };
      cards.push({
        key: `profile-fallback-${account.platformUserId}`,
        badge: "profile",
        title: entityDisplayName(row),
        sublabel: "Personal profile",
        imageUrl: row.profileImage || placeholderImage("linkedin"),
        path: "/create-post?platform=linkedin",
      });
    }
    for (const org of orgRows) {
      cards.push({
        key: `org-${org.entityId}`,
        badge: "organization",
        title: entityDisplayName(org),
        sublabel: org.entityId ? `Company page · ID ${org.entityId}` : "Company page",
        imageUrl: org.profileImage || placeholderImage("linkedin"),
        path: `/create-post?platform=linkedin&entityId=${encodeURIComponent(org.entityId)}`,
      });
    }

    const linkedInOrgDiscoveryCode = account.metadata?.organizationDiscoveryErrorCode;
    const emptyBanner =
      orgRows.length === 0
        ? {
            tone:
              linkedInOrgDiscoveryCode === "linkedin_orgs_forbidden" || linkedInOrgDiscoveryCode === "linkedin_orgs_failed"
                ? "amber"
                : "neutral",
            text:
              linkedInOrgDiscoveryCode === "linkedin_orgs_forbidden"
                ? "LinkedIn did not return company pages for this token (often missing Community Management / organization APIs on your app, or the member is not an approved admin). Your personal profile card above still works; update the LinkedIn developer app products and scopes, then reconnect."
                : linkedInOrgDiscoveryCode === "linkedin_orgs_failed"
                  ? "Company pages could not be loaded from LinkedIn (temporary or configuration issue). Your personal profile card above still works; try reconnecting."
                  : "No company pages were returned for this login. Ensure your LinkedIn app has organization scopes and that your member is an admin of the page, then reconnect.",
          }
        : null;

    return {
      title: "Available pages",
      description:
        "Post as your personal profile or as a company page. Choose a card to open the composer with the right target.",
      primaryCtaLabel: "Create post (profile)",
      primaryCtaPath: "/create-post?platform=linkedin",
      cards,
      emptyBanner,
    };
  }

  /** Single-target platforms: one card from the primary connection. */
  const single = (title, description, sublabel, badge) => {
    const row = entities[0] || primaryRow();
    return {
      title,
      description,
      primaryCtaLabel: "Create post",
      primaryCtaPath: `/create-post?platform=${platformKey}`,
      cards: [
        {
          key: `target-${row.entityId || account.platformUserId}`,
          badge,
          title: entityDisplayName(row),
          sublabel,
          imageUrl: row.profileImage || placeholderImage(platformKey),
          path: `/create-post?platform=${platformKey}`,
        },
      ],
      emptyBanner: null,
    };
  };

  if (platformKey === "instagram") {
    const at = account.metadata?.accountType;
    return single(
      "Available posting targets",
      "Your connected Instagram account used as the publishing target.",
      at ? `Professional account · ${at}` : "Instagram professional / creator account",
      "account"
    );
  }

  if (platformKey === "threads") {
    return single(
      "Available posting targets",
      "Your connected Threads profile for publishing.",
      "Threads profile",
      "profile"
    );
  }

  if (platformKey === "youtube") {
    return single(
      "Available posting targets",
      "Your connected YouTube channel for uploads and publishing.",
      "YouTube channel",
      "channel"
    );
  }

  if (platformKey === "x") {
    return single("Available posting targets", "Your connected X profile for posting.", "X profile", "profile");
  }

  if (platformKey === "reddit") {
    return single(
      "Available posting targets",
      "Your connected Reddit account. Choose subreddit or post options in the composer when supported.",
      "Reddit account",
      "account"
    );
  }

  if (platformKey === "pinterest") {
    return single(
      "Available posting targets",
      "Your connected Pinterest account. Boards and pins can be chosen in the composer when supported.",
      "Pinterest account",
      "account"
    );
  }

  if (platformKey === "telegram") {
    return single(
      "Available posting targets",
      "Bot connection for Telegram. Target chats or channels are configured per post where supported.",
      "Telegram bot",
      "account"
    );
  }

  if (platformKey === "discord") {
    return single(
      "Available posting targets",
      "Your connected Discord user. Channels and webhooks are chosen per post where supported.",
      "Discord account",
      "account"
    );
  }

  if (platformKey === "googleBusiness") {
    return single(
      "Available posting targets",
      "Your connected Google account with Business Profile access. Pick a verified location in the composer when posting.",
      "Google Business Profile",
      "organization"
    );
  }

  return null;
}
