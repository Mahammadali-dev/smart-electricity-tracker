const SESSION_KEY = "smart-electricity-session";
const LEGACY_TOKEN_KEY = "token";
const LEGACY_USERNAME_KEY = "username";

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  if (session?.token) {
    localStorage.setItem(LEGACY_TOKEN_KEY, session.token);
  }

  if (session?.user?.name) {
    localStorage.setItem(LEGACY_USERNAME_KEY, session.user.name);
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_USERNAME_KEY);
}
