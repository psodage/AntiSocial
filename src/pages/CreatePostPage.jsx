import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { getSocialAccounts } from "../services/socialApi";
import { PLATFORM_CAPABILITY_MATRIX, SOCIAL_PLATFORM_CONFIGS } from "../data/socialPlatforms";

const PLATFORM_RULES = {
  x: "Keep posts concise. API tier determines analytics availability.",
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

export default function CreatePostPage() {
  const [caption, setCaption] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [entitySelection, setEntitySelection] = useState({});
  const [file, setFile] = useState(null);
  const navigate = useNavigate();
  const { setToast } = useApp();

  const imagePreview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

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

  const publish = () => {
    if (!caption.trim() && !file) return setToast({ message: "Add a caption or media before publishing.", error: true });
    if (!selectedPlatform) return setToast({ message: "Select a platform.", error: true });
    const validationError = validatePlatformPayload();
    if (validationError) return setToast({ message: validationError, error: true });
    setCaption("");
    setFile(null);
    setSelectedPlatform("");
    setToast({ message: `Published to ${selectedPlatformConfig?.label || selectedPlatform}.` });
  };

  return (
    <section className="grid gap-5 lg:grid-cols-[1.15fr,0.85fr]">
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold">Compose post</h2>
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
            <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Select connected platform</label>
            <div className="flex flex-wrap gap-2">
              {connectedPlatformConfigs.map((platformConfig) => {
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
            {selectedPlatform ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {selectedLimits?.maxChars ? `Caption limit: ${selectedLimits.maxChars.toLocaleString()} chars.` : null}
                {maxMediaBytes ? ` Media max size: ${formatBytes(maxMediaBytes)}.` : null}
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Choose one platform to see its limits.</p>
            )}
          </div>
        )}
        <textarea
          rows={7}
          maxLength={captionMaxLength}
          className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950"
          placeholder="Write a caption for your post…"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <p className="mb-4 text-xs text-slate-500">
          {caption.length.toLocaleString()} / {captionMaxLength.toLocaleString()}
        </p>
        <input
          className="mb-4 block w-full text-sm"
          type="file"
          accept={mediaAccept}
          disabled={!selectedPlatform}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
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
          <button onClick={publish} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
            Publish Now
          </button>
        </div>
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold">Live preview</h2>
        {imagePreview && <img src={imagePreview} alt="Preview" className="mb-3 w-full rounded-md border border-slate-200 dark:border-slate-700" />}
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
