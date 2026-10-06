// Authenticated fetch for the admin panel. A dead session goes back to the
// admin sign-in page instead of leaving every section showing an error.

const signOut = (message) => {
  localStorage.removeItem("adminToken");
  localStorage.setItem("sessionExpired", "true");
  if (message) localStorage.setItem("sessionExpiredMessage", message);
  window.location.href = "/vadmin-1997";
};

export const adminApi = async (path, { method = "GET", body } = {}) => {
  const token = localStorage.getItem("adminToken");
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    signOut(data.error);
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
};

export const adminLogout = () => {
  localStorage.removeItem("adminToken");
  window.location.href = "/vadmin-1997";
};

export const inr = (paise) =>
  `₹${(Number(paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (d, withTime = false) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
      })
    : "—";
