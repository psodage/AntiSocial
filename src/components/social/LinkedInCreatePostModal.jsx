import { useEffect, useMemo, useRef, useState } from "react";
import { X as CloseIcon } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { postToLinkedIn } from "../../services/socialApi";

const MAX_CHARS = 3000;

function isValidHttpUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object | null | undefined} props.account Grouped LinkedIn account from AppContext (`entities`, …).
 * @param {{ targetType: 'profile' | 'organization', organizationId: string | null }} props.preset
 */
export default function LinkedInCreatePostModal({ open, onClose, account, preset }) {
  const { setToast } = useApp();
  const [content, setContent] = useState("");
  const [targetType, setTargetType] = useState("profile");
  const [organizationId, setOrganizationId] = useState("");
  const [mediaType, setMediaType] = useState("TEXT");
  const [linkUrl, setLinkUrl] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [posting, setPosting] = useState(false);
  const prevOpen = useRef(false);

  const organizations = useMemo(() => {
    const entities = Array.isArray(account?.entities) ? account.entities : [];
    return entities
      .filter((e) => e.entityType === "organization" && e.entityId)
      .sort((a, b) => (a.accountName || "").localeCompare(b.accountName || ""));
  }, [account?.entities]);

  const hasOrganizations = organizations.length > 0;

  useEffect(() => {
    if (open && !prevOpen.current) {
      const p = preset || { targetType: "profile", organizationId: null };
      setTargetType(p.targetType === "organization" && hasOrganizations ? "organization" : "profile");
      setOrganizationId(
        p.targetType === "organization" && p.organizationId && hasOrganizations ? String(p.organizationId) : ""
      );
      setContent("");
      setMediaType("TEXT");
      setLinkUrl("");
      setErrors({});
      setSubmitError("");
    }
    prevOpen.current = open;
  }, [open, preset, hasOrganizations]);

  useEffect(() => {
    if (targetType === "profile") {
      setOrganizationId("");
    } else if (!organizationId && organizations.length === 1) {
      setOrganizationId(String(organizations[0].entityId));
    }
  }, [targetType, organizations, organizationId]);

  if (!open) return null;

  const contentLen = content.length;
  const overLimit = contentLen > MAX_CHARS;
  const trimmedContent = content.trim();
  const trimmedLink = linkUrl.trim();

  const validate = () => {
    const next = {};
    if (targetType === "organization") {
      if (!hasOrganizations) {
        next.target = "No company pages are connected. Post to your profile or reconnect LinkedIn with organization access.";
      } else if (!organizationId) {
        next.target = "Select a company page to post as.";
      } else if (!organizations.some((o) => String(o.entityId) === String(organizationId))) {
        next.target = "That company page is not available on this connection.";
      }
    }
    if (mediaType === "TEXT") {
      if (!trimmedContent) {
        next.content = "Add post text, or switch to Link post and include a URL.";
      }
    }
    if (mediaType === "LINK") {
      if (!trimmedLink) {
        next.linkUrl = "Enter a valid http(s) URL for the link post.";
      } else if (!isValidHttpUrl(trimmedLink)) {
        next.linkUrl = "URL must start with http:// or https://";
      }
      if (trimmedContent.length > MAX_CHARS) {
        next.content = `Commentary cannot exceed ${MAX_CHARS} characters.`;
      }
    }
    if (mediaType === "TEXT" && trimmedContent.length > MAX_CHARS) {
      next.content = `Post cannot exceed ${MAX_CHARS} characters.`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const organizationInvalid =
    targetType === "organization" &&
    (!hasOrganizations ||
      !organizationId ||
      !organizations.some((o) => String(o.entityId) === String(organizationId)));

  const submitDisabled =
    posting ||
    overLimit ||
    organizationInvalid ||
    (mediaType === "TEXT" && !trimmedContent) ||
    (mediaType === "LINK" && (!trimmedLink || !isValidHttpUrl(trimmedLink)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    if (!validate()) return;
    setPosting(true);
    try {
      await postToLinkedIn({
        content: trimmedContent,
        targetType,
        organizationId: targetType === "organization" ? organizationId : null,
        mediaType,
        mediaUrl: "",
        linkUrl: mediaType === "LINK" ? trimmedLink : "",
      });
      setToast({ message: "Post published successfully on LinkedIn." });
      setContent("");
      setLinkUrl("");
      setErrors({});
      onClose();
    } catch (err) {
      const msg = err?.message || "Could not publish post on LinkedIn.";
      const lower = msg.toLowerCase();
      if (
        lower.includes("reconnect") ||
        lower.includes("not connected") ||
        lower.includes("token expired") ||
        lower.includes("unauthorized")
      ) {
        setSubmitError("LinkedIn account is not connected or token expired. Please reconnect your LinkedIn account.");
      } else {
        setSubmitError(msg);
      }
    } finally {
      setPosting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="li-create-post-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          onClick={onClose}
          disabled={posting}
          aria-label="Close"
        >
          <CloseIcon size={18} />
        </button>
        <h2 id="li-create-post-title" className="pr-8 text-lg font-semibold text-white">
          Create post on LinkedIn
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Text and link posts (up to {MAX_CHARS.toLocaleString()} characters). Image/video uploads are not available yet.
        </p>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-400">Posting as</span>
            <div className="flex flex-col gap-2 rounded-lg border border-slate-600 bg-slate-950/50 p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                <input
                  type="radio"
                  name="li-target"
                  className="border-slate-500 text-brand-500"
                  checked={targetType === "profile"}
                  onChange={() => {
                    setTargetType("profile");
                    setErrors((prev) => ({ ...prev, target: undefined }));
                  }}
                  disabled={posting}
                />
                LinkedIn profile
              </label>
              <label
                className={`flex cursor-pointer items-center gap-2 text-sm ${hasOrganizations ? "text-slate-200" : "cursor-not-allowed text-slate-500"}`}
              >
                <input
                  type="radio"
                  name="li-target"
                  className="border-slate-500 text-brand-500"
                  checked={targetType === "organization"}
                  onChange={() => {
                    if (!hasOrganizations) return;
                    setTargetType("organization");
                    setErrors((prev) => ({ ...prev, target: undefined }));
                  }}
                  disabled={posting || !hasOrganizations}
                />
                LinkedIn company page
              </label>
              {targetType === "organization" && hasOrganizations ? (
                <div className="mt-1 pl-6">
                  <label htmlFor="li-org-select" className="sr-only">
                    Company page
                  </label>
                  <select
                    id="li-org-select"
                    className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                    value={organizationId}
                    onChange={(e) => {
                      setOrganizationId(e.target.value);
                      setErrors((prev) => ({ ...prev, target: undefined }));
                    }}
                    disabled={posting}
                  >
                    <option value="">Select a page…</option>
                    {organizations.map((org) => (
                      <option key={org.entityId} value={String(org.entityId)}>
                        {org.accountName || org.username || `Organization ${org.entityId}`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
            {errors.target ? (
              <p className="mt-1 text-xs text-rose-400" role="alert">
                {errors.target}
              </p>
            ) : null}
            {!hasOrganizations ? (
              <p className="mt-2 text-xs text-amber-200/90">
                No company pages were found for this connection. You can still post to your profile; reconnect LinkedIn with
                organization permissions to manage pages.
              </p>
            ) : null}
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-slate-400">Post type</span>
            <select
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
              value={mediaType}
              onChange={(e) => {
                const v = e.target.value;
                setMediaType(v);
                setErrors({});
                setSubmitError("");
              }}
              disabled={posting}
            >
              <option value="TEXT">Text</option>
              <option value="LINK">Link / article</option>
              <option value="IMAGE" disabled>
                Image (not available yet)
              </option>
              <option value="VIDEO" disabled>
                Video (not available yet)
              </option>
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Image and video require LinkedIn media upload APIs; use Text or Link for now.
            </p>
          </div>

          <div>
            <label htmlFor="li-post-content" className="mb-1 block text-xs font-medium text-slate-400">
              {mediaType === "LINK" ? "Commentary (optional)" : "Post content"}
            </label>
            <textarea
              id="li-post-content"
              rows={6}
              maxLength={MAX_CHARS}
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
              placeholder={mediaType === "LINK" ? "Add context above your link…" : "What do you want to share?"}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setErrors((prev) => ({ ...prev, content: undefined }));
                setSubmitError("");
              }}
              disabled={posting}
              aria-invalid={Boolean(errors.content)}
              aria-describedby="li-post-content-count"
            />
            <div className="mt-1 flex justify-end text-xs text-slate-400">
              <span id="li-post-content-count" className={overLimit ? "text-rose-400" : ""}>
                {contentLen} / {MAX_CHARS}
              </span>
            </div>
            {errors.content ? (
              <p className="mt-1 text-xs text-rose-400" role="alert">
                {errors.content}
              </p>
            ) : null}
          </div>

          {mediaType === "LINK" ? (
            <div>
              <label htmlFor="li-link-url" className="mb-1 block text-xs font-medium text-slate-400">
                Link URL
              </label>
              <input
                id="li-link-url"
                type="url"
                inputMode="url"
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
                placeholder="https://…"
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  setErrors((prev) => ({ ...prev, linkUrl: undefined }));
                  setSubmitError("");
                }}
                disabled={posting}
                aria-invalid={Boolean(errors.linkUrl)}
              />
              {errors.linkUrl ? (
                <p className="mt-1 text-xs text-rose-400" role="alert">
                  {errors.linkUrl}
                </p>
              ) : null}
            </div>
          ) : null}

          {submitError ? (
            <p className="text-sm text-rose-400" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              onClick={onClose}
              disabled={posting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitDisabled}
            >
              {posting ? "Posting…" : "Post to LinkedIn"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
