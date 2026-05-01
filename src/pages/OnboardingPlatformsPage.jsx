import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, SkipForward, XCircle } from "lucide-react";
import { SOCIAL_PLATFORM_CONFIGS } from "../data/socialPlatforms";
import { getSocialOAuthErrorMessage, startSocialConnect } from "../services/socialApi";
import { useApp } from "../context/AppContext";

const ONBOARDING_STORAGE_KEY = "problogbooster-onboarding-flow";

function getInitialSelected() {
  return SOCIAL_PLATFORM_CONFIGS.reduce((acc, platform) => {
    acc[platform.key] = false;
    return acc;
  }, {});
}

function getStatusBadge(status) {
  if (status === "connected") return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  if (status === "skipped") return "bg-amber-500/10 text-amber-300 border-amber-500/20";
  if (status === "failed") return "bg-red-500/10 text-red-300 border-red-500/20";
  if (status === "processing") return "bg-blue-500/10 text-blue-300 border-blue-500/20";
  return "bg-slate-700/30 text-slate-300 border-slate-600/60";
}

export default function OnboardingPlatformsPage() {
  const navigate = useNavigate();
  const { setToast, completeOnboarding, setConnectionStatus } = useApp();
  const [selected, setSelected] = useState(getInitialSelected);
  const [queue, setQueue] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [started, setStarted] = useState(false);
  const [processingPlatform, setProcessingPlatform] = useState("");
  const [finishing, setFinishing] = useState(false);

  const currentIndex = useMemo(() => queue.findIndex((platform) => !["connected", "skipped"].includes(statusMap[platform])), [queue, statusMap]);
  const currentPlatform = currentIndex >= 0 ? queue[currentIndex] : "";
  const processedCount = queue.filter((platform) => ["connected", "skipped"].includes(statusMap[platform])).length;
  const progressLabel = queue.length ? `${processedCount} of ${queue.length} linked` : "0 of 0 linked";
  const progressPercent = queue.length ? Math.round((processedCount / queue.length) * 100) : 0;

  const persistFlow = (nextQueue, nextStatusMap) => {
    sessionStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ queue: nextQueue, statusMap: nextStatusMap }));
  };

  const loadPersistedFlow = () => {
    try {
      const raw = sessionStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!raw) return { queue: [], statusMap: {} };
      const parsed = JSON.parse(raw);
      return {
        queue: Array.isArray(parsed.queue) ? parsed.queue : [],
        statusMap: parsed.statusMap && typeof parsed.statusMap === "object" ? parsed.statusMap : {},
      };
    } catch {
      return { queue: [], statusMap: {} };
    }
  };

  const finishOnboarding = async (nextQueue, nextStatusMap) => {
    if (finishing) return;
    setFinishing(true);
    const skippedPlatforms = nextQueue.filter((platform) => nextStatusMap[platform] === "skipped");
    const result = await completeOnboarding({ skippedPlatforms });
    setFinishing(false);
    if (!result.ok) {
      setToast({ message: result.error?.message || "Unable to complete onboarding.", error: true });
      return;
    }
    sessionStorage.removeItem(ONBOARDING_STORAGE_KEY);
    setToast({ message: "Your accounts are connected successfully." });
    navigate("/dashboard");
  };

  const goToNext = async (nextQueue, nextStatusMap) => {
    const nextIndex = nextQueue.findIndex((platform) => !["connected", "skipped"].includes(nextStatusMap[platform]));
    if (nextIndex === -1) {
      await finishOnboarding(nextQueue, nextStatusMap);
      return;
    }

    const platform = nextQueue[nextIndex];
    const updatedStatus = { ...nextStatusMap, [platform]: "processing" };
    setStatusMap(updatedStatus);
    persistFlow(nextQueue, updatedStatus);
    setProcessingPlatform(platform);

    try {
      const data = await startSocialConnect(platform, { flow: "onboarding" });
      window.location.href = data.url;
    } catch (error) {
      const message = getSocialOAuthErrorMessage(error?.message, platform);
      const failedStatus = { ...updatedStatus, [platform]: "failed" };
      setStatusMap(failedStatus);
      persistFlow(nextQueue, failedStatus);
      setProcessingPlatform("");
      setToast({ message, error: true });
    }
  };

  useEffect(() => {
    const { queue: persistedQueue, statusMap: persistedStatusMap } = loadPersistedFlow();
    if (!persistedQueue.length) return;
    setQueue(persistedQueue);
    setStatusMap(persistedStatusMap);
    setStarted(true);
  }, []);

  useEffect(() => {
    if (!started) return;

    const params = new URLSearchParams(window.location.search);
    const platform = params.get("social_platform");
    const socialStatus = params.get("social_status");
    const reason = params.get("reason");
    if (!platform || !socialStatus) return;

    const { queue: persistedQueue, statusMap: persistedStatusMap } = loadPersistedFlow();
    if (!persistedQueue.includes(platform)) return;

    const nextStatusMap = {
      ...persistedStatusMap,
      [platform]: socialStatus === "connected" ? "connected" : "failed",
    };

    setQueue(persistedQueue);
    setStatusMap(nextStatusMap);
    setProcessingPlatform("");
    if (socialStatus === "connected") {
      setConnectionStatus(platform, true);
      setToast({ message: `${platform} connected successfully.` });
      goToNext(persistedQueue, nextStatusMap);
    } else {
      const message = getSocialOAuthErrorMessage(reason, platform);
      setToast({ message, error: true });
    }
    persistFlow(persistedQueue, nextStatusMap);

    params.delete("social_platform");
    params.delete("social_status");
    params.delete("reason");
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [started, setToast, setConnectionStatus]);

  const handleToggle = (platform) => {
    if (started) return;
    setSelected((prev) => ({ ...prev, [platform]: !prev[platform] }));
  };

  const startFlow = async () => {
    const selectedPlatforms = Object.entries(selected)
      .filter(([, checked]) => checked)
      .map(([platform]) => platform);
    if (!selectedPlatforms.length) {
      setToast({ message: "Select at least one platform to continue.", error: true });
      return;
    }

    const initialStatuses = selectedPlatforms.reduce((acc, platform) => {
      acc[platform] = "pending";
      return acc;
    }, {});

    setStarted(true);
    setQueue(selectedPlatforms);
    setStatusMap(initialStatuses);
    persistFlow(selectedPlatforms, initialStatuses);
    await goToNext(selectedPlatforms, initialStatuses);
  };

  const retryCurrent = async () => {
    if (!currentPlatform) return;
    const nextStatusMap = { ...statusMap, [currentPlatform]: "pending" };
    setStatusMap(nextStatusMap);
    persistFlow(queue, nextStatusMap);
    await goToNext(queue, nextStatusMap);
  };

  const skipCurrent = async () => {
    if (!currentPlatform) return;
    const nextStatusMap = { ...statusMap, [currentPlatform]: "skipped" };
    setStatusMap(nextStatusMap);
    persistFlow(queue, nextStatusMap);
    await goToNext(queue, nextStatusMap);
  };

  return (
    <section className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Connect your social accounts</h1>
            <p className="text-sm text-slate-500">Choose your channels and link them one by one before entering your dashboard.</p>
          </div>
          <div className="min-w-[200px]">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span>Progress</span>
              <span>{progressLabel}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
              <div className="h-2 rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SOCIAL_PLATFORM_CONFIGS.map((platform) => {
            const Icon = platform.icon;
            const isChecked = selected[platform.key];
            const state = statusMap[platform.key] || "not-selected";
            return (
              <button
                key={platform.key}
                type="button"
                onClick={() => handleToggle(platform.key)}
                disabled={started}
                className={`rounded-xl border p-4 text-left transition ${
                  isChecked
                    ? "border-brand-500 bg-brand-500/10"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                } ${started ? "cursor-default opacity-95" : ""}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">{Icon ? <Icon size={16} /> : <span className="text-xs font-bold">X</span>}</span>
                    <p className="font-semibold">{platform.label}</p>
                  </div>
                  <input type="checkbox" checked={isChecked} onChange={() => {}} readOnly />
                </div>
                <p className="text-xs text-slate-500">{platform.hint}</p>
                {started ? (
                  <span className={`mt-3 inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold uppercase ${getStatusBadge(state)}`}>
                    {state.replace("-", " ")}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {!started ? (
          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => finishOnboarding([], {})}
              disabled={finishing}
              className="rounded-md border border-slate-300 px-5 py-2 text-sm font-semibold dark:border-slate-600"
            >
              Skip for now
            </button>
            <button onClick={startFlow} className="rounded-md bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600">
              Continue
            </button>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="text-sm font-semibold">
              {currentPlatform ? `Current step: ${currentPlatform}` : "All selected platforms processed"}
            </p>
            {processingPlatform ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-blue-500">
                <Loader2 size={16} className="animate-spin" /> Opening {processingPlatform} authorization...
              </p>
            ) : null}

            {currentPlatform && statusMap[currentPlatform] === "failed" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={retryCurrent} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
                  Retry
                </button>
                <button onClick={skipCurrent} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600">
                  Skip
                </button>
                <button onClick={skipCurrent} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600">
                  Continue
                </button>
              </div>
            ) : null}

            {!currentPlatform ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-600">
                  <CheckCircle2 size={14} /> Connected
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-amber-600">
                  <SkipForward size={14} /> Skipped
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-red-600">
                  <XCircle size={14} /> Failed
                </span>
                <button
                  onClick={() => finishOnboarding(queue, statusMap)}
                  disabled={finishing}
                  className="ml-auto rounded-md bg-brand-500 px-4 py-2 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
                >
                  {finishing ? "Finalizing..." : "Go to Dashboard"}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
