const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const integrations = require('../utils/integrations');

// From Admin → Integrations (falling back to the env); read on each use so
// changes apply without a restart.
const openProviderApi = () => integrations.get('OPENPROVIDER_API');

// Create axios instance with default config; the base URL is read on each
// request so a change in admin applies straight away.
const apiClient = axios.create({
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
    }
});
apiClient.interceptors.request.use((config) => ({ ...config, baseURL: openProviderApi() }));


async function getAuthToken() {
    if (!integrations.get('OPENPROVIDER_USERNAME') || !integrations.get('OPENPROVIDER_PASSWORD')) {
        throw new Error('OpenProvider credentials not configured. Please set OPENPROVIDER_USERNAME and OPENPROVIDER_PASSWORD environment variables.');
    }

    try {
        const { data } = await axios.post(`${openProviderApi()}/auth/login`, {
            username: integrations.get('OPENPROVIDER_USERNAME'),
            password: integrations.get('OPENPROVIDER_PASSWORD')
        });
        return data.data.token;
    } catch (error) {
        console.error('OpenProvider authentication failed:', error.response?.data || error.message);
        throw new Error('Failed to authenticate with OpenProvider API');
    }
}

async function getDomains() {
    const token = await getAuthToken();
    const { data } = await axios.get(`${openProviderApi()}/domains`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    return data.data;
}

async function searchDomain(domainName) {
    try {
        const token = await getAuthToken();

        if (!domainName || typeof domainName !== "string") {
            throw new Error("Invalid domain name provided");
        }

        const cleanDomain = domainName.toLowerCase().trim();
        const parts = cleanDomain.split(".");
        if (parts.length < 2) {
            throw new Error("Domain name must include a valid TLD (e.g., .com, .net)");
        }

        const name = parts.shift();
        const extension = parts.join(".");

        console.log(`🔍 Searching for domain: ${name}.${extension}`);

        const payload = {
            domains: [{ name, extension }],
            with_price: true   // ✅ include pricing info
        };

        const { data } = await axios.post(
            `${openProviderApi()}/domains/check`,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    Accept: "application/json"
                }
            }
        );

        console.log("✅ OpenProvider API response:", JSON.stringify(data, null, 2));

        if (data?.data?.results) {
            const formattedResults = data.data.results.map((result) => {
                const fullDomain = result.domain || `${name}.${extension}`;
                const isAvailable = result.status?.toLowerCase() === "free";
                const resellerPrice = result.price?.reseller?.price || 0;
                const currency = result.price?.reseller?.currency || "USD";

                return {
                    domain: fullDomain,
                    available: isAvailable,
                    status: result.status,
                    reason: result.reason || null,
                    isPremium: result.is_premium || false,
                    price: Math.round(resellerPrice * (currency === "USD" ? 90 : 1)), // convert USD→INR
                    currency: "INR",
                    period: "year"
                };
            });

            console.log("Formatted results:", formattedResults);
            return { results: formattedResults };
        }

        return { results: [] };

    } catch (apiError) {
        console.error("❌ OpenProvider API error:", {
            status: apiError.response?.status,
            statusText: apiError.response?.statusText,
            data: apiError.response?.data,
            message: apiError.message
        });

        throw new Error(
            `OpenProvider API error: ${apiError.response?.status} - ${apiError.response?.data?.desc || apiError.message}`
        );
    }
}



async function getDomainPrice(extension) {
    try {
        const token = await getAuthToken();
        const { data } = await apiClient.get(`/domains/prices/${extension}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const priceData = data.data;
        return {
            extension,
            period: 1,
            currency: 'INR',
            register: Math.round((priceData.register?.price || 0) * 90), // EUR to INR
            renew: Math.round((priceData.renew?.price || 0) * 90),
            transfer: Math.round((priceData.transfer?.price || 0) * 90)
        };
    } catch (error) {
        console.error('Error fetching domain price:', error.response?.data || error.message);
        throw new Error(`Failed to fetch price for .${extension}`);
    }
}

async function registerDomain(params) {
    try {
        const token = await getAuthToken();
        const {
            domainName,
            nameservers = ['ns1.op.eu', 'ns2.op.nl'],
            period = 1,
            contacts,
            contactDetails
        } = params;

        if (!domainName) {
            throw new Error('Domain name is required');
        }

        const parts = domainName.split('.');
        if (parts.length < 2) {
            throw new Error('Invalid domain name format');
        }

        const name = parts.shift();
        const extension = parts.join('.');

        // If no contacts provided but contactDetails exists, create a new contact
        let customerHandle;
        if (!contacts && contactDetails) {
            try {
                console.log('Creating new contact for domain registration...');
                const contactResponse = await createContact({
                    ...contactDetails,
                    domainExtension: extension
                });
                customerHandle = contactResponse.handle;
                console.log('Contact created successfully with handle:', customerHandle);
            } catch (contactError) {
                console.error('Failed to create contact:', contactError);
                throw new Error('Failed to create contact for domain registration');
            }
        }

        // Verify contact handles exist before proceeding
        async function verifyContact(handle) {
            try {
                const { data } = await apiClient.get(`/customers/${handle}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                return data.code === 0;
            } catch (error) {
                console.log(`Contact verification failed for handle ${handle}:`, error.response?.data);
                return false;
            }
        }

        // Wait for contacts to be fully propagated
        if (contacts) {
            const handles = [
                contacts.owner,
                contacts.admin || contacts.owner,
                contacts.tech || contacts.owner,
                contacts.billing || contacts.owner
            ];

            console.log('Verifying contact handles:', handles);

            // Try verification up to 3 times with delays
            for (let attempt = 1; attempt <= 3; attempt++) {
                const verificationResults = await Promise.all(
                    handles.map(async handle => ({
                        handle,
                        exists: await verifyContact(handle)
                    }))
                );

                const missingHandles = verificationResults
                    .filter(result => !result.exists)
                    .map(result => result.handle);

                if (missingHandles.length === 0) {
                    console.log('All contact handles verified successfully');
                    break;
                }

                if (attempt === 3) {
                    throw new Error(`Contact handles not found after 3 attempts: ${missingHandles.join(', ')}`);
                }

                console.log(`Attempt ${attempt}: Waiting for contacts to propagate...`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between attempts
            }
        }

        // Using the exact payload structure from the working cURL example
        const payload = {
            domain: {
                name: name,
                extension: extension
            },
            period: period.toString(),
            name_servers: nameservers.map(ns => ({ name: ns })),
            autorenew: "on",
            dns_management: true,
            is_dnssec_enabled: false,
            is_spamexperts_enabled: false,
            use_domicile: false
        };

        // Use provided contacts, newly created contact, or throw error
        if (contacts) {
            payload.admin_handle = contacts.admin || contacts.owner;
            payload.billing_handle = contacts.billing || contacts.owner;
            payload.owner_handle = contacts.owner;
            payload.tech_handle = contacts.tech || contacts.owner;
        } else if (customerHandle) {
            payload.admin_handle = customerHandle;
            payload.billing_handle = customerHandle;
            payload.owner_handle = customerHandle;
            payload.tech_handle = customerHandle;
        } else {
            throw new Error('Either contacts or contactDetails must be provided for domain registration');
        }

        console.log('Registering domain with payload:', JSON.stringify(payload, null, 2));

        console.log('Sending domain registration request with payload:', JSON.stringify(payload, null, 2));

        const { data } = await apiClient.post('/domains', payload, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000  // 120 second timeout
        });

        console.log('Domain registration response:', JSON.stringify(data, null, 2));

        if (data.code !== 0) {
            throw new Error(`OpenProvider error: ${data.desc}`);
        }

        return {
            success: true,
            id: data.data.id,
            status: data.data.status,
            activationDate: data.data.activation_date,
            renewalDate: data.data.renewal_date,
            expirationDate: data.data.expiration_date,
            authCode: data.data.auth_code
        };
    } catch (error) {
        console.error('Domain registration error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            payload: error.config?.data
        });

        // Throw a more descriptive error
        if (error.response?.data?.desc) {
            throw new Error(`OpenProvider error: ${error.response.data.desc}`);
        } else if (error.code === 'ECONNABORTED') {
            throw new Error('Domain registration timed out. Please try again.');
        } else if (error.code === 'ECONNRESET') {
            throw new Error('Connection was reset. Please try again.');
        } else {
            throw new Error(`Failed to register domain: ${error.message}`);
        }
    }
}

async function createContact(contactData) {
    try {
        console.log('=== OPENPROVIDER CONTACT CREATION DEBUG ===');
        console.log('Input contact data:', JSON.stringify(contactData, null, 2));

        // Validate input data first
        validateContactData(contactData);

        const token = await getAuthToken();
        console.log('Auth token obtained:', token ? 'Yes' : 'No');

        // Simplified country code mapping
        const getCountryCode = (countryName) => {
            const countryMap = {
                'india': 'IN',
                'united states': 'US',
                'united kingdom': 'GB',
                'canada': 'CA',
                'australia': 'AU',
                'germany': 'DE',
                'france': 'FR',
                'japan': 'JP',
                'china': 'CN',
                'brazil': 'BR'
            };
            return countryMap[countryName.toLowerCase()] || 'IN';
        };

        // SIMPLIFIED address handling - OpenProvider is very particular about this
        const extractAddressComponents = (address) => {
            const addressStr = address || 'Main Street';

            // Very simple parsing - just split by space and take first word as number
            const parts = addressStr.split(' ');
            let streetNumber = '1';
            let streetName = addressStr;

            if (parts.length > 1 && /^\d+$/.test(parts[0])) {
                streetNumber = parts[0];
                streetName = parts.slice(1).join(' ');
            }

            // Ensure street name is not empty
            if (!streetName.trim()) {
                streetName = 'Main Street';
            }

            return {
                streetNumber: streetNumber.substring(0, 10),
                streetName: streetName.substring(0, 255)
            };
        };

        // SIMPLIFIED phone formatting
        const formatPhoneNumber = (phone, countryCode) => {
            const cleanPhone = phone.replace(/\D/g, '');

            // For OpenProvider, use very simple formatting
            // They often expect area_code to be just the country code without +
            const phoneConfigs = {
                'IN': { area_code: '91', country_code: '+91' },
                'US': { area_code: '1', country_code: '+1' },
                'GB': { area_code: '44', country_code: '+44' },
                'CA': { area_code: '1', country_code: '+1' },
                'AU': { area_code: '61', country_code: '+61' },
                'DE': { area_code: '49', country_code: '+49' },
                'FR': { area_code: '33', country_code: '+33' },
                'JP': { area_code: '81', country_code: '+81' },
                'CN': { area_code: '86', country_code: '+86' },
                'BR': { area_code: '55', country_code: '+55' }
            };

            const config = phoneConfigs[countryCode] || phoneConfigs['IN'];

            let subscriber_number = cleanPhone;

            // Remove country code if present
            if (subscriber_number.startsWith(config.area_code)) {
                subscriber_number = subscriber_number.substring(config.area_code.length);
            }

            // Take first 10 digits for subscriber number
            subscriber_number = subscriber_number.substring(0, 10);

            // Pad if too short
            if (subscriber_number.length < 7) {
                subscriber_number = subscriber_number.padEnd(7, '0');
            }

            return {
                area_code: config.area_code,
                country_code: config.country_code,
                subscriber_number: subscriber_number
            };
        };

        // Process the data
        const countryCode = getCountryCode(contactData.country);
        const { streetNumber, streetName } = extractAddressComponents(contactData.address1);
        const formattedPhone = formatPhoneNumber(contactData.phone, countryCode);
        const isCompany = contactData.company && contactData.company.trim() !== '';

        console.log('Processed data:', {
            countryCode,
            streetNumber,
            streetName,
            formattedPhone,
            isCompany
        });

        // MINIMAL payload - only required fields
        const customerPayload = {
            name: {
                first_name: contactData.firstName.substring(0, 255),
                last_name: contactData.lastName.substring(0, 255),
                full_name: `${contactData.firstName} ${contactData.lastName}`.substring(0, 255)
            },
            address: {
                street: streetName,
                number: streetNumber,
                zipcode: contactData.postalCode.substring(0, 16),
                city: contactData.city.substring(0, 255),
                state: (contactData.state || contactData.city).substring(0, 255),
                country: countryCode
            },
            phone: formattedPhone,
            email: contactData.email.substring(0, 255),
            company_name: (isCompany ? contactData.company : `${contactData.firstName} ${contactData.lastName}`).substring(0, 255),
            type: isCompany ? 'company' : 'individual',
            gender: contactData.gender === 'f' ? 'F' : 'M' // Only M or F for OpenProvider
        };

        // Remove initials if causing issues
        delete customerPayload.name.initials;

        console.log('Final payload to OpenProvider:', JSON.stringify(customerPayload, null, 2));

        // Make the API call with better error handling
        const response = await apiClient.post('/customers', customerPayload, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        console.log('OpenProvider response:', JSON.stringify(response.data, null, 2));

        if (response.data && response.data.code !== 0) {
            throw new Error(`OpenProvider error: ${response.data.desc} (code: ${response.data.code})`);
        }

        return {
            success: true,
            handle: response.data.data.handle,
            id: response.data.data.id,
            customer: response.data.data
        };

    } catch (error) {
        console.error('=== OPENPROVIDER CONTACT CREATION FAILED ===');
        console.error('Error details:', {
            message: error.message,
            responseData: error.response?.data,
            status: error.response?.status,
            requestPayload: error.config?.data
        });

        throw new Error(`Failed to create contact: ${error.response?.data?.desc || error.message}`);
    }
}

// Updated validation function
function validateContactData(contactData) {
    const required = ['firstName', 'lastName', 'email', 'phone', 'address1', 'city', 'postalCode', 'country'];
    const missing = required.filter(field => !contactData[field] || contactData[field].toString().trim() === '');

    if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Basic email validation
    if (!contactData.email.includes('@')) {
        throw new Error('Invalid email format');
    }

    // Basic phone validation
    const phoneDigits = contactData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 7) {
        throw new Error('Phone number too short');
    }
}

// Add the validation function
function validateContactData(contactData) {
    const required = ['firstName', 'lastName', 'email', 'phone', 'address1', 'city', 'postalCode', 'country'];
    const missing = required.filter(field => !contactData[field] || contactData[field].trim() === '');

    if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactData.email)) {
        throw new Error('Invalid email format');
    }

    // Phone validation - at least 7 digits after cleaning
    const phoneDigits = contactData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 7) {
        throw new Error('Phone number must contain at least 7 digits');
    }
}

async function getDomainInfo(domainName) {
    try {
        const token = await getAuthToken();
        const parts = domainName.split('.');
        const name = parts.shift();
        const extension = parts.join('.');

        const { data } = await apiClient.get(`/domains/${name}.${extension}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        return {
            success: true,
            domain: data.data
        };
    } catch (error) {
        console.error('Error fetching domain info:', error.response?.data || error.message);
        throw new Error(`Failed to fetch info for ${domainName}`);
    }
}

const updateDomainNameservers = async function (domainIdOrName, nameservers = []) {
    try {
        if (!domainIdOrName) throw new Error('domain id or name is required');
        if (!Array.isArray(nameservers) || nameservers.length === 0) throw new Error('At least one nameserver is required');

        const token = await getAuthToken();

        // Try to call the v1beta domain endpoint. Prefer the API base if it contains v1beta path
        const domainPath = `/domains/${encodeURIComponent(domainIdOrName)}`;

        // Fetch current domain info (this endpoint exists on the sandbox internal API)
        const getUrl = `${integrations.get('OPENPROVIDER_INTERNAL_URL') || openProviderApi()}${domainPath}`;
        console.log('Fetching domain details from OpenProvider internal API:', getUrl);

        const current = await axios.get(getUrl, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 30000
        });

        console.log('Current domain details:', JSON.stringify(current.data, null, 2));

        // Prepare update payload: many OpenProvider APIs accept name_servers as array of { name }
        const payload = {
            name_servers: nameservers.map(ns => ({ name: ns }))
        };

        const putUrl = getUrl; // same endpoint used for update
        console.log('Updating nameservers via:', putUrl, 'payload:', JSON.stringify(payload));

        const result = await axios.put(putUrl, payload, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            timeout: 30000
        });

        console.log('Update response:', JSON.stringify(result.data, null, 2));

        if (result.data && (result.data.code === 0 || result.status === 200)) {
            return { success: true, data: result.data };
        }

        // If provider returns non-zero code
        throw new Error(result.data?.desc || 'Failed to update nameservers');
    } catch (error) {
        console.error('updateDomainNameservers error:', error.response?.data || error.message);
        if (error.response?.data?.desc) throw new Error(error.response.data.desc);
        throw new Error(`Failed to update nameservers: ${error.message}`);
    }
}

// Transfer a domain using OpenProvider v1beta transfer endpoint
async function transferDomain(params = {}) {
    try {
        const token = await getAuthToken();

        const { domainName, authCode, nameservers = [], handles = {}, autorenew = 'default' } = params;

        if (!domainName || typeof domainName !== 'string') throw new Error('domainName is required');
        if (!authCode || typeof authCode !== 'string') throw new Error('authCode is required');

        const parts = domainName.split('.');
        if (parts.length < 2) throw new Error('Invalid domainName format');
        const name = parts.shift();
        const extension = parts.join('.');

        const payload = {
            owner_handle: handles.owner || handles.handle || undefined,
            tech_handle: handles.tech || handles.owner || handles.handle || undefined,
            admin_handle: handles.admin || handles.owner || handles.handle || undefined,
            autorenew: autorenew,
            auth_code: authCode,
            domain: {
                extension,
                name
            },
            name_servers: (nameservers || []).map(ns => ({ name: ns }))
        };

        // Remove undefined keys
        Object.keys(payload).forEach(k => {
            if (payload[k] === undefined) delete payload[k];
        });

        console.log('Transfer domain payload:', JSON.stringify(payload, null, 2));

        // Use v1beta transfer endpoint on the API base
        const { data } = await apiClient.post('/domains/transfer', payload, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000
        });

        console.log('Transfer response:', JSON.stringify(data, null, 2));

        if (data && data.code !== 0) {
            throw new Error(data.desc || 'Transfer failed');
        }

        return { success: true, data: data.data || data };
    } catch (error) {
        console.error('transferDomain error:', error.response?.data || error.message);
        if (error.response?.data?.desc) throw new Error(error.response.data.desc);
        throw new Error(`Failed to transfer domain: ${error.message}`);
    }
}

// Export all service functions
module.exports = {
    getAuthToken,
    getDomains,
    searchDomain,
    getDomainPrice,
    registerDomain,
    createContact,
    getDomainInfo,
    updateDomainNameservers,
    transferDomain
};