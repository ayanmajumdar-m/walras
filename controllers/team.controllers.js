/**
 * Teams (utils/team.js).
 *
 * /api/team, /api/team/invitations and /api/team/memberships always act on
 * the signed-in person: their own team overview, invitations waiting for
 * them, teams they've joined.
 *
 * /api/team/members/* manage a team. They act on req.user.userId, which is
 * the owner themselves, or the owner's account when a team Admin is working
 * in it (authenticateToken allows that only for the admin role).
 */
const connection = require('../config/db');
const team = require('../utils/team');
const { sendTeamInviteEmail } = require('../utils/sendEmail');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const handle = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That person is already on the team.' });
        console.error(`Team ${req.method} ${req.path} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normEmail = (e) => String(e || '').trim().toLowerCase();
const idParam = (raw) => {
    if (!/^\d{1,10}$/.test(String(raw))) throw new HttpError(404, 'Not found.');
    return Number(raw);
};

const findUser = async (userId) => {
    const [u] = await q('SELECT id, name, email, isemailverified FROM users WHERE id = ?', [userId]);
    if (!u) throw new HttpError(404, 'Account not found.');
    return u;
};

const listMembers = async (ownerId) => {
    const rows = await q(
        `SELECT t.id, t.email, t.permissions, t.status, t.invited_at, t.accepted_at, t.member_user_id, u.name
         FROM team_members t LEFT JOIN users u ON u.id = t.member_user_id
         WHERE t.owner_id = ? ORDER BY t.invited_at`,
        [ownerId],
    );
    return rows.map((m) => ({
        id: m.id, email: m.email, name: m.name || null, status: m.status, userId: m.member_user_id || null,
        ...team.parseAccess(m.permissions), invitedAt: m.invited_at, acceptedAt: m.accepted_at,
    }));
};

const TeamController = {
    // GET /api/team — my own team, invitations waiting for me, and teams I'm in.
    overview: handle(async (req, res) => {
        const user = await findUser(req.user.userId);
        const [members, invitations, memberships] = await Promise.all([
            listMembers(user.id),
            q(`SELECT t.id, t.permissions, t.invited_at, o.name AS owner_name, o.email AS owner_email
               FROM team_members t JOIN users o ON o.id = t.owner_id
               WHERE LOWER(t.email) = ? AND t.status = 'invited' AND t.owner_id <> ?
               ORDER BY t.invited_at DESC`, [normEmail(user.email), user.id]),
            q(`SELECT t.owner_id, t.permissions, o.name AS owner_name, o.email AS owner_email, o.company
               FROM team_members t JOIN users o ON o.id = t.owner_id
               WHERE t.member_user_id = ? AND t.status = 'active' ORDER BY o.name`, [user.id]),
        ]);
        res.json({
            limit: team.TEAM_LIMIT,
            roles: team.ROLES,
            areas: team.AREAS,
            members,
            invitations: invitations.map((i) => ({
                id: i.id, ownerName: i.owner_name, ownerEmail: i.owner_email,
                ...team.parseAccess(i.permissions), invitedAt: i.invited_at,
            })),
            memberships: memberships.map((m) => ({
                ownerId: m.owner_id, ownerName: m.owner_name, ownerEmail: m.owner_email, company: m.company || null,
                ...team.parseAccess(m.permissions),
            })),
        });
    }),

    // GET /api/team/members — the team of the account being worked in.
    members: handle(async (req, res) => {
        const owner = await findUser(req.user.userId);
        res.json({
            limit: team.TEAM_LIMIT,
            roles: team.ROLES,
            areas: team.AREAS,
            owner: { name: owner.name, email: owner.email },
            members: await listMembers(owner.id),
        });
    }),

    // POST /api/team/members { email, role, areas }
    invite: handle(async (req, res) => {
        const owner = await findUser(req.user.userId);
        const email = normEmail(req.body.email);
        const access = team.cleanAccess(req.body.role, req.body.areas);
        if (!EMAIL.test(email) || email.length > 255) throw new HttpError(400, 'Enter a valid email address.');
        if (email === normEmail(owner.email)) throw new HttpError(400, "That's the account owner's own email address.");
        if (!access) throw new HttpError(400, 'Choose a role and at least one area: Servers, Billing or Support.');

        const [{ n }] = await q('SELECT COUNT(*) AS n FROM team_members WHERE owner_id = ?', [owner.id]);
        if (Number(n) >= team.TEAM_LIMIT) {
            throw new HttpError(400, `The team is full: up to ${team.TEAM_LIMIT} people, including pending invitations.`);
        }
        const [existing] = await q('SELECT id FROM team_members WHERE owner_id = ? AND LOWER(email) = ?', [owner.id, email]);
        if (existing) throw new HttpError(409, 'That person is already on the team.');

        const ins = await q('INSERT INTO team_members (owner_id, email, permissions) VALUES (?, ?, ?)', [owner.id, email, team.formatAccess(access)]);
        let emailed = true;
        try {
            await sendTeamInviteEmail(email, owner.name || owner.email,
                [`${team.ROLES[access.role].label} (${access.areas.map((a) => team.AREAS[a].label).join(', ')})`]);
        } catch (err) {
            emailed = false;
            console.error('Team invite email failed:', err.message);
        }
        res.status(201).json({
            id: ins.insertId,
            message: emailed
                ? `Invitation sent to ${email}.`
                : `Invitation saved, but the email couldn't be sent. Ask ${email} to sign in and open Account > Team.`,
        });
    }),

    // PUT /api/team/members/:id { role, areas }
    updateMember: handle(async (req, res) => {
        const id = idParam(req.params.id);
        const access = team.cleanAccess(req.body.role, req.body.areas);
        if (!access) throw new HttpError(400, 'Choose a role and at least one area, or remove the person instead.');
        const r = await q('UPDATE team_members SET permissions = ? WHERE id = ? AND owner_id = ?', [team.formatAccess(access), id, req.user.userId]);
        if (!r.affectedRows) throw new HttpError(404, 'Not found.');
        res.json({ message: 'Access updated.' });
    }),

    // DELETE /api/team/members/:id — remove a member or cancel an invitation. Takes effect at once.
    removeMember: handle(async (req, res) => {
        const id = idParam(req.params.id);
        const r = await q('DELETE FROM team_members WHERE id = ? AND owner_id = ?', [id, req.user.userId]);
        if (!r.affectedRows) throw new HttpError(404, 'Not found.');
        res.json({ message: 'Removed from the team.' });
    }),

    // POST /api/team/invitations/:id/accept — only by the invited email address, once verified.
    acceptInvitation: handle(async (req, res) => {
        const id = idParam(req.params.id);
        const user = await findUser(req.user.userId);
        if (!user.isemailverified) throw new HttpError(403, 'Verify your email address first.');
        const r = await q(
            `UPDATE team_members SET status = 'active', member_user_id = ?, accepted_at = NOW()
             WHERE id = ? AND status = 'invited' AND LOWER(email) = ? AND owner_id <> ?`,
            [user.id, id, normEmail(user.email), user.id],
        );
        if (!r.affectedRows) throw new HttpError(404, 'This invitation is no longer available.');
        res.json({ message: 'Invitation accepted.' });
    }),

    // DELETE /api/team/invitations/:id — decline.
    declineInvitation: handle(async (req, res) => {
        const id = idParam(req.params.id);
        const user = await findUser(req.user.userId);
        const r = await q(
            "DELETE FROM team_members WHERE id = ? AND status = 'invited' AND LOWER(email) = ?",
            [id, normEmail(user.email)],
        );
        if (!r.affectedRows) throw new HttpError(404, 'This invitation is no longer available.');
        res.json({ message: 'Invitation declined.' });
    }),

    // DELETE /api/team/memberships/:ownerId — leave someone's team.
    leave: handle(async (req, res) => {
        const ownerId = idParam(req.params.ownerId);
        const r = await q('DELETE FROM team_members WHERE owner_id = ? AND member_user_id = ?', [ownerId, req.user.userId]);
        if (!r.affectedRows) throw new HttpError(404, 'Not found.');
        res.json({ message: 'You left the team.' });
    }),
};

module.exports = TeamController;
