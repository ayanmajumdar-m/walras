import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import AuthLayout from "../AuthScreen/AuthLayout";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const expiredMessage = localStorage.getItem("sessionExpiredMessage");
    if (localStorage.getItem("sessionExpired") || expiredMessage) {
      setError(expiredMessage || "Your admin session has expired. Please sign in again.");
      localStorage.removeItem("sessionExpired");
      localStorage.removeItem("sessionExpiredMessage");
    }
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Sign-in failed. Please try again.");
      localStorage.setItem("adminToken", data.token);
      navigate("/vadmin-1997/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const set = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    setError("");
  };

  return (
    <AuthLayout title="Admin panel" subtitle="Sign in with your administrator account.">
      <div className="au-mail-icon"><ShieldCheck aria-hidden="true" /></div>
      {error && <div className="au-alert is-error" role="alert">{error}</div>}
      <form className="au-form" onSubmit={submit}>
        <label className="au-field">
          <span>Username</span>
          <input type="text" autoComplete="username" value={form.username} onChange={set("username")} required autoFocus />
        </label>
        <label className="au-field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" value={form.password} onChange={set("password")} required />
        </label>
        <button type="submit" className="au-btn" disabled={loading || !form.username || !form.password}>
          {loading ? <Loader2 className="au-spin" aria-hidden="true" /> : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
};

export default AdminLogin;
