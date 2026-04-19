import { createContext, useContext, useMemo, useState } from "react";
import { STORAGE_KEYS } from "../data/constants";
import { loginUser, registerUser, updateOnboardingStatus, updateUser } from "../services/userApi";

const AppContext = createContext(null);

function getInitialTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  if (saved) return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialUser() {
  return {
    email: localStorage.getItem(STORAGE_KEYS.email) ?? "",
    name: localStorage.getItem(STORAGE_KEYS.profileName) ?? "Alex Morgan",
    onboardingCompleted: localStorage.getItem(STORAGE_KEYS.onboardingCompleted) === "1",
  };
}

function getInitialConnections() {
  const saved = localStorage.getItem(STORAGE_KEYS.socialConnections);
  if (!saved) {
    return {
      instagram: false,
      youtube: false,
      linkedin: false,
      threads: false,
      facebook: false,
    };
  }

  try {
    const parsed = JSON.parse(saved);
    return {
      instagram: !!parsed.instagram,
      youtube: !!parsed.youtube,
      linkedin: !!parsed.linkedin,
      threads: !!(parsed.threads || parsed.x),
      facebook: !!parsed.facebook,
    };
  } catch {
    return {
      instagram: false,
      youtube: false,
      linkedin: false,
      threads: false,
      facebook: false,
    };
  }
}

export function AppProvider({ children }) {
  const [isAuthed, setIsAuthed] = useState(Boolean(localStorage.getItem(STORAGE_KEYS.authToken)));
  const [theme, setTheme] = useState(getInitialTheme);
  const [user, setUser] = useState(getInitialUser);
  const [connections, setConnections] = useState(getInitialConnections);
  const [toast, setToast] = useState(null);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(STORAGE_KEYS.theme, next);
  };

  const login = async ({ email, password }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const payload = await loginUser({ email: normalizedEmail, password });
    localStorage.setItem(STORAGE_KEYS.auth, "1");
    localStorage.setItem(STORAGE_KEYS.authToken, payload.token);
    localStorage.setItem(STORAGE_KEYS.email, payload.user.email);
    localStorage.setItem(STORAGE_KEYS.profileName, payload.user.name);
    const onboardingCompleted = Boolean(payload.user.onboardingCompleted);
    localStorage.setItem(STORAGE_KEYS.onboardingCompleted, onboardingCompleted ? "1" : "0");
    setUser({ email: payload.user.email, name: payload.user.name, onboardingCompleted });
    setIsAuthed(true);
    return payload.user;
  };

  const signup = async ({ name, email, password }) => {
    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const payload = await registerUser({ name: trimmedName, email: normalizedEmail, password });
    localStorage.removeItem(STORAGE_KEYS.auth);
    localStorage.removeItem(STORAGE_KEYS.authToken);
    localStorage.removeItem(STORAGE_KEYS.onboardingCompleted);
    localStorage.setItem(STORAGE_KEYS.email, payload.user.email);
    localStorage.setItem(STORAGE_KEYS.profileName, payload.user.name);
    setUser({
      email: payload.user.email,
      name: payload.user.name,
      onboardingCompleted: Boolean(payload.user.onboardingCompleted),
    });
    setIsAuthed(false);
    return payload.user;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEYS.auth);
    localStorage.removeItem(STORAGE_KEYS.authToken);
    localStorage.removeItem(STORAGE_KEYS.onboardingCompleted);
    setIsAuthed(false);
  };

  const saveSettings = async ({ name, email, password }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    const token = localStorage.getItem(STORAGE_KEYS.authToken);
    if (!token) {
      return { ok: false, error: new Error("You must be signed in.") };
    }

    try {
      const savedUser = await updateUser(token, { name: trimmedName, email: normalizedEmail, password });
      localStorage.setItem(STORAGE_KEYS.profileName, savedUser.name);
      localStorage.setItem(STORAGE_KEYS.email, savedUser.email);
      setUser((prev) => ({ ...prev, name: savedUser.name, email: savedUser.email }));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: new Error(error?.message || "Unable to save settings.") };
    }
  };

  const setConnectionStatus = (platform, connected) => {
    setConnections((prev) => {
      const next = { ...prev, [platform]: connected };
      localStorage.setItem(STORAGE_KEYS.socialConnections, JSON.stringify(next));
      return next;
    });
  };

  const completeOnboarding = async ({ skippedPlatforms = [] } = {}) => {
    const token = localStorage.getItem(STORAGE_KEYS.authToken);
    if (!token) {
      return { ok: false, error: new Error("You must be signed in.") };
    }

    try {
      await updateOnboardingStatus(token, {
        onboardingCompleted: true,
        onboardingSkippedPlatforms: skippedPlatforms,
      });
      localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "1");
      setUser((prev) => ({ ...prev, onboardingCompleted: true }));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: new Error(error?.message || "Unable to complete onboarding.") };
    }
  };

  const value = useMemo(
    () => ({
      isAuthed,
      theme,
      user,
      isOnboardingCompleted: Boolean(user.onboardingCompleted),
      connections,
      toast,
      setToast,
      toggleTheme,
      login,
      signup,
      logout,
      saveSettings,
      setConnectionStatus,
      completeOnboarding,
    }),
    [isAuthed, theme, user, connections, toast]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
