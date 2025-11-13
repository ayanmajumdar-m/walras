import React, { useEffect, useState } from "react";
import "./Profile.css";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: "", type: "" });
  const API_URL = `http://y0koc4ok88sk0cww0cwssco4.172.236.189.24.sslip.io`

  // Password Modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");

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

  // Submit after password is entered
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
      const updatedForm = { 
        ...form, 
        address: formattedAddress,
        currentPassword 
      };
      
      // Remove individual address fields from submission
      delete updatedForm.addressLine1;
      delete updatedForm.addressLine2;
      delete updatedForm.city;
      delete updatedForm.state;
      delete updatedForm.country;
      delete updatedForm.zipCode;


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
        setUser(updatedForm);
      } else {
        setMessage({ text: result.error || "Update failed", type: "error" });
      }
    } catch {
      setMessage({ text: "Error updating profile", type: "error" });
    } finally {
      setShowPasswordModal(false);
      setCurrentPassword("");
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
                <label htmlFor="name">Full Name *</label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  placeholder="Enter your full name"
                  value={form.name || ""}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  value={form.email || ""}
                  onChange={handleChange}
                  required
                />
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
                onClick={() => setShowPasswordModal(true)}
              >
                Update Profile
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Confirm Your Identity</h3>
              <p>Please enter your current password to update your profile</p>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  id="currentPassword"
                  type="password"
                  placeholder="Enter your current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowPasswordModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={submitProfileUpdate}>
                Update Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;