const userRouter = require('express').Router();
require('dotenv').config();
const axios = require('axios');
const WHOIS_API_KEY = process.env.WHOIS_API_KEY;
const UserController = require('../controllers/user.controllers');
const WalletController = require('../controllers/wallet.controllers')
const authenticateToken = require('../utils/auth.middleware');
const { requireSalesOpen } = require('../utils/platformSettings');

// Public routes
//
// Sign-up, sign-in, email verification and password reset are in
// routes/auth.routes.js, mounted at /api/auth.

// Protected routes
userRouter.get('/profile/:id', authenticateToken, UserController.viewProfile);
userRouter.put('/profile/:id', authenticateToken, UserController.updateProfile);

userRouter.get('/wallet/billing-history', authenticateToken, WalletController.getBillingHistory );

userRouter.get('/openprovider/auth-token', authenticateToken, UserController.getOpenProviderAuthToken);
userRouter.get('/openprovider/domains', authenticateToken, UserController.getOpenProviderDomains);
userRouter.post('/openprovider/search-domain', authenticateToken, UserController.searchDomain);
userRouter.post('/openprovider/purchase-domain', authenticateToken, requireSalesOpen, UserController.purchaseDomain);
userRouter.post('/openprovider/verify-domain-payment', authenticateToken, UserController.verifyDomainPayment);
userRouter.get('/openprovider/domain-transactions', authenticateToken, UserController.getDomainTransactions);
// Update nameservers for a purchased domain
userRouter.post('/openprovider/update-nameservers', authenticateToken, UserController.updateNameservers);
// Transfer a domain (requires auth code)
userRouter.post('/openprovider/transfer-domain', authenticateToken, UserController.transferDomain);

userRouter.get("/domain-check", async (req, res) => {
  const { domain } = req.query;
  
  console.log("Domain check request for:", domain);
  
  if (!domain) {
    return res.status(400).json({ error: "Domain is required" });
  }

  // Validate domain format
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
  if (!domainRegex.test(domain)) {
    return res.status(400).json({ error: "Invalid domain format" });
  }

  if (!WHOIS_API_KEY) {
    console.error("WHOIS_API_KEY is not configured");
    return res.status(500).json({ 
      error: "WHOIS service is temporarily unavailable. Please try again later." 
    });
  }

  try {
    console.log("Making WHOIS API request...");
    const response = await axios.get(
      `https://domain-availability.whoisxmlapi.com/api/v1`,
      {
        params: {
          apiKey: WHOIS_API_KEY,
          domainName: domain,
          outputFormat: "JSON",
        },
        timeout: 10000,
      }
    );
    
    console.log("WHOIS API full response:", JSON.stringify(response.data, null, 2));

    const apiData = response.data || {};
    let isAvailable = false;
    let status = "UNKNOWN";

    // Parse the actual WHOIS response structure
    if (apiData.DomainInfo) {
      // Standard WHOIS XML API response format
      status = apiData.DomainInfo.domainAvailability || "UNKNOWN";
      isAvailable = status === "AVAILABLE";
      
      // Additional check - if we have registrar info, domain is definitely taken
      if (apiData.DomainInfo.registrarName || apiData.DomainInfo.registrar) {
        isAvailable = false;
        status = "UNAVAILABLE";
      }
    } 
    else if (apiData.WhoisRecord) {
      // Alternative WHOIS response format
      if (apiData.WhoisRecord.registrar || apiData.WhoisRecord.registryData) {
        isAvailable = false;
        status = "UNAVAILABLE";
      } else {
        isAvailable = true;
        status = "AVAILABLE";
      }
    }
    else if (typeof apiData.available !== 'undefined') {
      // Simple boolean availability
      isAvailable = apiData.available;
      status = apiData.available ? "AVAILABLE" : "UNAVAILABLE";
    }
    else if (apiData.domainAvailability) {
      // Direct domainAvailability field
      status = apiData.domainAvailability;
      isAvailable = apiData.domainAvailability === "AVAILABLE";
    }

    // Final sanity check - if status is still unknown, be conservative and mark as unavailable
    if (status === "UNKNOWN") {
      console.warn("Unknown availability status, defaulting to unavailable for safety");
      isAvailable = false;
      status = "UNAVAILABLE";
    }

    console.log(`Domain ${domain} - Available: ${isAvailable}, Status: ${status}`);

    const normalized = [{
      domain: domain,
      available: isAvailable,
      status: status,
      registrar: apiData.DomainInfo?.registrarName || apiData.WhoisRecord?.registrar?.name || null,
      createdDate: apiData.WhoisRecord?.createdDate || apiData.DomainInfo?.createdDate || null,
      expiresDate: apiData.WhoisRecord?.expiresDate || apiData.DomainInfo?.expiresDate || null,
      // Use realistic pricing based on TLD
      price: calculateRealisticPrice(domain),
      currency: 'INR',
      period: 'year',
      raw: apiData // Keep raw data for debugging
    }];

    return res.json({ results: normalized });
    
  } catch (err) {
    console.error("WHOIS API Error:", err.message);
    
    // Provide more specific error messages
    if (err.response) {
      console.error("WHOIS API Response Error:", err.response.status, err.response.data);
      
      if (err.response.status === 402) {
        return res.status(500).json({ 
          error: "WHOIS API quota exceeded. Please try again later." 
        });
      }
      
      return res.status(502).json({ 
        error: `WHOIS service error: ${err.response.status}` 
      });
    } else if (err.request) {
      console.error("No response from WHOIS API");
      return res.status(503).json({ 
        error: "WHOIS service unavailable. Please try again later." 
      });
    } else {
      console.error("Other error:", err.message);
      return res.status(500).json({ 
        error: `Server error: ${err.message}` 
      });
    }
  }
});

// Helper function to calculate realistic pricing based on TLD
function calculateRealisticPrice(domain) {
  const tld = domain.split('.').pop().toLowerCase();
  const pricing = {
    'com': 899,
    'in': 599,
    'org': 899,
    'net': 949,
    'io': 2499,
    'co': 1999,
    'ai': 3999,
    'dev': 1499,
    'app': 1799,
    'tech': 1499,
    'store': 1299,
    'online': 999,
    'site': 799,
    'xyz': 299
  };
  
  return pricing[tld] || 799; // Default price for other TLDs
}
// Get the domains purchased by that user
userRouter.get('/domains/purchased', authenticateToken, UserController.getPurchasedDomains);

module.exports = userRouter;