/**
 * Encryption for secrets saved in the admin panel (SolusVM API tokens,
 * integration passwords and keys). AES-256-GCM, as Fantom does it.
 *
 * The key comes from SETTINGS_ENCRYPTION_KEY (32 bytes, base64 or 64 hex
 * characters) if set, otherwise it is derived from JWT_SECRET, so no extra
 * server setting is needed. Changing whichever one is used makes the saved
 * secrets unreadable: they then have to be entered again in admin.
 */
const crypto = require('crypto');

const encryptionKey = () => {
    const raw = process.env.SETTINGS_ENCRYPTION_KEY?.trim();
    if (raw) {
        const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
        if (key.length !== 32) throw new Error('SETTINGS_ENCRYPTION_KEY must be 32 bytes (base64 or 64 hex characters).');
        return key;
    }
    const jwt = process.env.JWT_SECRET?.trim();
    if (!jwt) throw new Error('JWT_SECRET (or SETTINGS_ENCRYPTION_KEY) must be set to store secrets.');
    return crypto.createHash('sha256').update(`walras-settings:${jwt}`).digest();
};

const encryptSecret = (plain) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const body = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    return `v1:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')}`;
};

const decryptSecret = (stored) => {
    if (!String(stored).startsWith('v1:')) throw new Error('Unrecognised encrypted secret format.');
    const raw = Buffer.from(String(stored).slice(3), 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
};

const last4 = (s) => String(s || '').slice(-4);

module.exports = { encryptSecret, decryptSecret, last4 };
