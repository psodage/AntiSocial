const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

function authedRequest(path, token, options = {}) {
  return request(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

export async function registerUser({ name, email, password }) {
  const payload = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  return payload;
}

export async function loginUser({ email, password }) {
  const payload = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return payload;
}

export async function updateUser(token, nextProfile) {
  const payload = await authedRequest("/api/users/me", token, {
    method: "PUT",
    body: JSON.stringify(nextProfile),
  });
  return payload.user;
}

export async function updateOnboardingStatus(token, onboardingState) {
  return authedRequest("/api/users/me/onboarding", token, {
    method: "PUT",
    body: JSON.stringify(onboardingState),
  });
}
