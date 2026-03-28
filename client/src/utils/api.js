const API_URL =
  (typeof process !== "undefined" && process.env?.REACT_APP_API_URL) ||
  import.meta.env.REACT_APP_API_URL ||
  import.meta.env.VITE_API_URL ||
  "";

const API_BASE = String(API_URL || "").replace(/\/+$/, "");

function buildApiUrl(path) {
  if (!API_BASE) {
    throw new Error("Missing API base URL. Set REACT_APP_API_URL for the frontend deployment.");
  }

  return `${API_BASE}${path}`;
}

async function request(path, options = {}, token) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(buildApiUrl(path), {
      ...options,
      headers,
    });
  } catch (_error) {
    throw new Error(`Cannot reach backend server at ${API_BASE || "the configured API URL"}.`);
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.message || "Something went wrong.");
  }

  return data;
}

export const api = {
  signup(payload) {
    return request("/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  login(payload) {
    return request("/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getUserData(token) {
    return request("/user-data", { method: "GET" }, token);
  },
  updateUserProfile(token, payload) {
    return request(
      "/user-profile",
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      token
    );
  },
  getUsageData(token) {
    return request("/usage-data", { method: "GET" }, token);
  },
  saveUsage(token, payload) {
    return request(
      "/save-usage",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token
    );
  },
  getLayout(token) {
    return request("/get-layout", { method: "GET" }, token);
  },
  saveLayout(token, payload) {
    return request(
      "/save-layout",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token
    );
  },
};
