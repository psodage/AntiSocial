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

export default function CreatePostPage() {
  const [caption, setCaption] = useState("");
  const [platforms, setPlatforms] = useState([]);
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

  const togglePlatform = (value) => {
    setPlatforms((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]));
  };

  const validatePlatformPayload = () => {
    for (const platform of platforms) {
      const capability = PLATFORM_CAPABILITY_MATRIX[platform];
      const account = connectedByPlatform[platform];
      if (!account?.isConnected) return `${platform} is not connected.`;
      if (platform === "pinterest" && !file) return "Pinterest publishing requires an image.";
      if (platform === "googleBusiness" && !entitySelection[platform]) return "Select a Google Business location.";
      if (platform === "reddit" && !entitySelection[platform]) return "Select a subreddit before posting to Reddit.";
      if (capability?.supportLevel === "limited" && !capability?.badges?.includes("Posting")) {
        return `${platform} posting is currently limited by official API capability.`;
      }
    }
    return null;
  };

  const publish = () => {
    if (!caption.trim() && !file) return setToast({ message: "Add a caption or an image before publishing.", error: true });
    if (!platforms.length) return setToast({ message: "Select at least one platform.", error: true });
    const validationError = validatePlatformPayload();
    if (validationError) return setToast({ message: validationError, error: true });
    setCaption("");
    setFile(null);
    setToast({ message: `Published to ${platforms.join(", ")}.` });
  };

  return (
    <section className="grid gap-5 lg:grid-cols-[1.15fr,0.85fr]">
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold">Compose post</h2>
        <textarea
          rows={7}
          maxLength={2200}
          className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950"
          placeholder="Write a caption for your post…"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <p className="mb-4 text-xs text-slate-500">{caption.length} / 2,200</p>
        <input className="mb-4 block w-full text-sm" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <div className="mb-6 flex flex-wrap gap-2">
          {SOCIAL_PLATFORM_CONFIGS.map((platformConfig) => {
            const platform = platformConfig.key;
            const isConnected = Boolean(connectedByPlatform[platform]?.isConnected);
            return (
            <button
              key={platformConfig.key}
              type="button"
              onClick={() => togglePlatform(platform)}
              disabled={!isConnected}
              className={`rounded-full border px-3 py-1 text-sm ${platforms.includes(platform) ? "border-brand-500 bg-brand-50 text-brand-600" : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}
            >
              {platformConfig.label}
            </button>
          );})}
        </div>
        {platforms.map((platform) => (
          <div key={`${platform}-rules`} className="mb-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-xs text-slate-300">
            <p className="font-semibold">{platform} rules</p>
            <p>{PLATFORM_RULES[platform] || "Follow platform policy and official API restrictions."}</p>
            {["reddit", "googleBusiness"].includes(platform) ? (
              <input
                placeholder={platform === "reddit" ? "Selected subreddit (e.g. r/marketing)" : "Selected business location ID"}
                className="mt-2 w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1"
                value={entitySelection[platform] || ""}
                onChange={(e) => setEntitySelection((prev) => ({ ...prev, [platform]: e.target.value }))}
              />
            ) : null}
          </div>
        ))}
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
          {platforms.map((platform) => (
            <p key={`${platform}-preview`}>{platform}: {PLATFORM_RULES[platform] || "Standard publishing rules apply."}</p>
          ))}
        </div>
      </article>
    </section>
  );
}
