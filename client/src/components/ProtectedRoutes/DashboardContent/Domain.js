import React, { useState } from 'react'
import './Domain.css'

function Domain() {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState(null)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [error, setError] = useState('')
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)
  const [contactInfo, setContactInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    country: 'India',
    postalCode: '',
    gender: 'm'
  })
  const [registrationPeriod, setRegistrationPeriod] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState('wallet')

  const handleSearch = async (e) => {
  e.preventDefault()
  if (!searchTerm || !searchTerm.trim()) return

  if (!searchTerm.includes('.')) {
    setError('Please include a top-level domain (e.g., "example.com" or "example.in").')
    return
  }

  setIsSearching(true)
  setError('')
  setSearchResults([])

  try {
    const domainName = encodeURIComponent(searchTerm.toLowerCase().trim())
    const token = localStorage.getItem('token')
    const url = `${API_URL}/api/users/domain-check?domain=${domainName}`

    console.log('Searching domain:', domainName);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      throw new Error(errorData?.error || `HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    console.log('Domain check response:', data);

    // Use the results array directly from the API
    if (data.results && Array.isArray(data.results)) {
      const results = data.results.map(result => ({
        ...result,
        // Ensure availability is boolean
        available: Boolean(result.available),
        // Use the price from API or fallback
        price: result.price
      }))
      
      setSearchResults(results)
    } else {
      setError('Invalid response format from server')
      setSearchResults([])
    }

  } catch (error) {
    console.error('Error searching domain:', error)
    setError(error.message || 'Failed to search domain. Please try again.')
    setSearchResults([])
  } finally {
    setIsSearching(false)
  }
}

  // Fetch wallet balance on component mount
  React.useEffect(() => {
    fetchWalletBalance()
  }, [])

  const fetchWalletBalance = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/wallet`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setWalletBalance(parseFloat(data.balance))
      }
    } catch (error) {
      console.error('Error fetching wallet balance:', error)
    }
  }

  const handlePurchase = (domain) => {
    setSelectedDomain(domain)
    setShowPurchaseModal(true)
  }

  const handlePurchaseConfirm = async () => {
    if (!selectedDomain) return

    setIsPurchasing(true)
    setError('')

    try {
      const token = localStorage.getItem('token')
      const totalAmount = selectedDomain.price * registrationPeriod

      const purchaseData = {
        domainName: selectedDomain.domain,
        registrationPeriod,
        paymentMethod,
        contactInfo
      }

      const response = await fetch(`${API_URL}/api/users/openprovider/purchase-domain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(purchaseData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Purchase failed')
      }

      if (paymentMethod === 'wallet') {
        // Wallet payment - domain should be registered immediately
        alert(`Domain ${selectedDomain.domain} purchased successfully!`)
        setShowPurchaseModal(false)
        setSelectedDomain(null)
        fetchWalletBalance() // Refresh wallet balance
      } else {
        // Razorpay payment - show payment form
        handleRazorpayPayment(data)
      }

    } catch (error) {
      console.error('Purchase error:', error)
      setError(error.message || 'Purchase failed. Please try again.')
    } finally {
      setIsPurchasing(false)
    }
  }

  const API_URL = `http://y0koc4ok88sk0cww0cwssco4.172.236.189.24.sslip.io`
  const handleRazorpayPayment = async (orderData) => {
    const options = {
      key: orderData.key,
      amount: orderData.amount,
      currency: orderData.currency,
      name: 'Domain Purchase',
      description: `Domain: ${selectedDomain.domain}`,
      order_id: orderData.orderId,
      handler: async function (response) {
        try {
          const token = localStorage.getItem('token')
          const verifyResponse = await fetch(`${API_URL}/api/users/openprovider/verify-domain-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              domainTransactionId: orderData.domainTransactionId
            })
          })

          const verifyData = await verifyResponse.json()

          if (verifyResponse.ok) {
            alert(`Domain ${selectedDomain.domain} purchased successfully!`)
            setShowPurchaseModal(false)
            setSelectedDomain(null)
          } else {
            throw new Error(verifyData.error || 'Payment verification failed')
          }
        } catch (error) {
          console.error('Payment verification error:', error)
          setError(error.message || 'Payment verification failed')
        }
      },
      prefill: {
        name: contactInfo.firstName + ' ' + contactInfo.lastName,
        email: contactInfo.email,
        contact: contactInfo.phone
      },
      theme: {
        color: '#3399cc'
      }
    }

    const rzp = new window.Razorpay(options)
    rzp.on('payment.failed', function (response) {
      setError('Payment failed. Please try again.')
    })
    rzp.open()
  }

  return (
    <div className="domain-container">
      <div className="domain-header">
        <h1>Domain Search & Purchase</h1>
        <p>Find and purchase the perfect domain for your project</p>
      </div>

      <div className="search-section">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-group">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter domain name (e.g., mywebsite)"
              className="search-input"
            />
            <button 
              type="submit" 
              className="search-button"
              disabled={isSearching}
            >
              {isSearching ? 'Searching...' : 'Search Domain'}
            </button>
          </div>
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </form>
      </div>

      {searchResults.length > 0 && (
        <div className="results-section">
          <h2>Domain Search Results</h2>
          <div className="results-grid">
            {searchResults.map((result, index) => (
              <div key={index} className={`domain-card ${result.available ? 'available' : 'unavailable'}`}>
                <div className="domain-info">
                  <h3 className="domain-name">{result.domain}</h3>
                  <div className="domain-status">
                    <span className={`status-badge ${result.available ? 'available' : 'unavailable'}`}>
                      {result.available ? 'Available' : 'Taken'}
                    </span>
                  </div>
                </div>
                <div className="domain-pricing">
                  <div className="price">
                    <span className="currency">{result.currency}</span>
                    <span className="amount">{result.price}</span>
                    <span className="period">/{result.period}</span>
                  </div>
                </div>
                <div className="domain-actions">
                  {result.available ? (
                    <button 
                      className="purchase-button"
                      onClick={() => handlePurchase(result)}
                    >
                      Purchase
                    </button>
                  ) : (
                    <button className="suggest-button" disabled>
                      Not Available
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPurchaseModal && selectedDomain && (
        <div className="modal-overlay">
          <div className="purchase-modal">
            <div className="modal-header">
              <h2>Purchase Domain</h2>
              <button 
                className="close-button"
                onClick={() => setShowPurchaseModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="domain-summary">
                <h3>{selectedDomain.domain}</h3>
                <div className="pricing-details">
                  <div className="price-breakdown">
                    <div className="price-item">
                      <span>Domain Registration</span>
                      <span>₹{selectedDomain.price}</span>
                    </div>
                    <div className="price-item">
                      <span>Registration Period</span>
                      <span>{registrationPeriod} {registrationPeriod === 1 ? 'Year' : 'Years'}</span>
                    </div>
                    <div className="price-item total">
                      <span>Total</span>
                      <span>₹{selectedDomain.price * registrationPeriod}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="purchase-options">
                <div className="registration-period">
                  <label>Registration Period:</label>
                  <select 
                    value={registrationPeriod} 
                    onChange={(e) => setRegistrationPeriod(parseInt(e.target.value))}
                  >
                    <option value="1">1 Year</option>
                    <option value="2">2 Years</option>
                    <option value="3">3 Years</option>
                    <option value="5">5 Years</option>
                  </select>
                </div>
                
                <div className="payment-method">
                  <label>Payment Method:</label>
                  <div className="payment-options">
                    <label className="payment-option">
                      <input 
                        type="radio" 
                        name="payment" 
                        value="razorpay" 
                        checked={paymentMethod === 'razorpay'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      />
                      <span>Credit/Debit Card (Razorpay)</span>
                    </label>
                    <label className="payment-option">
                      <input 
                        type="radio" 
                        name="payment" 
                        value="wallet" 
                        checked={paymentMethod === 'wallet'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      />
                      <span>Wallet Balance (₹{walletBalance.toFixed(2)})</span>
                    </label>
                  </div>
                  {paymentMethod === 'wallet' && walletBalance < (selectedDomain.price * registrationPeriod) && (
                    <div className="insufficient-balance">
                      <p>Insufficient wallet balance. Add funds to your wallet or use Razorpay.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="contact-information">
                <h4>Contact Information</h4>
                <p className="form-note">
                  Please ensure your address starts with a house number (e.g., "123 Main Street") 
                  and your phone number is in local format (e.g., "9876543210" for India).
                </p>
                <div className="contact-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>First Name *</label>
                      <input 
                        type="text" 
                        value={contactInfo.firstName}
                        onChange={(e) => setContactInfo({...contactInfo, firstName: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Last Name *</label>
                      <input 
                        type="text" 
                        value={contactInfo.lastName}
                        onChange={(e) => setContactInfo({...contactInfo, lastName: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Email *</label>
                      <input 
                        type="email" 
                        value={contactInfo.email}
                        onChange={(e) => setContactInfo({...contactInfo, email: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Phone *</label>
                      <input 
                        type="tel" 
                        value={contactInfo.phone}
                        onChange={(e) => setContactInfo({...contactInfo, phone: e.target.value})}
                        placeholder="e.g., 9876543210 (10 digits for India)"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Gender *</label>
                      <select 
                        value={contactInfo.gender}
                        onChange={(e) => setContactInfo({...contactInfo, gender: e.target.value})}
                        required
                      >
                        <option value="m">Male</option>
                        <option value="f">Female</option>
                        <option value="o">Other</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Country *</label>
                      <select 
                        value={contactInfo.country}
                        onChange={(e) => setContactInfo({...contactInfo, country: e.target.value})}
                        required
                      >
                        <option value="India">India</option>
                        <option value="United States">United States</option>
                        <option value="United Kingdom">United Kingdom</option>
                        <option value="Canada">Canada</option>
                        <option value="Australia">Australia</option>
                        <option value="Germany">Germany</option>
                        <option value="France">France</option>
                        <option value="Japan">Japan</option>
                        <option value="China">China</option>
                        <option value="Brazil">Brazil</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Company</label>
                    <input 
                      type="text" 
                      value={contactInfo.company}
                      onChange={(e) => setContactInfo({...contactInfo, company: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label>Address Line 1 *</label>
                    <input 
                      type="text" 
                      value={contactInfo.address1}
                      onChange={(e) => setContactInfo({...contactInfo, address1: e.target.value})}
                      placeholder="e.g., 123 Main Street (start with house number)"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Address Line 2</label>
                    <input 
                      type="text" 
                      value={contactInfo.address2}
                      onChange={(e) => setContactInfo({...contactInfo, address2: e.target.value})}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>City *</label>
                      <input 
                        type="text" 
                        value={contactInfo.city}
                        onChange={(e) => setContactInfo({...contactInfo, city: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>State *</label>
                      <input 
                        type="text" 
                        value={contactInfo.state}
                        onChange={(e) => setContactInfo({...contactInfo, state: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Country *</label>
                      <input 
                        type="text" 
                        value={contactInfo.country}
                        onChange={(e) => setContactInfo({...contactInfo, country: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Postal Code *</label>
                      <input 
                        type="text" 
                        value={contactInfo.postalCode}
                        onChange={(e) => setContactInfo({...contactInfo, postalCode: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="cancel-button"
                onClick={() => setShowPurchaseModal(false)}
                disabled={isPurchasing}
              >
                Cancel
              </button>
              <button 
                className="confirm-purchase-button"
                onClick={handlePurchaseConfirm}
                disabled={isPurchasing || (paymentMethod === 'wallet' && walletBalance < (selectedDomain.price * registrationPeriod))}
              >
                {isPurchasing ? 'Processing...' : 'Confirm Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Domain