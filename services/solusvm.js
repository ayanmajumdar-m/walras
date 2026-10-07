/**
 * SolusVM 2 REST API client (Virtual Machine provisioning).
 *
 * SOLUSVM_URL       — the panel address, e.g. https://cloud.example.com
 * SOLUSVM_API_TOKEN — an API token from the panel (Account → API Tokens),
 *                     created by an admin. Sent as "Authorization: Bearer …".
 *
 * Servers are created under the token owner's default project; Walras keeps
 * which customer owns which server in its own `servers` table.
 */

class SolusError extends Error {
    constructor(message, status, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

const solusConfigured = () => Boolean(process.env.SOLUSVM_URL?.trim() && process.env.SOLUSVM_API_TOKEN?.trim());

const apiBase = () => `${process.env.SOLUSVM_URL.trim().replace(/\/+$/, '').replace(/\/api\/v1$/, '')}/api/v1`;

const solus = async (path, { method = 'GET', json, timeoutMs = 20000 } = {}) => {
    if (!solusConfigured()) throw new SolusError('SolusVM is not configured.', 503);
    let res;
    try {
        res = await fetch(`${apiBase()}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${process.env.SOLUSVM_API_TOKEN.trim()}`,
                Accept: 'application/json',
                ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
            },
            body: json !== undefined ? JSON.stringify(json) : undefined,
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (err) {
        throw new SolusError(`SolusVM unreachable: ${err.message}`, 502);
    }
    const text = await res.text();
    let body = null;
    if (text) {
        try { body = JSON.parse(text); } catch { body = text; }
    }
    if (!res.ok) {
        console.warn('SolusVM request failed:', method, path.replace(/\d+/g, ':id'), res.status, String(text).slice(0, 300));
        throw new SolusError(body?.message || `SolusVM returned ${res.status}`, res.status, body);
    }
    return body;
};

// Every page of a list endpoint (50 items per page by default).
const listAll = async (path) => {
    const items = [];
    for (let page = 1; page <= 20; page++) {
        const res = await solus(`${path}${path.includes('?') ? '&' : '?'}page=${page}`);
        items.push(...(res?.data || []));
        if (!res?.meta || res.meta.current_page >= res.meta.last_page) break;
    }
    return items;
};

// Plans, locations and OS images change rarely; cache them for 5 minutes.
const cache = new Map();
const cached = async (key, fn) => {
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.value;
    const value = await fn();
    cache.set(key, { value, until: Date.now() + 5 * 60 * 1000 });
    return value;
};
const forgetCatalog = () => cache.clear();

const listPlans = () => cached('plans', async () =>
    (await listAll('/plans')).map((p) => ({ id: p.id, name: p.name })));

const listLocations = () => cached('locations', async () =>
    (await listAll('/locations'))
        .filter((l) => l.is_visible !== false)
        .map((l) => ({ id: l.id, name: l.name, description: l.description || '' })));

// One entry per visible OS image *version*: that's the ID server creation takes.
const listOsVersions = () => cached('os', async () =>
    (await listAll('/os_images'))
        .filter((img) => img.is_visible !== false)
        .flatMap((img) => (img.versions || [])
            .filter((v) => v.is_visible !== false)
            .map((v) => ({ id: v.id, name: `${img.name} ${v.version}`.trim() }))));

/** Creates a server; returns SolusVM's server object (status "processing"). */
const createServer = async ({ name, planId, locationId, osVersionId, password }) => {
    const res = await solus('/servers', {
        method: 'POST',
        json: { name, plan: planId, location: locationId, os: osVersionId, password },
        timeoutMs: 60000,
    });
    return res.data;
};

const getServer = async (id) => {
    try {
        return (await solus(`/servers/${id}`, { timeoutMs: 8000 })).data;
    } catch (err) {
        if (err instanceof SolusError && err.status === 404) return null;
        throw err;
    }
};

const serverAction = (id, action) =>
    solus(`/servers/${id}/${action}`, { method: 'POST', json: action === 'start' ? undefined : { force: false } });

const deleteServer = async (id) => {
    try {
        await solus(`/servers/${id}`, { method: 'DELETE' });
    } catch (err) {
        if (err instanceof SolusError && err.status === 404) return; // already gone
        throw err;
    }
};

// SolusVM's server state, in the statuses the `servers` table allows.
const walrasStatus = (vm) => {
    if (!vm) return 'failed';
    if (vm.is_processing || vm.status === 'processing') return 'deploying';
    if (vm.status === 'started') return 'active';
    if (vm.status === 'stopped') return 'stopped';
    return 'failed'; // 'not exist' / 'unavailable'
};

const primaryIp = (vm) => {
    const v4 = vm?.ip_addresses?.ipv4 || [];
    return (v4.find((ip) => ip.is_primary) || v4[0])?.ip || null;
};

module.exports = {
    SolusError,
    solusConfigured,
    listPlans,
    listLocations,
    listOsVersions,
    forgetCatalog,
    createServer,
    getServer,
    serverAction,
    deleteServer,
    walrasStatus,
    primaryIp,
};
