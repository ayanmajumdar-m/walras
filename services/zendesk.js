/**
 * Support tickets live in Zendesk (same approach as Fantom). Customers use the
 * Support page in the console; the server talks to the Zendesk API with an
 * OAuth client (client-credentials grant: ZENDESK_CLIENT_ID +
 * ZENDESK_CLIENT_SECRET) and acts for the customer's Zendesk end-user, linked
 * to our user id through external_id. API tokens are not used: Zendesk retires
 * them on 30 April 2027.
 */
const connection = require('../config/db');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const zendeskConfigured = () => Boolean(
    process.env.ZENDESK_SUBDOMAIN?.trim() && process.env.ZENDESK_CLIENT_ID?.trim() && process.env.ZENDESK_CLIENT_SECRET?.trim()
);

// The Zendesk brand Walras tickets belong to. Unset = the default brand.
const zendeskBrandId = () => {
    const raw = process.env.ZENDESK_BRAND_ID?.trim();
    return raw && /^\d+$/.test(raw) ? Number(raw) : null;
};

class ZendeskError extends Error {
    constructor(message, status, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

// Accepts "walras", "walras.zendesk.com" or a full URL.
const baseUrl = () => {
    const raw = process.env.ZENDESK_SUBDOMAIN.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    return `https://${raw.includes('.') ? raw : `${raw}.zendesk.com`}`;
};

let cachedToken = null;

/** OAuth access token (client-credentials), reused until 5 minutes before expiry. */
const accessToken = async () => {
    if (cachedToken && cachedToken.expiresAt - Date.now() > 5 * 60 * 1000) return cachedToken.token;
    const res = await fetch(`${baseUrl()}/oauth/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: process.env.ZENDESK_CLIENT_ID.trim(),
            client_secret: process.env.ZENDESK_CLIENT_SECRET.trim(),
            scope: 'read write',
            expires_in: String(2 * 60 * 60),
        }),
        signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.access_token) {
        console.error('Zendesk OAuth failed:', res.status, body?.error || '');
        throw new ZendeskError(`Zendesk sign-in failed (${res.status})`, res.status, body);
    }
    cachedToken = { token: body.access_token, expiresAt: Date.now() + (body.expires_in || 1800) * 1000 };
    return body.access_token;
};

const send = (path, init, token) => fetch(`${baseUrl()}${path}`, {
    method: init.method || 'GET',
    headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(init.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(init.body ? { 'Content-Type': init.contentType || 'application/octet-stream' } : {}),
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body ? new Uint8Array(init.body) : undefined,
    signal: AbortSignal.timeout(init.timeoutMs || 20000),
});

const zd = async (path, init = {}) => {
    if (!zendeskConfigured()) throw new ZendeskError("Support isn't set up yet.", 503);
    let res = await send(path, init, await accessToken());
    if (res.status === 401) {
        // Token revoked or expired early: get a fresh one and try once more.
        cachedToken = null;
        res = await send(path, init, await accessToken());
    }
    const text = await res.text();
    let body = null;
    if (text) {
        try { body = JSON.parse(text); } catch { body = text; }
    }
    if (!res.ok) {
        console.warn('Zendesk request failed:', path.replace(/\d{3,}/g, ':id'), res.status, String(text).slice(0, 300));
        throw new ZendeskError(`Zendesk returned ${res.status}`, res.status, body);
    }
    return body;
};

// ── Customers ──────────────────────────────────────────────────────────────

/**
 * The customer's Zendesk user id. Found by our user id (external_id), then by
 * email; a new end-user is created only when neither exists. Existing Zendesk
 * users are never updated: an email can belong to a staff member, and
 * "create or update" as end-user once demoted an admin that way at Fantom.
 */
const zendeskUserFor = async (userId) => {
    const [c] = await q('SELECT id, name, email, zendesk_user_id FROM users WHERE id = ?', [userId]);
    if (!c) throw new Error('Account not found.');
    if (c.zendesk_user_id) return Number(c.zendesk_user_id);

    const externalId = `walras-${userId}`;
    const link = async (u, how) => {
        await q('UPDATE users SET zendesk_user_id = ? WHERE id = ?', [u.id, userId]);
        console.log(`Zendesk user linked: user ${userId} → ${u.id} (${how})`);
        return u.id;
    };

    const byExternal = await zd(`/api/v2/users/search.json?external_id=${encodeURIComponent(externalId)}`);
    if (byExternal.users?.[0]) return link(byExternal.users[0], 'external_id');

    if (c.email) {
        const byEmail = await zd(`/api/v2/users/search.json?query=${encodeURIComponent(`email:${c.email}`)}`);
        if (byEmail.users?.[0]) return link(byEmail.users[0], 'email');
    }

    const created = await zd('/api/v2/users.json', {
        method: 'POST',
        json: { user: { name: c.name || c.email || 'Walras Cloud customer', external_id: externalId, ...(c.email ? { email: c.email, verified: true } : {}) } },
    });
    return link(created.user, 'created');
};

// ── Tickets ────────────────────────────────────────────────────────────────

const uploadToZendesk = async ({ fileName, mimeType, data }) => {
    const res = await zd(`/api/v2/uploads.json?filename=${encodeURIComponent(fileName)}`, { method: 'POST', body: data, contentType: mimeType });
    return res.upload.token;
};

// Agent groups: what customers pick as a "department" (utils/supportDepartments.js).
// Cached for 10 minutes; groups change rarely.
let groupsCache = null;
const listZendeskGroups = async ({ fresh = false } = {}) => {
    if (!fresh && groupsCache && groupsCache.until > Date.now()) return groupsCache.groups;
    const groups = [];
    let path = '/api/v2/groups.json?per_page=100';
    for (let page = 0; path && page < 10; page++) {
        const res = await zd(path, { timeoutMs: 8000 });
        groups.push(...(res.groups || []).filter((g) => !g.deleted).map((g) => ({ id: g.id, name: g.name })));
        path = res.next_page ? res.next_page.replace(baseUrl(), '') : null;
    }
    groupsCache = { groups, until: Date.now() + 10 * 60 * 1000 };
    return groups;
};

const createZendeskTicket = async ({ requesterId, subject, body, uploads, tags, groupId }) => {
    const brand = zendeskBrandId();
    const res = await zd('/api/v2/tickets.json', {
        method: 'POST',
        json: {
            ticket: {
                subject,
                requester_id: requesterId,
                ...(brand ? { brand_id: brand } : {}),
                ...(groupId ? { group_id: groupId } : {}),
                tags,
                comment: { body, author_id: requesterId, public: true, uploads },
            },
        },
    });
    return res.ticket;
};

// Internal note: only agents see it.
const addZendeskNote = (ticketId, body) =>
    zd(`/api/v2/tickets/${ticketId}.json`, { method: 'PUT', json: { ticket: { comment: { body, public: false } } } });

const addZendeskReply = (ticketId, authorId, body, uploads) =>
    zd(`/api/v2/tickets/${ticketId}.json`, {
        method: 'PUT',
        json: { ticket: { status: 'open', comment: { body, author_id: authorId, public: true, uploads } } },
    });

const listZendeskTicketsFor = async (zendeskUserId) => {
    const res = await zd(`/api/v2/users/${zendeskUserId}/tickets/requested.json?sort_by=updated_at&sort_order=desc&per_page=100`);
    const brand = zendeskBrandId();
    // The same person can have tickets under other brands; only show Walras's.
    return brand ? res.tickets.filter((t) => t.brand_id === brand) : res.tickets;
};

const getZendeskTicket = async (ticketId) => {
    try {
        const [{ ticket }, { comments }] = await Promise.all([
            zd(`/api/v2/tickets/${ticketId}.json`),
            zd(`/api/v2/tickets/${ticketId}/comments.json?per_page=100`),
        ]);
        return { ticket, comments };
    } catch (err) {
        if (err instanceof ZendeskError && err.status === 404) return null;
        throw err;
    }
};

/**
 * Attachment bytes. Zendesk attachment links need a Zendesk login, so the
 * server fetches them with its own token. Only our Zendesk domain is followed.
 */
const downloadZendeskAttachment = async (contentUrl, maxBytes) => {
    const url = new URL(contentUrl);
    if (url.origin !== new URL(baseUrl()).origin) throw new ZendeskError('Unexpected attachment address.', 400);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}` }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new ZendeskError(`Zendesk returned ${res.status}`, res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new ZendeskError('Attachment is too large.', 413);
    return buf;
};

// Where agents work the tickets (linked from the admin dashboard).
const zendeskAgentUrl = () => (zendeskConfigured() ? `${baseUrl()}/agent` : null);

// Unsolved tickets across Zendesk (admin dashboard).
const countOpenZendeskTickets = async () => {
    if (!zendeskConfigured()) return null;
    const brand = zendeskBrandId();
    const query = `type:ticket status<solved${brand ? ` brand:${brand}` : ''}`;
    const res = await zd(`/api/v2/search/count.json?query=${encodeURIComponent(query)}`, { timeoutMs: 4000 });
    return res.count;
};

module.exports = {
    ZendeskError,
    zendeskConfigured,
    zendeskBrandId,
    zendeskUserFor,
    uploadToZendesk,
    createZendeskTicket,
    addZendeskNote,
    addZendeskReply,
    listZendeskTicketsFor,
    getZendeskTicket,
    downloadZendeskAttachment,
    countOpenZendeskTickets,
    zendeskAgentUrl,
    listZendeskGroups,
};
