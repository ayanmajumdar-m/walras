/**
 * Teams: an account owner invites up to TEAM_LIMIT people by email and gives
 * each a role and the areas they may use in the owner's account. A member
 * keeps their own login; in the console they switch to "work in <owner>'s
 * account", and the client then sends X-Walras-Account: <ownerId>.
 *
 * Role (how much):
 *   write — use their areas but delete nothing: every DELETE is refused.
 *   admin — everything in their areas, including deleting, and managing the
 *           owner's team.
 * Areas (which parts): servers, billing, support.
 *
 * authenticateToken (utils/auth.middleware.js) checks the header: the member
 * must be active in that team, and the request must fall in one of their
 * areas (ACCESS_ROUTES). Anything not listed is refused while working in
 * someone else's account: profile, password, own invitations and so on
 * always act on the signed-in person.
 *
 * Stored in team_members.permissions as "role:area,area", e.g.
 * "write:servers,support". Older values are read leniently (parseAccess).
 */
const connection = require('../config/db');

const TEAM_LIMIT = 5;

const ROLES = {
    write: { label: 'Write', desc: "Can use the areas below but can't delete anything." },
    admin: { label: 'Admin', desc: 'Can do everything in the areas below, including deleting, and manage the team.' },
};
const ROLE_KEYS = Object.keys(ROLES);

const AREAS = {
    servers: { label: 'Servers', desc: 'Virtual Machines, Managed Databases, App Platform and domains. New ones are paid from the account balance.' },
    billing: { label: 'Billing', desc: 'Account balance, adding funds, promo codes and usage.' },
    support: { label: 'Support', desc: 'Support tickets for the account.' },
};
const AREA_KEYS = Object.keys(AREAS);

// Request path prefix → area needed in someone else's account ('team' = admin
// only). Default: refused.
const ACCESS_ROUTES = [
    ['/api/servers', 'servers'],
    ['/api/databases', 'servers'],
    ['/api/apps', 'servers'],
    ['/api/users/domains/purchased', 'servers'],
    ['/api/users/openprovider/', 'servers'],
    ['/api/wallet', 'billing'],
    ['/api/users/wallet/billing-history', 'billing'],
    ['/api/payment/razorpay/topup', 'billing'],
    ['/api/payment/razorpay/verify', 'billing'],
    ['/api/invoices', 'billing'],
    ['/api/support', 'support'],
    ['/api/team/members', 'team'],
];

const accessFor = (url) => {
    const path = String(url || '').split('?')[0];
    const hit = ACCESS_ROUTES.find(([prefix]) => path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`));
    return hit ? hit[1] : null;
};

/**
 * { role, areas } from the stored value. Accepts "role:areas"; a bare role
 * ("write"/"admin", which then means every area); or a bare area list from
 * before roles existed (read as write).
 */
const parseAccess = (raw) => {
    const s = String(raw || '');
    const [head, tail] = s.includes(':') ? s.split(':') : [s, null];
    if (ROLE_KEYS.includes(head)) {
        const areas = tail === null ? [...AREA_KEYS] : tail.split(',').filter((a) => AREA_KEYS.includes(a));
        return { role: head, areas };
    }
    return { role: 'write', areas: s.split(',').filter((a) => AREA_KEYS.includes(a)) };
};

/** Validated { role, areas } from a request, or null. */
const cleanAccess = (role, areas) => {
    if (!ROLE_KEYS.includes(role)) return null;
    const list = AREA_KEYS.filter((a) => Array.isArray(areas) && areas.includes(a));
    return list.length ? { role, areas: list } : null;
};

const formatAccess = ({ role, areas }) => `${role}:${areas.join(',')}`;

/** The member's { role, areas } in the owner's account, or null if not an active member. */
const membership = (ownerId, memberUserId) => new Promise((resolve) => {
    connection.query(
        "SELECT permissions FROM team_members WHERE owner_id = ? AND member_user_id = ? AND status = 'active'",
        [ownerId, memberUserId],
        (err, rows) => resolve(err || !rows?.length ? null : parseAccess(rows[0].permissions)),
    );
});

module.exports = { TEAM_LIMIT, ROLES, AREAS, accessFor, parseAccess, cleanAccess, formatAccess, membership };
