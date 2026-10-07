/**
 * Teams: an account owner invites up to TEAM_LIMIT people by email and gives
 * each some access to the owner's account. A member keeps their own login;
 * in the console they switch to "work in <owner>'s account", and the client
 * then sends X-Walras-Account: <ownerId> with each request.
 *
 * authenticateToken (utils/auth.middleware.js) checks that header: the member
 * must be active in that team, and the request must be one their access
 * covers (ACCESS_ROUTES). Anything not listed there is refused while working
 * in someone else's account: profile, password, team management and so on
 * always act on the signed-in person.
 */
const connection = require('../config/db');

const TEAM_LIMIT = 5;

const ACCESS = {
    servers: { label: 'Servers', desc: 'Create, view and manage Cloud Compute, web hosting and domains. New servers are paid from the account balance.' },
    billing: { label: 'Billing', desc: 'See the account balance, add funds, apply promo codes and view usage.' },
    support: { label: 'Support', desc: 'Open and reply to support tickets for the account.' },
};
const ACCESS_KEYS = Object.keys(ACCESS);

// Request path prefix → access needed to use it in someone else's account.
// Order matters only for overlapping prefixes (none today). Default: refused.
const ACCESS_ROUTES = [
    ['/api/servers', 'servers'],
    ['/api/hosting', 'servers'],
    ['/api/users/domains/purchased', 'servers'],
    ['/api/users/openprovider/', 'servers'],
    ['/api/wallet', 'billing'],
    ['/api/users/wallet/billing-history', 'billing'],
    ['/api/payment/ccavenue/initiate-wallet', 'billing'],
    ['/api/support', 'support'],
];

const accessFor = (url) => {
    const path = String(url || '').split('?')[0];
    const hit = ACCESS_ROUTES.find(([prefix]) => path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`));
    return hit ? hit[1] : null;
};

const parsePermissions = (raw) => String(raw || '').split(',').map((s) => s.trim()).filter((s) => ACCESS_KEYS.includes(s));
const cleanPermissions = (list) => [...new Set((Array.isArray(list) ? list : []).filter((p) => ACCESS_KEYS.includes(p)))];

/** The member's access in the owner's account, or null if not an active member. */
const membership = (ownerId, memberUserId) => new Promise((resolve) => {
    connection.query(
        "SELECT permissions FROM team_members WHERE owner_id = ? AND member_user_id = ? AND status = 'active'",
        [ownerId, memberUserId],
        (err, rows) => resolve(err || !rows?.length ? null : parsePermissions(rows[0].permissions)),
    );
});

module.exports = { TEAM_LIMIT, ACCESS, ACCESS_KEYS, accessFor, parsePermissions, cleanPermissions, membership };
