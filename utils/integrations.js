/**
 * Integration settings: the keys, passwords and addresses for email,
 * Zendesk, payments and domains, read from the server environment.
 *
 * (The Admin → Integrations page was removed; a value saved in app_settings
 * under integration.NAME would still win over the environment, but nothing
 * writes those any more.) Secrets are stored
 * encrypted (utils/secrets.js) and never sent back to the browser, only their
 * last four characters.
 *
 * Reads are synchronous (get('SMTP_HOST')) from an in-memory copy loaded at
 * boot, refreshed every minute and right after an admin saves. Services that
 * build a client once (mail, Razorpay) subscribe with onChange to rebuild it.
 *
 * Server settings that must exist before the database can even be reached
 * (DATABASE_URL, JWT_SECRET, PORT, NODE_ENV) stay environment-only.
 */
const appSettings = require('./appSettings');
const { encryptSecret, decryptSecret, last4 } = require('./secrets');

const GROUPS = [
    {
        id: 'site', label: 'Website',
        fields: [
            { name: 'CLIENT_URL', label: 'Site address', hint: 'Used in links in emails, payments and support notes, e.g. https://www.walras.net' },
        ],
    },
    {
        id: 'email', label: 'Email (SMTP)', desc: 'Outgoing email through Brevo. The sender name and address are set in Settings.',
        fields: [
            { name: 'SMTP_HOST', label: 'SMTP host', placeholder: 'smtp-relay.brevo.com' },
            { name: 'SMTP_PORT', label: 'SMTP port', placeholder: '587' },
            { name: 'SMTP_USER', label: 'SMTP login' },
            { name: 'SMTP_PASS', label: 'SMTP key', secret: true },
        ],
    },
    {
        id: 'zendesk', label: 'Zendesk (support)', desc: 'An OAuth client from Zendesk Admin Center → Apps and integrations → APIs → OAuth clients.',
        fields: [
            { name: 'ZENDESK_SUBDOMAIN', label: 'Subdomain', placeholder: 'vestige-88067' },
            { name: 'ZENDESK_CLIENT_ID', label: 'OAuth client identifier' },
            { name: 'ZENDESK_CLIENT_SECRET', label: 'OAuth client secret', secret: true },
            { name: 'ZENDESK_BRAND_ID', label: 'Brand ID', hint: 'Optional. Only Walras tickets are shown when set.' },
        ],
    },
    {
        id: 'ccavenue', label: 'CCAvenue (payments)',
        fields: [
            { name: 'CCAVENUE_MERCHANT_ID', label: 'Merchant ID' },
            { name: 'CCAVENUE_ACCESS_CODE', label: 'Access code', secret: true },
            { name: 'CCAVENUE_WORKING_KEY', label: 'Working key', secret: true },
            { name: 'CCAVENUE_ENVIRONMENT', label: 'Environment', options: ['production', 'test'] },
        ],
    },
    {
        id: 'razorpay', label: 'Razorpay (payments)',
        fields: [
            { name: 'RAZORPAY_KEY_ID', label: 'Key ID' },
            { name: 'RAZORPAY_KEY_SECRET', label: 'Key secret', secret: true },
        ],
    },
    {
        id: 'openprovider', label: 'OpenProvider (domains)',
        fields: [
            { name: 'OPENPROVIDER_API', label: 'API address', placeholder: 'https://api.openprovider.eu/v1beta' },
            { name: 'OPENPROVIDER_USERNAME', label: 'Username' },
            { name: 'OPENPROVIDER_PASSWORD', label: 'Password', secret: true },
            { name: 'OPENPROVIDER_INTERNAL_URL', label: 'Internal API address', hint: 'Optional.' },
        ],
    },
    {
        id: 'whois', label: 'WHOIS lookups',
        fields: [{ name: 'WHOIS_API_KEY', label: 'API key', secret: true }],
    },
];

const FIELDS = Object.fromEntries(GROUPS.flatMap((g) => g.fields.map((f) => [f.name, { ...f, group: g.id }])));
const keyFor = (name) => `integration.${name}`;

let values = {}; // name -> plain value saved in admin
const listeners = new Set();

/** Loads saved values. Never throws: on failure the previous values (or env) stay in use. */
const refresh = async () => {
    try {
        const all = await appSettings.getAll();
        const next = {};
        for (const name of Object.keys(FIELDS)) {
            const raw = all[keyFor(name)];
            if (raw === undefined || raw === null || raw === '') continue;
            try {
                next[name] = FIELDS[name].secret ? decryptSecret(raw) : raw;
            } catch (err) {
                console.error(`Integration setting ${name} can't be read (${err.message}); using the server environment instead.`);
            }
        }
        const changed = JSON.stringify(next) !== JSON.stringify(values);
        values = next;
        if (changed) listeners.forEach((fn) => { try { fn(); } catch (e) { console.error('Integration change handler failed:', e.message); } });
    } catch (err) {
        console.error('Integration settings unavailable:', err.message);
    }
};

/** A setting: saved in admin, else the environment variable, else undefined. */
const get = (name) => (values[name] !== undefined ? values[name] : process.env[name]);

const onChange = (fn) => { listeners.add(fn); };

let timer = null;
/** Called once at boot. */
const start = () => {
    if (timer) return;
    refresh();
    timer = setInterval(refresh, 60 * 1000);
    timer.unref?.();
};

/** For Admin → Integrations: what each field is set to and where it comes from. */
const adminView = () => GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    desc: g.desc || '',
    fields: g.fields.map((f) => {
        const saved = values[f.name] !== undefined;
        const env = process.env[f.name] !== undefined && process.env[f.name] !== '';
        const current = get(f.name);
        return {
            name: f.name,
            label: f.label,
            hint: f.hint || '',
            placeholder: f.placeholder || '',
            options: f.options || null,
            secret: Boolean(f.secret),
            source: saved ? 'admin' : env ? 'env' : 'unset',
            value: f.secret ? null : current ?? '',
            last4: f.secret && current ? last4(current) : null,
        };
    }),
}));

/**
 * Saves values: { NAME: 'new value' | null }. null clears the admin value
 * (back to the environment). An empty string for a secret keeps it as is.
 * Returns the names that changed.
 */
const save = async (input) => {
    const set = {};
    const clear = [];
    for (const [name, raw] of Object.entries(input || {})) {
        const f = FIELDS[name];
        if (!f) continue;
        if (raw === null) { clear.push(keyFor(name)); continue; }
        const value = String(raw).trim();
        if (value === '') {
            if (f.secret) continue; // keep the saved secret
            clear.push(keyFor(name));
            continue;
        }
        if (value.length > 2000) throw new Error(`${f.label} is too long.`);
        if (f.options && !f.options.includes(value)) throw new Error(`${f.label} must be one of: ${f.options.join(', ')}.`);
        set[keyFor(name)] = f.secret ? encryptSecret(value) : value;
    }
    if (Object.keys(set).length) await appSettings.setMany(set);
    if (clear.length) await appSettings.removeMany(clear);
    await refresh();
    return [...Object.keys(set), ...clear].map((k) => k.replace(/^integration\./, ''));
};

module.exports = { GROUPS, FIELDS, get, onChange, refresh, start, adminView, save };
