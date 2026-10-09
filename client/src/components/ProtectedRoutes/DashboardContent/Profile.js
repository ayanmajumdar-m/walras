import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { UserCircle, Users } from "lucide-react";
import Team from "./Team";
import "./Profile.css";

const ProfileDetails = () => {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: "", type: "" });
  const API_URL = ``

  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [pwMessage, setPwMessage] = useState({ text: "", type: "" });

  const userId = localStorage.getItem("userId");
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_URL}/api/users/profile/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch profile");
        const data = await res.json();
        setUser(data);
        
        // Parse address if it exists
        if (data.address) {
          const parsedAddress = parseAddress(data.address);
          setForm({ ...data, ...parsedAddress });
        } else {
          setForm(data);
        }
      } catch {
        setMessage({ text: "Error loading profile", type: "error" });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId, token]);

  // The address is saved as six lines: line 1, line 2, city, state, country,
  // PIN, blank ones kept so each field stays in its place (GST reads the
  // state and country from it, services/taxServices.js). Addresses saved
  // before that dropped blank lines; those are read from the end.
  const parseAddress = (addressString) => {
    if (!addressString) return {};
    const lines = addressString.split('\n').map((l) => l.trim());
    if (lines.length === 6) {
      const [addressLine1, addressLine2, city, state, country, zipCode] = lines;
      return { addressLine1, addressLine2, city, state, country, zipCode };
    }
    const rest = lines.filter(Boolean);
    const last = rest[rest.length - 1] || '';
    const zipCode = rest.length > 1 && /\d/.test(last) && /^[a-z0-9 -]{3,10}$/i.test(last) ? rest.pop() : '';
    const country = rest.length > 1 ? rest.pop() : '';
    const state = rest.length > 1 ? rest.pop() : '';
    const city = rest.length > 1 ? rest.pop() : '';
    return { addressLine1: rest[0] || '', addressLine2: rest.slice(1).join(', '), city, state, country, zipCode };
  };

  const formatAddress = (addressData) => {
    const { addressLine1, addressLine2, city, state, country, zipCode } = addressData;
    const lines = [addressLine1, addressLine2, city, state, country, zipCode].map((l) => String(l || '').replace(/\s+/g, ' ').trim());
    return lines.some(Boolean) ? lines.join('\n') : '';
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const changePassword = async (e) => {
    e.preventDefault();
    setPwMessage({ text: "", type: "" });
    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(pw),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok) {
        setPwMessage({ text: "Password changed ✅", type: "success" });
        setPw({ currentPassword: "", newPassword: "" });
      } else {
        setPwMessage({ text: result.error || "Could not change password", type: "error" });
      }
    } catch {
      setPwMessage({ text: "Error changing password", type: "error" });
    }
  };

  const isBusiness = form.account_type === "business";

  const submitProfileUpdate = async () => {
    try {
      // Format address before submission
      const addressData = {
        addressLine1: form.addressLine1 || '',
        addressLine2: form.addressLine2 || '',
        city: form.city || '',
        state: form.state || '',
        country: form.country || '',
        zipCode: form.zipCode || ''
      };
      
      const formattedAddress = formatAddress(addressData);

      // Email is not sent: changing it would need the new address verified.
      const updatedForm = {
        name: form.name || '',
        phone: form.phone || '',
        company: form.company || '',
        gstin: form.gstin || '',
        role: form.role || '',
        address: formattedAddress
      };


      const res = await fetch(`${API_URL}/api/users/profile/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedForm),
      });

      const result = await res.json();
      if (res.ok) {
        setMessage({ text: "Profile updated successfully ✅", type: "success" });
        setUser({ ...user, ...updatedForm });
      } else {
        setMessage({ text: result.error || "Update failed", type: "error" });
      }
    } catch {
      setMessage({ text: "Error updating profile", type: "error" });
    }
  };

  if (loading) return (
    <div className="profile-container">
      <div className="loading-spinner">Loading...</div>
    </div>
  );

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1 className="profile-title gradient-text">Your Profile</h1>
        <p className="profile-subtitle">
          {isBusiness ? "Business account" : "Personal account"} · Manage your details
        </p>
      </div>

      {message.text && (
        <div className={`profile-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="profile-content">
        <div className="profile-card">
          <h2 className="section-title">{isBusiness ? "Account & Business Information" : "Personal Information"}</h2>
          <form className="profile-form" onSubmit={(e) => e.preventDefault()}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input id="name" type="text" name="name" value={form.name || ""} onChange={handleChange} />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input id="email" type="email" value={form.email || ""} readOnly disabled />
                <small>{form.isemailverified ? "Verified ✓" : "Not verified"} · Contact support to change your email</small>
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  type="text"
                  name="phone"
                  placeholder="Enter your phone number"
                  value={form.phone || ""}
                  onChange={handleChange}
                />
              </div>

              {isBusiness && (<>
              <div className="form-group">
                <label htmlFor="company">Business Name</label>
                <input
                  id="company"
                  type="text"
                  name="company"
                  placeholder="Enter your company name"
                  value={form.company || ""}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="role">Role</label>
                <input
                  id="role"
                  type="text"
                  name="role"
                  placeholder="Enter your role"
                  value={form.role || ""}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="gstin">GSTIN</label>
                <input
                  id="gstin"
                  type="text"
                  name="gstin"
                  maxLength={15}
                  placeholder="Optional, e.g. 22AAAAA0000A1Z5"
                  value={form.gstin || ""}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                />
              </div>
              </>)}
            </div>

            <div className="address-section">
              <h3 className="section-title">Address Information</h3>
              <div className="address-grid">
                <div className="form-group full-width">
                  <label htmlFor="addressLine1">Address Line 1</label>
                  <input
                    id="addressLine1"
                    type="text"
                    name="addressLine1"
                    placeholder="House number, street name"
                    value={form.addressLine1 || ""}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group full-width">
                  <label htmlFor="addressLine2">Address Line 2</label>
                  <input
                    id="addressLine2"
                    type="text"
                    name="addressLine2"
                    placeholder="Area, sector, landmark"
                    value={form.addressLine2 || ""}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="city">City/Town</label>
                  <input
                    id="city"
                    type="text"
                    name="city"
                    placeholder="Enter your city"
                    value={form.city || ""}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="state">State/Province</label>
                  <input
                    id="state"
                    type="text"
                    name="state"
                    placeholder="Enter your state"
                    value={form.state || ""}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="zipCode">ZIP/Postal Code</label>
                  <input
                    id="zipCode"
                    type="text"
                    name="zipCode"
                    placeholder="Enter ZIP code"
                    value={form.zipCode || ""}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="country">Country</label>
                  <input
                    id="country"
                    type="text"
                    name="country"
                    placeholder="India"
                    value={form.country || ""}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="auth-btn update-btn"
                onClick={submitProfileUpdate}
              >
                Update Profile
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="profile-card">
        <h2 className="section-title">Change Password</h2>
        {pwMessage.text && (
          <div className={`profile-message ${pwMessage.type}`}>{pwMessage.text}</div>
        )}
        <form className="profile-form" onSubmit={changePassword}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={pw.currentPassword}
                onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters, a letter and a number"
                value={pw.newPassword}
                onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="auth-btn update-btn" disabled={!pw.currentPassword || !pw.newPassword}>
              Change Password
            </button>
          </div>
        </form>
      </div>

    </div>
  );
};

// Account: your profile, and your team (sub-users) on a second tab.
const TABS = [
  { id: "profile", label: "Profile", Icon: UserCircle },
  { id: "team", label: "Team", Icon: Users },
];

const Profile = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "team" ? "team" : "profile";
  return (
    <div className="cx-page">
      <div className="cx-tabs" role="tablist">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            className={`cx-tab${tab === id ? " is-active" : ""}`} onClick={() => setParams(id === "team" ? { tab: "team" } : {}, { replace: true })}>
            <Icon size={16} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
      {tab === "team" ? <Team /> : <ProfileDetails />}
    </div>
  );
};

export default Profile;