import React, { useEffect, useState } from "react";
import { api, authHeaders } from "../consoleApi";
import { payWithRazorpay } from "../razorpayCheckout";
import "./Dashboard.css";
import { useConsole } from "../ConsoleContext";
import AutoTopup from "./AutoTopup";

const Wallet = () => {
  // Admins can pause top-ups in Settings; the server refuses them too.
  const { platform, refreshBalance } = useConsole();
  const topUpsPaused = Boolean(platform?.topUpsPaused);
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

  // ✅ Add funds: Razorpay Checkout, then the server credits the balance
  const handleAddFunds = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 1) return alert("Enter an amount of at least ₹1");
    if (!token) return alert("Authentication token missing");

    setLoading(true);
    try {
      const { checkout } = await api("/api/payment/razorpay/topup", { method: "POST", body: { amount: amt } });
      const result = await payWithRazorpay(checkout);
      alert(`✅ ${result.message}`);
      setAmount("");
      fetchWallet();
      refreshBalance?.();
    } catch (err) {
      if (err.message !== "Session expired") alert(err.cancelled ? `⚠️ ${err.message}` : `❌ ${err.message}`);
    } finally {
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

        <p className="wallet-pay-with">Paid securely through Razorpay: UPI, cards, net banking and wallets.</p>

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