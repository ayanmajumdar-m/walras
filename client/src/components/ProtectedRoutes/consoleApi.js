// Authenticated fetch for console pages. Same-origin /api calls; a dead or
// expired session sends the user back to sign in instead of leaving every
// card stuck on an error.

const sessionExpired = (message) => {
  localStorage.removeItem("token");
  localStorage.removeItem("userId");
  localStorage.setItem("sessionExpiredMessage", message || "Your session has expired. Please sign in again.");
  window.location.href = "/login";
};

export const api = async (path, { method = "GET", body } = {}) => {
  const token = localStorage.getItem("token");
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 || (res.status === 403 && (data.suspended || /token/i.test(data.error || "")))) {
    sessionExpired(data.error);
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
