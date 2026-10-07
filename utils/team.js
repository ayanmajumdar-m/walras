/**
 * Teams: an account owner invites up to TEAM_LIMIT people by email and gives
 * each a role in the owner's account. A member keeps their own login; in the
 * console they switch to "work in <owner>'s account", and the client then
 * sends X-Walras-Account: <ownerId> with each request.
 *
 * Roles:
 *   write — use everything (servers, billing, support) but delete nothing:
 *           every DELETE request is refused.
 *   admin — everything, including deleting and managing the owner's team.
 *
 * authenticateToken (utils/auth.middleware.js) checks that header: the member
 * must be active in that team, and the request must be one ACCESS_ROUTES
 * allows for their role. Anything not listed is refused while working in
 * someone else's account: profile, password, own invitations and so on
 * always act on the signed-in person.
 */
const connection = require('../config/db');

const TEAM_LIMIT = 5;

const ROLES = {
    write: { label: 'Write', desc: "Can use everything in the account (servers, billing and support) but can't delete anything." },
    admin: { label: 'Admin', desc: 'Can do everything, including deleting resources and managing the team.' },
};
const ROLE_KEYS = Object.keys(ROLES);

// Request path prefix → minimum role needed in someone else's account.
// Default: refused. ('member' = any role.)
const ACCESS_ROUTES = [
    ['/api/servers', 'member'],
    ['/api/hosting', 'member'],
    ['/api/users/domains/purchased', 'member'],
    ['/api/users/openprovider/', 'member'],
    ['/api/wallet', 'member'],
    ['/api/users/wallet/billing-history', 'member'],
    ['/api/payment/ccavenue/initiate-wallet', 'member'],
    ['/api/support', 'member'],
    ['/api/team/members', 'admin'],
];

const accessFor = (url) => {
    const path = String(url || '').split('?')[0];
    const hit = ACCESS_ROUTES.find(([prefix]) => path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`));
    return hit ? hit[1] : null;
};

// The column holds the role. Values from before roles existed (the old
// servers/billing/support access lists) read as the safer "write".
const parseRole = (raw) => (ROLE_KEYS.includes(raw) ? raw : 'write');
const cleanRole = (raw) => (ROLE_KEYS.includes(raw) ? raw : null);

/** The member's role in the owner's account, or null if not an active member. */
const membership = (ownerId, memberUserId) => new Promise((resolve) => {
    connection.query(
        "SELECT permissions FROM team_members WHERE owner_id = ? AND member_user_id = ? AND status = 'active'",
        [ownerId, memberUserId],
        (err, rows) => resolve(err || !rows?.length ? null : parseRole(rows[0].permissions)),
    );
});

module.exports = { TEAM_LIMIT, ROLES, ROLE_KEYS, accessFor, parseRole, cleanRole, membership };
