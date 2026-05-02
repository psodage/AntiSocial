import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { getSocialAccounts, postToThreads, uploadSocialPublicMedia } from "../services/socialApi";
import { PLATFORM_CAPABILITY_MATRIX, SOCIAL_PLATFORM_CONFIGS } from "../data/socialPlatforms";

const PLATFORM_RULES = {
  x: "Keep posts concise. API tier determines analytics availability.",
  threads:
    "500 characters max. Media posts need a URL Threads can fetch (HTTPS, public internet). Uploads are stored on your API server at APP_BASE_URL.",
  reddit: "Choose an authenticated subreddit and post type (text/link/image).",
  pinterest: "Pins require visual media and board selection.",
  telegram: "Bot must be added as admin to target group/channel.",
  discord: "Use a permitted channel/webhook for announcements.",
  googleBusiness: "Select a verified business location before publishing.",
};

const BYTES_IN_MB = 1024 * 1024;

const PLATFORM_POST_LIMITS = {
  facebook: { maxChars: 63206, media: { accept: ["image/*", "video/*"], maxBytes: 25 * BYTES_IN_MB } },
  instagram: { maxChars: 2200, media: { accept: ["image/*", "video/*"], maxBytes: 8 * BYTES_IN_MB } },
  threads: { maxChars: 500, media: { accept: ["image/*", "video/*"], maxBytes: 8 * BYTES_IN_MB } },
  linkedin: { maxChars: 3000, media: { accept: ["image/*", "video/*"], maxBytes: 10 * BYTES_IN_MB } },
  youtube: { maxChars: 5000, media: { accept: ["video/*"], maxBytes: 256 * BYTES_IN_MB } },
  x: { maxChars: 280, media: { accept: ["image/*", "video/*"], maxBytes: 5 * BYTES_IN_MB } },
  reddit: { maxChars: 40000, media: { accept: ["image/*", "video/*"], maxBytes: 20 * BYTES_IN_MB } },
  pinterest: { maxChars: 500, media: { accept: ["image/*"], maxBytes: 10 * BYTES_IN_MB, required: true } },
  telegram: { maxChars: 4096, media: { accept: ["image/*", "video/*"], maxBytes: 20 * BYTES_IN_MB } },
  discord: { maxChars: 2000, media: { accept: ["image/*", "video/*"], maxBytes: 25 * BYTES_IN_MB } },
  googleBusiness: { maxChars: 1500, media: { accept: ["image/*", "video/*"], maxBytes: 10 * BYTES_IN_MB } },
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const mb = bytes / BYTES_IN_MB;
  return `${Math.round(mb)}MB`;
}

function inferThreadsMediaTypeFromUrl(url) {
  const u = (url || "").toLowerCase();
  if (/\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(u)) return "VIDEO";
  return "IMAGE";
}

export default function CreatePostPage() {
  const [caption, setCaption] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [entitySelection, setEntitySelection] = useState({});
  const [file, setFile] = useState(null);
  const [threadsMediaUrl, setThreadsMediaUrl] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [threadsComposerError, setThreadsComposerError] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setToast } = useApp();

  const scopedPlatformKey = useMemo(() => {
    const raw = searchParams.get("platform")?.trim() || "";
    if (!raw) return null;
    const known = SOCIAL_PLATFORM_CONFIGS.some((c) => c.key === raw);
    return known ? raw : null;
  }, [searchParams]);

  const entityIdFromUrl = useMemo(() => searchParams.get("entityId")?.trim() || "", [searchParams]);

  const mediaObjectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (mediaObjectUrl) URL.revokeObjectURL(mediaObjectUrl);
    };
  }, [mediaObjectUrl]);

  useEffect(() => {
    getSocialAccounts()
      .then(setConnectedAccounts)
      .catch(() => setConnectedAccounts([]));
  }, []);

  const connectedByPlatform = useMemo(
    () => connectedAccounts.reduce((acc, item) => ({ ...acc, [item.platform]: item }), {}),
    [connectedAccounts]
  );

  const connectedPlatformConfigs = useMemo(() => {
    return SOCIAL_PLATFORM_CONFIGS.filter((platformConfig) => Boolean(connectedByPlatform[platformConfig.key]?.isConnected));
  }, [connectedByPlatform]);

  const scopedAccountConnected = Boolean(scopedPlatformKey && connectedByPlatform[scopedPlatformKey]?.isConnected);

  const composerPlatformConfigs = useMemo(() => {
    if (scopedAccountConnected && scopedPlatformKey) {
      return connectedPlatformConfigs.filter((c) => c.key === scopedPlatformKey);
    }
    return connectedPlatformConfigs;
  }, [scopedAccountConnected, scopedPlatformKey, connectedPlatformConfigs]);

  useEffect(() => {
    if (!scopedPlatformKey) return;
    if (!connectedByPlatform[scopedPlatformKey]?.isConnected) return;
    setSelectedPlatform(scopedPlatformKey);
  }, [scopedPlatformKey, connectedByPlatform]);

  useEffect(() => {
    if (!entityIdFromUrl || !scopedPlatformKey) return;
    if (scopedPlatformKey !== "googleBusiness") return;
    setEntitySelection((prev) => ({ ...prev, googleBusiness: entityIdFromUrl }));
  }, [entityIdFromUrl, scopedPlatformKey]);

  useEffect(() => {
    setThreadsMediaUrl("");
    setThreadsComposerError("");
  }, [selectedPlatform]);

  const selectedPlatformConfig = useMemo(
    () => SOCIAL_PLATFORM_CONFIGS.find((item) => item.key === selectedPlatform) || null,
    [selectedPlatform]
  );

  const selectedLimits = useMemo(() => {
    if (!selectedPlatform) return null;
    return PLATFORM_POST_LIMITS[selectedPlatform] || null;
  }, [selectedPlatform]);

  const captionMaxLength = selectedLimits?.maxChars ?? 2200;
  const mediaAccept = selectedLimits?.media?.accept?.length ? selectedLimits.media.accept.join(",") : "image/*";
  const maxMediaBytes = selectedLimits?.media?.maxBytes ?? null;
  const isMediaRequired = Boolean(selectedLimits?.media?.required);

  const validatePlatformPayload = () => {
    if (!selectedPlatform) return "Select a platform.";
    const capability = PLATFORM_CAPABILITY_MATRIX[selectedPlatform];
    const account = connectedByPlatform[selectedPlatform];
    if (!account?.isConnected) return `${selectedPlatform} is not connected.`;
    if (selectedPlatform === "threads") {
      const urlT = threadsMediaUrl.trim();
      if (!caption.trim() && !file && !urlT) return "Add post text, a media file, or a public media URL.";
      if (urlT && file) return "For Threads, use either a media URL or a file upload—not both.";
      if (urlT) {
        try {
          const u = new URL(urlT);
          if (u.protocol !== "http:" && u.protocol !== "https:") return "Media URL must use http or https.";
        } catch {
          return "Enter a valid public media URL.";
        }
      }
    }
    if (isMediaRequired && !file) return `${selectedPlatformConfig?.label || selectedPlatform} publishing requires media.`;
    if (selectedPlatform === "googleBusiness" && !entitySelection[selectedPlatform]) return "Select a Google Business location.";
    if (selectedPlatform === "reddit" && !entitySelection[selectedPlatform]) return "Select a subreddit before posting to Reddit.";
    if (maxMediaBytes && file?.size && file.size > maxMediaBytes) {
      return `Media is too large for ${selectedPlatformConfig?.label || selectedPlatform}. Max ${formatBytes(maxMediaBytes)}.`;
    }
    if (file && selectedLimits?.media?.accept?.length) {
      const accepted = selectedLimits.media.accept;
      const matches = accepted.some((pattern) => {
        if (pattern.endsWith("/*")) {
          const prefix = pattern.slice(0, -1);
          return (file.type || "").startsWith(prefix);
        }
        return (file.type || "").toLowerCase() === pattern.toLowerCase();
      });
      if (!matches) return `Unsupported media type for ${selectedPlatformConfig?.label || selectedPlatform}.`;
    }
    if (capability?.supportLevel === "limited" && !capability?.badges?.includes("Posting")) {
      return `${selectedPlatform} posting is currently limited by official API capability.`;
    }
    return null;
  };

  useEffect(() => {
    if (!file || !selectedPlatform) return;
    const limits = PLATFORM_POST_LIMITS[selectedPlatform];
    if (!limits?.media) return;

    if (limits.media.maxBytes && file.size > limits.media.maxBytes) {
      setFile(null);
      setToast({
        message: `Media is too large for ${selectedPlatformConfig?.label || selectedPlatform}. Max ${formatBytes(limits.media.maxBytes)}.`,
        error: true,
      });
      return;
    }

    if (Array.isArray(limits.media.accept) && limits.media.accept.length) {
      const accepted = limits.media.accept;
      const matches = accepted.some((pattern) => {
        if (pattern.endsWith("/*")) {
          const prefix = pattern.slice(0, -1);
          return (file.type || "").startsWith(prefix);
        }
        return (file.type || "").toLowerCase() === pattern.toLowerCase();
      });
      if (!matches) {
        setFile(null);
        setToast({
          message: `Unsupported media type for ${selectedPlatformConfig?.label || selectedPlatform}.`,
          error: true,
        });
      }
    }
  }, [file, selectedPlatform, selectedPlatformConfig, setToast]);

  const publish = async () => {
    setThreadsComposerError("");
    if (!selectedPlatform) return setToast({ message: "Select a platform.", error: true });

    const urlT = threadsMediaUrl.trim();
    if (selectedPlatform === "threads") {
      if (!caption.trim() && !file && !urlT) {
        const msg = "Add post text, a media file, or a public media URL.";
        setThreadsComposerError(msg);
        return setToast({ message: msg, error: true });
      }
    } else if (!caption.trim() && !file) {
      return setToast({ message: "Add a caption or media before publishing.", error: true });
    }

    const validationError = validatePlatformPayload();
    if (validationError) {
      if (selectedPlatform === "threads") setThreadsComposerError(validationError);
      return setToast({ message: validationError, error: true });
    }

    if (selectedPlatform === "threads") {
      setIsPublishing(true);
      try {
        const trimmed = caption.trim();
        let mediaType = "TEXT";
        let mediaUrl = "";
        if (file) {
          mediaUrl = await uploadSocialPublicMedia(file);
          mediaType = (file.type || "").startsWith("video/") ? "VIDEO" : "IMAGE";
        } else if (urlT) {
          mediaUrl = urlT;
          mediaType = inferThreadsMediaTypeFromUrl(urlT);
        } else {
          mediaType = "TEXT";
        }
        if (mediaType === "TEXT" && !trimmed.length) {
          const msg = "Enter text for a Threads text post.";
          setThreadsComposerError(msg);
          setToast({ message: msg, error: true });
          return;
        }
        const result = await postToThreads({ text: trimmed, mediaUrl, mediaType });
        setCaption("");
        setFile(null);
        setThreadsMediaUrl("");
        setSelectedPlatform(scopedAccountConnected && scopedPlatformKey ? scopedPlatformKey : "");
        setToast({ message: result?.message || "Published to Threads." });
      } catch (error) {
        const msg = error?.message || "Could not publish to Threads.";
        setThreadsComposerError(msg);
        setToast({ message: msg, error: true });
      } finally {
        setIsPublishing(false);
      }
      return;
    }

    setCaption("");
    setFile(null);
    setSelectedPlatform(scopedAccountConnected && scopedPlatformKey ? scopedPlatformKey : "");
    setToast({ message: `Published to ${selectedPlatformConfig?.label || selectedPlatform}.` });
  };

  return (
    <section className="grid gap-5 lg:grid-cols-[1.15fr,0.85fr]">
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold">Compose post</h2>
        {scopedPlatformKey && !scopedAccountConnected ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100/90">
            <p className="font-semibold">
              {SOCIAL_PLATFORM_CONFIGS.find((c) => c.key === scopedPlatformKey)?.label || scopedPlatformKey} is not connected.
            </p>
            <p className="mt-1 text-xs opacity-90">Connect it to post here, or open the composer for all connected platforms.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to={`/connected-platforms/${scopedPlatformKey}`}
                className="inline-flex rounded-md bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600"
              >
                Platform details
              </Link>
              <Link
                to="/create-post"
                className="inline-flex rounded-md border border-amber-800/30 px-3 py-2 text-xs font-semibold dark:border-amber-400/40"
              >
                All platforms
              </Link>
            </div>
          </div>
        ) : null}
        {!connectedPlatformConfigs.length ? (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <p className="font-semibold">No connected platforms found.</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Connect at least one platform to start posting.</p>
            <button
              type="button"
              onClick={() => navigate("/connected-platforms")}
              className="mt-3 rounded-md bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600"
            >
              Go to Connected Platforms
            </button>
          </div>
        ) : (
          <div className="mb-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {scopedAccountConnected
                  ? `Posting to ${SOCIAL_PLATFORM_CONFIGS.find((c) => c.key === scopedPlatformKey)?.label || scopedPlatformKey}`
                  : "Select connected platform"}
              </label>
              {scopedAccountConnected ? (
                <Link to="/create-post" className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
                  Choose another platform
                </Link>
              ) : null}
            </div>
            {scopedAccountConnected ? null : (
              <div className="flex flex-wrap gap-2">
                {composerPlatformConfigs.map((platformConfig) => {
                  const platform = platformConfig.key;
                  const isActive = selectedPlatform === platform;
                  return (
                    <button
                      key={platformConfig.key}
                      type="button"
                      onClick={() => {
                        setSelectedPlatform(platform);
                        setFile(null);
                      }}
                      className={`rounded-full border px-3 py-1 text-sm ${
                        isActive
                          ? "border-brand-500 bg-brand-50 text-brand-600"
                          : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {platformConfig.label}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedPlatform ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {selectedLimits?.maxChars ? `Caption limit: ${selectedLimits.maxChars.toLocaleString()} chars.` : null}
                {maxMediaBytes ? ` Media max size: ${formatBytes(maxMediaBytes)}.` : null}
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Choose one platform to see its limits.</p>
            )}
            {entityIdFromUrl && selectedPlatform && ["facebook", "linkedin"].includes(selectedPlatform) ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Target: {selectedPlatform === "facebook" ? "Facebook Page" : "LinkedIn organization"} · ID {entityIdFromUrl}
              </p>
            ) : null}
          </div>
        )}
        <textarea
          rows={7}
          maxLength={captionMaxLength}
          className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950"
          placeholder="Write a caption for your post…"
          value={caption}
          onChange={(e) => {
            setThreadsComposerError("");
            setCaption(e.target.value);
          }}
        />
        <p className="mb-4 text-xs text-slate-500">
          {caption.length.toLocaleString()} / {captionMaxLength.toLocaleString()}
        </p>
        <input
          className="mb-4 block w-full text-sm"
          type="file"
          accept={mediaAccept}
          disabled={!selectedPlatform || (selectedPlatform === "threads" && Boolean(threadsMediaUrl.trim()))}
          onChange={(e) => {
            setThreadsComposerError("");
            setFile(e.target.files?.[0] ?? null);
          }}
        />
        {selectedPlatform === "threads" ? (
          <div className="mb-4">
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Public media URL (optional)</label>
            <input
              type="url"
              disabled={Boolean(file) || isPublishing}
              value={threadsMediaUrl}
              onChange={(e) => {
                setThreadsComposerError("");
                setThreadsMediaUrl(e.target.value);
              }}
              placeholder="https://… (image or video Threads can download)"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 disabled:opacity-60"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Video URLs ending in .mp4, .mov, or .webm are treated as VIDEO; other URLs as IMAGE. Leave empty if you upload a file instead.
            </p>
          </div>
        ) : null}
        {selectedPlatform === "threads" && threadsComposerError ? (
          <p className="mb-3 text-sm text-rose-600 dark:text-rose-400">{threadsComposerError}</p>
        ) : null}
        {selectedPlatform ? (
          <div className="mb-5 rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-xs text-slate-300">
            <p className="font-semibold">{selectedPlatformConfig?.label || selectedPlatform} rules</p>
            <p>{PLATFORM_RULES[selectedPlatform] || "Follow platform policy and official API restrictions."}</p>
            {["reddit", "googleBusiness"].includes(selectedPlatform) ? (
              <input
                placeholder={selectedPlatform === "reddit" ? "Selected subreddit (e.g. r/marketing)" : "Selected business location ID"}
                className="mt-2 w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1"
                value={entitySelection[selectedPlatform] || ""}
                onChange={(e) => setEntitySelection((prev) => ({ ...prev, [selectedPlatform]: e.target.value }))}
              />
            ) : null}
            {selectedLimits?.media?.accept?.length ? (
              <p className="mt-2 text-[11px] text-slate-400">
                Allowed media: {selectedLimits.media.accept.join(", ")}{maxMediaBytes ? ` · Max: ${formatBytes(maxMediaBytes)}` : ""}{isMediaRequired ? " · Required" : ""}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={() => navigate("/schedule")} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">
            Schedule Post
          </button>
          <button
            type="button"
            disabled={isPublishing || !selectedPlatform}
            onClick={publish}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {isPublishing && selectedPlatform === "threads" ? "Publishing…" : "Publish Now"}
          </button>
        </div>
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold">Live preview</h2>
        {mediaObjectUrl && file && (file.type || "").startsWith("video/") ? (
          <video src={mediaObjectUrl} controls className="mb-3 w-full rounded-md border border-slate-200 dark:border-slate-700" />
        ) : null}
        {mediaObjectUrl && file && !(file.type || "").startsWith("video/") ? (
          <img src={mediaObjectUrl} alt="Preview" className="mb-3 w-full rounded-md border border-slate-200 dark:border-slate-700" />
        ) : null}
        <p className="whitespace-pre-wrap text-sm">{caption.trim() || "Your caption will appear here…"}</p>
        <div className="mt-4 space-y-2 text-xs text-slate-500">
          {selectedPlatform ? (
            <p>
              {selectedPlatformConfig?.label || selectedPlatform}: {PLATFORM_RULES[selectedPlatform] || "Standard publishing rules apply."}
            </p>
          ) : (
            <p>Select a platform to preview platform-specific rules.</p>
          )}
        </div>
      </article>
    </section>
  );
}
