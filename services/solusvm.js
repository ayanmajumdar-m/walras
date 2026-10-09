/**
 * SolusVM 2 REST API client (Virtual Machine provisioning).
 *
 * Walras can use several SolusVM panels ("accounts", Admin → SolusVM
 * accounts, utils/solusAccounts.js). Each call is made for one account:
 * clientFor({ id, apiUrl, token }) returns that panel's client. The token is
 * an API token from the panel (Account → API Tokens), created by an admin,
 * sent as "Authorization: Bearer …".
 *
 * Servers are created under the token owner's default project; Walras keeps
 * which customer owns which server, and on which account, in `servers`.
 */

class SolusError extends Error {
    constructor(message, status, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

const apiBase = (apiUrl) => `${String(apiUrl).trim().replace(/\/+$/, '').replace(/\/api\/v1$/, '')}/api/v1`;

// Plans, locations and OS images change rarely; cache them per account for 5 minutes.
const catalogCache = new Map(); // `${accountId}:${what}` -> { value, until }

const clientFor = (account) => {
    if (!account?.apiUrl || !account?.token) throw new SolusError('This SolusVM account has no address or API token.', 503);
    const base = apiBase(account.apiUrl);

    const solus = async (path, { method = 'GET', json, timeoutMs = 20000 } = {}) => {
        let res;
        try {
            res = await fetch(`${base}${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${account.token}`,
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
            console.warn(`SolusVM (account ${account.id}) request failed:`, method, path.replace(/\d+/g, ':id'), res.status, String(text).slice(0, 300));
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

    const cached = async (what, fn) => {
        const key = `${account.id}:${what}`;
        const hit = catalogCache.get(key);
        if (hit && hit.until > Date.now()) return hit.value;
        const value = await fn();
        catalogCache.set(key, { value, until: Date.now() + 5 * 60 * 1000 });
        return value;
    };

    return {
        listPlans: () => cached('plans', async () =>
            (await listAll('/plans')).map((p) => ({ id: p.id, name: p.name }))),

        listLocations: () => cached('locations', async () =>
            (await listAll('/locations'))
                .filter((l) => l.is_visible !== false)
                .map((l) => ({ id: l.id, name: l.name, description: l.description || '' }))),

        // One entry per visible OS image *version*: that's the ID server creation takes.
        listOsVersions: () => cached('os', async () =>
            (await listAll('/os_images'))
                .filter((img) => img.is_visible !== false)
                .flatMap((img) => (img.versions || [])
                    .filter((v) => v.is_visible !== false)
                    .map((v) => ({ id: v.id, name: `${img.name} ${v.version}`.trim() })))),

        /** Creates a server; returns SolusVM's server object (status "processing"). */
        createServer: async ({ name, planId, locationId, osVersionId, password }) => {
            const res = await solus('/servers', {
                method: 'POST',
                json: { name, plan: planId, location: locationId, os: osVersionId, password },
                timeoutMs: 60000,
            });
            return res.data;
        },

        getServer: async (id) => {
            try {
                return (await solus(`/servers/${id}`, { timeoutMs: 8000 })).data;
            } catch (err) {
                if (err instanceof SolusError && err.status === 404) return null;
                throw err;
            }
        },

        // stop/restart are graceful (ACPI) unless force: a forced stop powers the
        // VM off even if its operating system ignores the shutdown request.
        serverAction: (id, action, { force = false } = {}) =>
            solus(`/servers/${id}/${action}`, { method: 'POST', json: action === 'start' ? undefined : { force } }),

        deleteServer: async (id) => {
            try {
                await solus(`/servers/${id}`, { method: 'DELETE' });
            } catch (err) {
                if (err instanceof SolusError && err.status === 404) return; // already gone
                throw err;
            }
        },
    };
};

/** Drops cached plans/locations/OS lists (all accounts, or one). */
const forgetCatalog = (accountId) => {
    for (const key of catalogCache.keys()) {
        if (accountId === undefined || key.startsWith(`${accountId}:`)) catalogCache.delete(key);
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

module.exports = { SolusError, clientFor, forgetCatalog, walrasStatus, primaryIp };
