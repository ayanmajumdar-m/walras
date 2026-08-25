import React, { useEffect, useState } from 'react';
import './Cart.css';

const Cart = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('wallet'); // <-- NEW
  const [contactInfo, setContactInfo] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    company: '', address1: '', address2: '', city: '',
    state: '', country: 'India', postalCode: '', gender: 'm'
  });

  const API_URL = `https://buttr.cloud`

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('cart') || '[]');
    setCart(saved);
  }, []);

  const removeItem = (idx) => {
    const next = cart.slice();
    next.splice(idx, 1);
    setCart(next);
    localStorage.setItem('cart', JSON.stringify(next));
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('cart');
  };

  const handleCheckout = async (item) => {
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('You must be logged in to purchase');

      const body = {
        domainName: item.domain,
        registrationPeriod: item.period === 'year' ? 1 : item.period || 1,
        paymentMethod,
        contactInfo
      };

      // === WALLET PAYMENT FLOW ===
      if (paymentMethod === 'wallet') {
        const res = await fetch(`${API_URL}/api/users/openprovider/purchase-domain`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Purchase failed');

        const remaining = cart.filter(c => c.domain !== item.domain);
        setCart(remaining);
        localStorage.setItem('cart', JSON.stringify(remaining));
        alert(`Domain ${item.domain} purchased successfully via Wallet!`);
      }

      // === RAZORPAY PAYMENT FLOW ===
      else if (paymentMethod === 'razorpay') {
        // Step 1: Create Razorpay order via backend (same endpoint)
        const res = await fetch(`${API_URL}/api/users/openprovider/purchase-domain`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Razorpay order failed');

        // Step 2: Launch Razorpay Checkout
        const options = {
          key: process.env.REACT_APP_RAZORPAY_KEY_ID, // 🔑 from your Razorpay Dashboard
          amount: data.amount, // amount in paise
          currency: 'INR',
          name: 'Glid Domains',
          description: `Purchase domain ${item.domain}`,
          order_id: data.orderId, // returned by backend
          handler: function (response) {
            alert(`Payment successful for ${item.domain}!`);
            const remaining = cart.filter(c => c.domain !== item.domain);
            setCart(remaining);
            localStorage.setItem('cart', JSON.stringify(remaining));
          },
          prefill: {
            name: `${contactInfo.firstName} ${contactInfo.lastName}`,
            email: contactInfo.email,
            contact: contactInfo.phone
          },
          theme: { color: '#ffdf33' }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      }

    } catch (err) {
      console.error('Checkout error', err);
      setError(err.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cart-page">
      <h1>Your Cart</h1>
      {error && <div className="error">{error}</div>}
      {cart.length === 0 ? (
        <div className="empty">Your cart is empty.</div>
      ) : (
        <div className="cart-list">
          {cart.map((item, idx) => (
            <div className="cart-item" key={idx}>
              <div className="cart-item-main">
                <div className="cart-domain">{item.domain}</div>
                <div className="cart-meta">
                  Price: {item.currency} {item.price} / {item.period}
                </div>
              </div>
              <div className="cart-actions">
                <button onClick={() => handleCheckout(item)} disabled={loading}>
                  Checkout
                </button>
                <button onClick={() => removeItem(idx)} disabled={loading}>Remove</button>
              </div>
            </div>
          ))}

          <div className="cart-actions-bottom">
            <button onClick={clearCart} disabled={loading}>Clear Cart</button>
          </div>
        </div>
      )}

      {/* Payment Method Selection */}
      <div className="payment-section">
        <h3>Select Payment Method</h3>
        <label>
          <input
            type="radio"
            value="wallet"
            checked={paymentMethod === 'wallet'}
            onChange={e => setPaymentMethod(e.target.value)}
          /> Wallet
        </label>
        <label>
          <input
            type="radio"
            value="razorpay"
            checked={paymentMethod === 'razorpay'}
            onChange={e => setPaymentMethod(e.target.value)}
          /> Razorpay
        </label>
      </div>

      {/* Contact Info */}
      <div className="contact-form">
        <h3>Contact information for registration</h3>
        <div className="row">
          <input placeholder="First name" value={contactInfo.firstName}
            onChange={e => setContactInfo({ ...contactInfo, firstName: e.target.value })} />
          <input placeholder="Last name" value={contactInfo.lastName}
            onChange={e => setContactInfo({ ...contactInfo, lastName: e.target.value })} />
        </div>
        <div className="row">
          <input placeholder="Email" value={contactInfo.email}
            onChange={e => setContactInfo({ ...contactInfo, email: e.target.value })} />
          <input placeholder="Phone" value={contactInfo.phone}
            onChange={e => setContactInfo({ ...contactInfo, phone: e.target.value })} />
        </div>
        <div className="row">
          <input placeholder="Address line 1" value={contactInfo.address1}
            onChange={e => setContactInfo({ ...contactInfo, address1: e.target.value })} />
          <input placeholder="City" value={contactInfo.city}
            onChange={e => setContactInfo({ ...contactInfo, city: e.target.value })} />
        </div>
        <div className="row">
          <input placeholder="State" value={contactInfo.state}
            onChange={e => setContactInfo({ ...contactInfo, state: e.target.value })} />
          <input placeholder="Postal Code" value={contactInfo.postalCode}
            onChange={e => setContactInfo({ ...contactInfo, postalCode: e.target.value })} />
        </div>
      </div>
    </div>
  );
};

export default Cart;
