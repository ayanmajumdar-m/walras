// Shared plumbing for the sign-in, sign-up, verification and reset screens.

// Same origin: the Express server that serves the site also serves /api.
// In development, client/package.json proxies /api to the local backend.
export const API_URL = process.env.REACT_APP_API_URL || "";

/**
 * POSTs JSON to /api/auth/<path>. Resolves with the body on success; rejects
 * with an Error carrying the server's message plus any extra fields it sent
 * (needsVerification, expired, ...), so screens can react to them.
 */
export const authPost = async (path, body) => {
  let res;
  try {
    res = await fetch(`${API_URL}/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("We couldn't reach Walras Cloud. Check your connection and try again.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Something went wrong. Please try again.");
    Object.assign(err, data, { status: res.status });
    throw err;
  }
  return data;
};

// Same keys the dashboard, navbar and protected routes already read.
export const saveSession = ({ token, userId }) => {
  localStorage.setItem("token", token);
  localStorage.setItem("userId", String(userId));
};

// Only same-site paths; an absolute URL here would be an open redirect.
export const safeReturnTo = (value) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
