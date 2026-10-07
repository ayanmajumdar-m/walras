// Authenticated fetch for console pages. Same-origin /api calls; a dead or
// expired session sends the user back to sign in instead of leaving every
// card stuck on an error.

const sessionExpired = (message) => {
  localStorage.removeItem("token");
  localStorage.removeItem("userId");
  localStorage.removeItem(ACCOUNT_KEY);
  localStorage.setItem("sessionExpiredMessage", message || "Your session has expired. Please sign in again.");
  window.location.href = "/login";
};

// ── Team accounts ──────────────────────────────────────────────────────────
// When a team member works in someone else's account, the owner's id is kept
// here and sent as X-Walras-Account. The server decides what that allows
// (utils/team.js); these calls always act on the signed-in person instead.
export const ACCOUNT_KEY = "walrasAccount";
const OWN_ONLY = ["/api/team", "/api/users/profile", "/api/auth"];

export const actingAccount = () => {
  try {
    const v = localStorage.getItem(ACCOUNT_KEY);
    return v && /^\d+$/.test(v) && v !== localStorage.getItem("userId") ? v : null;
  } catch {
    return null;
  }
};

export const switchAccount = (ownerId) => {
  try {
    if (ownerId) localStorage.setItem(ACCOUNT_KEY, String(ownerId));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch { /* storage blocked: stays on own account */ }
  window.location.href = "/dashboard/home";
};

/** Headers for a raw fetch to a console API path. */
export const authHeaders = (path = "") => {
  const token = localStorage.getItem("token");
  const account = OWN_ONLY.some((p) => path.startsWith(p)) ? null : actingAccount();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(account ? { "X-Walras-Account": account } : {}),
  };
};

// Access to a team account was removed: go back to your own account.
const accessRevoked = (message) => {
  localStorage.removeItem(ACCOUNT_KEY);
  localStorage.setItem("teamNotice", message || "You no longer have access to that account.");
  window.location.href = "/dashboard/home";
};

export const api = async (path, { method = "GET", body } = {}) => {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders(path) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 || (res.status === 403 && (data.suspended || /token/i.test(data.error || "")))) {
    sessionExpired(data.error);
    throw new Error("Session expired");
  }
  if (res.status === 403 && data.teamAccessRevoked) {
    accessRevoked(data.error);
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
};

// /api/wallet returns the balance in rupees, as a string like "120.00".
export const rupees = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};
