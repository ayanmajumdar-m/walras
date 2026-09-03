const crypto = require('crypto');

/**
 * CCAvenue Payment Gateway Service
 * Handles AES-128-CBC encryption and decryption required by CCAvenue API.
 */
class CcavenueService {
    constructor() {
        this.iv = Buffer.from([
            0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
            0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f
        ]);
    }

    /**
     * Get CCAvenue environment configuration
     */
    getConfig() {
        const merchantId = process.env.CCAVENUE_MERCHANT_ID || '';
        const accessCode = process.env.CCAVENUE_ACCESS_CODE || '';
        const workingKey = process.env.CCAVENUE_WORKING_KEY || '';
        const isTest = (process.env.CCAVENUE_ENVIRONMENT || 'production').toLowerCase() === 'test';
        
        const actionUrl = isTest
            ? 'https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction'
            : 'https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction';

        const clientUrl = (process.env.CLIENT_URL || 'https://buttr.cloud').replace(/\/+$/, '');

        return {
            merchantId,
            accessCode,
            workingKey,
            actionUrl,
            clientUrl,
            isConfigured: Boolean(merchantId && accessCode && workingKey)
        };
    }

    /**
     * Encrypt plain text using CCAvenue AES-128-CBC specifications
     * @param {string} plainText
     * @param {string} workingKey
     * @returns {string} Hex encoded cipher text
     */
    encrypt(plainText, workingKey) {
        if (!workingKey) {
            throw new Error('CCAvenue working key is required for encryption');
        }
        const m = crypto.createHash('md5');
        m.update(workingKey);
        const key = m.digest();

        const cipher = crypto.createCipheriv('aes-128-cbc', key, this.iv);
        let encoded = cipher.update(plainText, 'utf8', 'hex');
        encoded += cipher.final('hex');
        return encoded;
    }

    /**
     * Decrypt encrypted hex response from CCAvenue
     * @param {string} encText
     * @param {string} workingKey
     * @returns {string} Decrypted plain text
     */
    decrypt(encText, workingKey) {
        if (!workingKey) {
            throw new Error('CCAvenue working key is required for decryption');
        }
        const m = crypto.createHash('md5');
        m.update(workingKey);
        const key = m.digest();

        const decipher = crypto.createDecipheriv('aes-128-cbc', key, this.iv);
        let decoded = decipher.update(encText, 'hex', 'utf8');
        decoded += decipher.final('utf8');
        return decoded;
    }

    /**
     * Convert an object of parameters into CCAvenue query string format
     * @param {Object} params
     * @returns {string}
     */
    stringifyParams(params) {
        return Object.entries(params)
            .filter(([_, v]) => v !== undefined && v !== null)
            .map(([k, v]) => `${k}=${encodeURIComponent(String(v).trim())}`)
            .join('&');
    }

    /**
     * Parse decrypted response string into a clean key-value object
     * @param {string} decryptedText
     * @returns {Object}
     */
    parseResponse(decryptedText) {
        const result = {};
        if (!decryptedText) return result;

        const pairs = decryptedText.split('&');
        for (const pair of pairs) {
            const idx = pair.indexOf('=');
            if (idx > -1) {
                const key = pair.substring(0, idx).trim();
                const value = decodeURIComponent(pair.substring(idx + 1).replace(/\+/g, ' ')).trim();
                result[key] = value;
            }
        }
        return result;
    }
}

module.exports = new CcavenueService();
