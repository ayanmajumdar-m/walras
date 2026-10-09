import React, { useEffect, useState } from "react";
import { authHeaders } from "../consoleApi";
import "./Dashboard.css";
import { useConsole } from "../ConsoleContext";
import AutoTopup from "./AutoTopup";

const Wallet = () => {
  // Admins can pause top-ups in Settings; the server refuses them too.
  const topUpsPaused = Boolean(useConsole().platform?.topUpsPaused);
  const [balance, setBalance] = useState(0);
  const [nextRenewal, setNextRenewal] = useState(0);
  const [nextInvoiceDate, setNextInvoiceDate] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [userData, setUserData] = useState(null);
  const API_URL = ``

  const [promoLoading, setPromoLoading] = useState(false);

  const token = localStorage.getItem("token"); // get JWT token

  useEffect(() => {
    fetchWallet();
    fetchUserData();

    // Check for return status from CCAvenue
    const params = new URLSearchParams(window.location.search);
    const pStatus = params.get("payment_status");
    if (pStatus === "success") {
      const creditedAmt = params.get("amount");
      const trackingId = params.get("tracking_id");
      alert(`✅ Payment Successful! Your wallet has been credited ₹${creditedAmt || ""}. (Ref: ${trackingId || ""})`);
      window.history.replaceState({}, document.title, window.location.pathname);
      fetchWallet();
    } else if (pStatus === "failed") {
      const reason = params.get("reason") || "Transaction failed";
      alert(`❌ Payment Failed: ${reason}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (pStatus === "cancelled") {
      alert("⚠️ Payment was cancelled.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // ✅ Get user ID from JWT token
  const getUserIdFromToken = () => {
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded.userId;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  // ✅ Fetch user data
  const fetchUserData = async () => {
    if (!token) return console.error("No auth token found");
    
    const userId = getUserIdFromToken();
    if (!userId) {
      console.error("No user ID found in token");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/users/profile/${userId}`, {
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
      });
      const data = await res.json();
      if (res.ok) {
        setUserData(data);
      } else {
        console.error("User data fetch failed:", data);
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  };

  // ✅ Fetch wallet data
  const fetchWallet = async () => {
    if (!token) return console.error("No auth token found");
    try {
      const res = await fetch(`${API_URL}/api/wallet`, {
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
      });
      const data = await res.json();
      if (res.ok) {
        setBalance(parseFloat(data.balance));
        setNextRenewal(parseFloat(data.nextRenewal) || 0);
        setNextInvoiceDate(data.nextInvoiceDate);
      } else {
        console.error("Wallet fetch failed:", data);
      }
    } catch (err) {
      console.error("Error fetching wallet:", err);
    }
  };

  // ✅ CCAvenue payment handler
  const handleCcavenuePayment = async (amt) => {
    try {
      const res = await fetch(`${API_URL}/api/payment/ccavenue/initiate-wallet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ amount: amt }),
      });

      const data = await res.json();
      if (!res.ok || !data.encRequest) {
        alert(data.error || "Failed to initiate CCAvenue payment");
        setLoading(false);
        return;
      }

      // Create hidden dynamic form and auto-submit to CCAvenue
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.actionUrl;

      const encInput = document.createElement("input");
      encInput.type = "hidden";
      encInput.name = "encRequest";
      encInput.value = data.encRequest;
      form.appendChild(encInput);

      const accessInput = document.createElement("input");
      accessInput.type = "hidden";
      accessInput.name = "access_code";
      accessInput.value = data.accessCode;
      form.appendChild(accessInput);

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      console.error("[CCAvenue] Payment initiation error:", err);
      alert("Failed to start CCAvenue checkout");
      setLoading(false);
    }
  };

  // ✅ Main payment handler
  const handleAddFunds = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return alert("Enter a valid amount (INR)");
    if (!token) return alert("Authentication token missing");

    try {
      setLoading(true);

      await handleCcavenuePayment(amt);

      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  // ✅ Apply promo code handler
  const handleApplyPromoCode = async () => {
    if (!promoCode.trim()) {
      alert("Please enter a promo code");
      return;
    }

    try {
      setPromoLoading(true);
      const response = await fetch(`${API_URL}/api/wallet/apply-promo`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ promoCode: promoCode.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        alert(`✅ ${data.message}\nCredit: ₹${data.creditAmount}\nNew Balance: ₹${data.newBalance}`);
        setPromoCode("");
        fetchWallet(); // Refresh wallet
      } else {
        alert("❌ " + data.error);
      }
    } catch (error) {
      console.error("Error applying promo code:", error);
      alert("Failed to apply promo code");
    } finally {
      setPromoLoading(false);
    }
  };

  return (
    <div className="wallet-container">
      {/* Header */}
      <div className="wallet-header">
        <h1>Account Balance</h1>
        {userData && (
          <p className="welcome-message">Welcome back, {userData.name}!</p>
        )}
      </div>

      {/* Wallet Summary */}
      <div className="wallet-summary">
        <div className="wallet-card">
          <h3>Available Balance</h3>
          <p className="wallet-value">₹{balance.toFixed(2)}</p>
        </div>
        <div className="wallet-card">
          <h3>Next renewal</h3>
          <p className="wallet-value">₹{nextRenewal.toFixed(2)} <small className="wallet-sub">+ GST</small></p>
        </div>
        <div className="wallet-card">
          <h3>Renews on</h3>
          <p className="wallet-value">{nextInvoiceDate}</p>
        </div>
      </div>

      {/* Promo Code Section */}
      <div className="wallet-promo-section">
        <h2>Promo Code</h2>
        <p>Enter a promo code to get credits added to your wallet.</p>

        <div className="wallet-input-row">
          <input
            type="text"
            placeholder="Enter promo code"
            name="promoCode"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
          />
          <button
            className="wallet-promo-btn"
            onClick={handleApplyPromoCode}
            disabled={promoLoading}
          >
            {promoLoading ? "Applying..." : "Apply Code"}
          </button>
        </div>
      </div>

      {/* Add Funds Section */}
      {topUpsPaused ? (
      <div className="wallet-add-section">
        <h2>Add Funds</h2>
        <p>Adding funds to your account balance is unavailable right now. Your current balance stays available for your services.</p>
      </div>
      ) : (
      <div className="wallet-add-section">
        <h2>Add Funds</h2>
        <p>Enter the amount to add to your account balance.</p>

        <p className="wallet-pay-with">Paid securely through CCAvenue: UPI, cards and net banking.</p>

        <div className="wallet-input-row">
          <input
            type="number"
            placeholder="Enter amount (₹)"
            name="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button
            className="wallet-add-btn"
            onClick={handleAddFunds}
            disabled={loading}
          >
            {loading ? "Processing..." : "Add Funds"}
          </button>
        </div>

      </div>
      )}

      <AutoTopup balance={balance} onChange={fetchWallet} />
    </div>
  );
};

export default Wallet;