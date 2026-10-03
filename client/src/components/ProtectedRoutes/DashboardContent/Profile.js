import React, { useEffect, useState } from "react";
import "./Profile.css";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: "", type: "" });
  const API_URL = `https://buttr.cloud`

  // Where to send someone who wants to change their name, email, password or
  // sign-in methods — all of that lives in BUTTR ID, not here.
  const [buttrAccountUrl, setButtrAccountUrl] = useState("");

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

  // Function to parse the address string into individual fields
  const parseAddress = (addressString) => {
    if (!addressString) return {};
    
    const lines = addressString.split('\n');
    return {
      addressLine1: lines[0] || '',
      addressLine2: lines[1] || '',
      city: lines[2] || '',
      state: lines[3] || '',
      country: lines[4] || '',
      zipCode: lines[5] || ''
    };
  };

  // Function to format address for submission
  const formatAddress = (addressData) => {
    const { addressLine1, addressLine2, city, state, country, zipCode } = addressData;
    return [addressLine1, addressLine2, city, state, country, zipCode]
      .filter(line => line && line.trim() !== '')
      .join('\n');
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  useEffect(() => {
    fetch(`${API_URL}/api/auth/config`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setButtrAccountUrl(data.accountUrl))
      .catch(() => {});
  }, [API_URL]);

  // Re-entering a password used to gate this. There is no Walras Cloud password
  // now — the bearer token came from BUTTR ID, and that is the proof.
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

      // Only the fields Walras Cloud owns. name and email come from BUTTR ID
      // and are refreshed from it on every sign-in, so sending them would be
      // silently discarded.
      const updatedForm = {
        phone: form.phone || '',
        company: form.company || '',
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
        <p className="profile-subtitle">Manage your personal information</p>
      </div>

      {message.text && (
        <div className={`profile-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="profile-content">
        <div className="profile-card">
          <h2 className="section-title">Personal Information</h2>
          <form className="profile-form" onSubmit={(e) => e.preventDefault()}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input id="name" type="text" value={form.name || ""} readOnly disabled />
                <small>Managed by your BUTTR ID</small>
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  value={form.email || "Not shared by your BUTTR ID"}
                  readOnly
                  disabled
                />
                <small>Managed by your BUTTR ID</small>
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

              <div className="form-group">
                <label htmlFor="company">Company</label>
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
                    placeholder="Enter your country"
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
        <h2 className="section-title">Your BUTTR ID</h2>
        <p>
          Your name, email address, password and sign-in methods are managed by
          BUTTR ID{form.buttr_handle ? ` (${form.buttr_handle})` : ""}. Buttr
          Cloud never sees your password.
        </p>
        {buttrAccountUrl && (
          <a className="auth-btn update-btn" href={buttrAccountUrl} target="_blank" rel="noreferrer">
            Manage your BUTTR ID
          </a>
        )}
      </div>

    </div>
  );
};

export default Profile;