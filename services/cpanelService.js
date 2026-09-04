const axios = require('axios');
const https = require('https');
const crypto = require('crypto');

class CpanelService {
    constructor() {
        this.httpsAgent = new https.Agent({
            rejectUnauthorized: process.env.WHM_REJECT_UNAUTHORIZED === 'true'
        });
    }

    /**
     * Get WHM API configuration
     */
    getConfig() {
        let host = process.env.WHM_HOST || process.env.CPANEL_HOST || '';
        if (host) {
            host = host.trim().replace(/\/+$/, '');
            if (!host.startsWith('http://') && !host.startsWith('https://')) {
                host = 'https://' + host;
            }
            // If port is not specified, default to 2087 (WHM SSL)
            try {
                const url = new URL(host);
                if (!url.port) {
                    url.port = '2087';
                    host = url.origin;
                }
            } catch (e) {
                // Ignore parse errors
            }
        }

        const username = process.env.WHM_USERNAME || 'root';
        const apiToken = process.env.WHM_API_TOKEN || '';
        const isPlaceholder = host.includes('your-cpanel-server.com') || host.includes('example.com');

        return {
            host,
            username,
            apiToken,
            isConfigured: Boolean(host && apiToken && !isPlaceholder),
            isPlaceholder
        };
    }

    /**
     * Map internal plan name ('Lite', 'Pro') to cPanel package name
     */
    getPackageForPlan(planName) {
        const normalized = (planName || '').trim().toLowerCase();
        if (normalized === 'lite') {
            return process.env.CPANEL_PACKAGE_LITE || 'Lite';
        }
        if (normalized === 'pro') {
            return process.env.CPANEL_PACKAGE_PRO || 'Pro';
        }
        return process.env.CPANEL_DEFAULT_PACKAGE || planName || 'Lite';
    }

    /**
     * Generate a valid cPanel username from domain name (max 16 chars, alphanumeric)
     */
    generateCpanelUsername(domain) {
        const clean = (domain || '')
            .toLowerCase()
            .replace(/^www\./, '')
            .split('.')[0]
            .replace(/[^a-z0-9]/g, '');

        const prefix = (clean.length >= 3 ? clean.substring(0, 8) : 'usr')
            .replace(/^[0-9]+/, 'u'); // Cannot start with a digit

        const randomSuffix = crypto.randomBytes(3).toString('hex').substring(0, 4);
        const username = (prefix + randomSuffix).substring(0, 16);
        return username;
    }

    /**
     * Generate secure random password
     */
    generateSecurePassword() {
        const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const lower = 'abcdefghjkmnpqrstuvwxyz';
        const numbers = '23456789';
        const special = '@#$%!&*';
        const all = upper + lower + numbers + special;

        let pwd = '';
        pwd += upper[Math.floor(Math.random() * upper.length)];
        pwd += lower[Math.floor(Math.random() * lower.length)];
        pwd += numbers[Math.floor(Math.random() * numbers.length)];
        pwd += special[Math.floor(Math.random() * special.length)];

        for (let i = 0; i < 12; i++) {
            pwd += all[Math.floor(Math.random() * all.length)];
        }

        // Shuffle characters
        return pwd.split('').sort(() => 0.5 - Math.random()).join('');
    }

    /**
     * Execute a WHM API 1 function call
     */
    async callWhmApi(functionName, params = {}) {
        const config = this.getConfig();

        if (config.isPlaceholder) {
            return {
                success: false,
                reason: "WHM_HOST is still set to placeholder 'your-cpanel-server.com'. Please replace it with your actual WHM server IP or domain in .env"
            };
        }

        if (!config.isConfigured) {
            console.warn(`[cPanel/WHM] Simulated API call '${functionName}': WHM_API_TOKEN or WHM_HOST is not configured.`);
            return {
                simulated: true,
                success: true,
                metadata: { result: 1, reason: `Simulated call to ${functionName}` }
            };
        }

        const endpoint = `${config.host}/json-api/${functionName}`;
        const queryParams = {
            'api.version': 1,
            ...params
        };

        try {
            const response = await axios.get(endpoint, {
                params: queryParams,
                headers: {
                    Authorization: `whm ${config.username}:${config.apiToken}`
                },
                httpsAgent: this.httpsAgent,
                timeout: 30000
            });

            const data = response.data;
            const result = data?.metadata?.result;
            const isSuccess = result === 1 || result === '1';

            if (!isSuccess) {
                const reason = data?.metadata?.reason || 'Unknown WHM error';
                console.error(`[cPanel/WHM] API call '${functionName}' failed:`, reason);
                return {
                    success: false,
                    reason,
                    raw: data
                };
            }

            return {
                success: true,
                data: data.data || data,
                metadata: data.metadata,
                raw: data
            };
        } catch (error) {
            console.error(`[cPanel/WHM] Network error in API call '${functionName}':`, error.message);
            return {
                success: false,
                reason: error.response?.data?.metadata?.reason || error.message,
                error
            };
        }
    }

    /**
     * List all packages available on this WHM server
     */
    async listPackages() {
        const result = await this.callWhmApi('listpkgs');
        if (!result || !result.success) return [];
        const raw = result.data || result.raw?.data || {};
        const pkgs = raw.pkg || raw.package || [];
        if (Array.isArray(pkgs)) {
            return pkgs.map(p => (typeof p === 'string' ? p : p.name)).filter(Boolean);
        }
        return [];
    }

    /**
     * Create cPanel Account
     * @param {Object} options { username, domain, plan, password, email }
     */
    async createAccount({ username, domain, plan, password, email }) {
        let cpanelPackage = this.getPackageForPlan(plan);
        const config = this.getConfig();

        // Auto-detect package from WHM server if exact match fails
        if (config.isConfigured) {
            try {
                const availablePkgs = await this.listPackages();
                console.log(`[cPanel/WHM] Available packages on WHM server:`, availablePkgs);
                if (availablePkgs.length > 0 && !availablePkgs.includes(cpanelPackage)) {
                    // Look for username prefixed e.g. webcloud_Lite, or case-insensitive match
                    const userPrefixed = `${config.username}_${cpanelPackage}`.toLowerCase();
                    const match = availablePkgs.find(p => {
                        const pLower = p.toLowerCase();
                        return (
                            pLower === cpanelPackage.toLowerCase() ||
                            pLower === userPrefixed ||
                            pLower.includes(plan.toLowerCase())
                        );
                    });
                    if (match) {
                        console.log(`[cPanel/WHM] Resolved package '${cpanelPackage}' to server package '${match}'`);
                        cpanelPackage = match;
                    }
                }
            } catch (err) {
                console.warn('[cPanel/WHM] Could not auto-detect packages:', err.message);
            }
        }

        console.log(`[cPanel/WHM] Creating cPanel account for ${domain} (user: ${username}, package: ${cpanelPackage})...`);

        const result = await this.callWhmApi('createacct', {
            username,
            domain,
            plan: cpanelPackage,
            password,
            contactemail: email || ''
        });

        return {
            ...result,
            username,
            domain,
            package: cpanelPackage
        };
    }

    /**
     * Suspend cPanel Account
     * @param {string} username
     * @param {string} reason
     */
    async suspendAccount(username, reason = 'Subscription expired') {
        console.log(`[cPanel/WHM] Suspending cPanel account ${username} (reason: ${reason})...`);
        return await this.callWhmApi('suspendacct', {
            user: username,
            reason
        });
    }

    /**
     * Unsuspend cPanel Account
     * @param {string} username
     */
    async unsuspendAccount(username) {
        console.log(`[cPanel/WHM] Unsuspending cPanel account ${username}...`);
        return await this.callWhmApi('unsuspendacct', {
            user: username
        });
    }

    /**
     * Terminate / Remove cPanel Account
     * @param {string} username
     */
    async removeAccount(username) {
        console.log(`[cPanel/WHM] Removing cPanel account ${username}...`);
        return await this.callWhmApi('removeacct', {
            user: username
        });
    }

    /**
     * Create Single Sign-On session for user
     * @param {string} username
     */
    async createUserSession(username, domain = '') {
        const config = this.getConfig();

        if (!config.isConfigured) {
            const fallbackHost = config.host ? config.host.replace(':2087', ':2083') : `https://${domain || 'localhost'}:2083`;
            return {
                success: true,
                simulated: true,
                url: fallbackHost,
                message: 'Direct cPanel login URL'
            };
        }

        const result = await this.callWhmApi('create_user_session', {
            user: username,
            service: 'cpaneld'
        });

        if (result.success && result.data?.url) {
            return {
                success: true,
                url: result.data.url
            };
        }

        // Fallback to direct cPanel URL on port 2083
        const directUrl = config.host
            ? config.host.replace(':2087', ':2083')
            : `https://${domain || 'localhost'}:2083`;

        return {
            success: false,
            url: directUrl,
            reason: result.reason || 'Failed to create session token'
        };
    }
}

module.exports = new CpanelService();
