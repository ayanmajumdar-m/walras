/**
 * Teams (utils/team.js): owners invite people by email and choose their
 * access; invitees accept after signing in with that email address; members
 * can leave. Always acts on the signed-in person: these routes are never
 * reachable while working in someone else's account.
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
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That person is already on your team.' });
        console.error(`Team ${req.method} ${req.path} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normEmail = (e) => String(e || '').trim().toLowerCase();
const labels = (perms) => perms.map((p) => team.ACCESS[p].label);
const idParam = (raw) => {
    if (!/^\d{1,10}$/.test(String(raw))) throw new HttpError(404, 'Not found.');
    return Number(raw);
};

const me = async (userId) => {
    const [u] = await q('SELECT id, name, email, isemailverified FROM users WHERE id = ?', [userId]);
    if (!u) throw new HttpError(404, 'Account not found.');
    return u;
};

const TeamController = {
    // GET /api/team — my team, invitations waiting for me, and teams I'm in.
    overview: handle(async (req, res) => {
        const user = await me(req.user.userId);
        const [members, invitations, memberships] = await Promise.all([
            q(`SELECT t.id, t.email, t.permissions, t.status, t.invited_at, t.accepted_at, u.name
               FROM team_members t LEFT JOIN users u ON u.id = t.member_user_id
               WHERE t.owner_id = ? ORDER BY t.invited_at`, [user.id]),
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
            access: team.ACCESS,
            members: members.map((m) => ({
                id: m.id, email: m.email, name: m.name || null, status: m.status,
                permissions: team.parsePermissions(m.permissions), invitedAt: m.invited_at, acceptedAt: m.accepted_at,
            })),
            invitations: invitations.map((i) => ({
                id: i.id, ownerName: i.owner_name, ownerEmail: i.owner_email,
                permissions: team.parsePermissions(i.permissions), invitedAt: i.invited_at,
            })),
            memberships: memberships.map((m) => ({
                ownerId: m.owner_id, ownerName: m.owner_name, ownerEmail: m.owner_email, company: m.company || null,
                permissions: team.parsePermissions(m.permissions),
            })),
        });
    }),

    // POST /api/team/members { email, permissions }
    invite: handle(async (req, res) => {
        const owner = await me(req.user.userId);
        const email = normEmail(req.body.email);
        const permissions = team.cleanPermissions(req.body.permissions);
        if (!EMAIL.test(email) || email.length > 255) throw new HttpError(400, 'Enter a valid email address.');
        if (email === normEmail(owner.email)) throw new HttpError(400, "You can't invite yourself.");
        if (!permissions.length) throw new HttpError(400, 'Choose at least one kind of access.');

        const [{ n }] = await q('SELECT COUNT(*) AS n FROM team_members WHERE owner_id = ?', [owner.id]);
        if (Number(n) >= team.TEAM_LIMIT) {
            throw new HttpError(400, `Your team is full: up to ${team.TEAM_LIMIT} people, including pending invitations.`);
        }
        const [existing] = await q('SELECT id FROM team_members WHERE owner_id = ? AND LOWER(email) = ?', [owner.id, email]);
        if (existing) throw new HttpError(409, 'That person is already on your team.');

        const ins = await q('INSERT INTO team_members (owner_id, email, permissions) VALUES (?, ?, ?)', [owner.id, email, permissions.join(',')]);
        let emailed = true;
        try {
            await sendTeamInviteEmail(email, owner.name || owner.email, labels(permissions));
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

    // PUT /api/team/members/:id { permissions }
    updateMember: handle(async (req, res) => {
        const id = idParam(req.params.id);
        const permissions = team.cleanPermissions(req.body.permissions);
        if (!permissions.length) throw new HttpError(400, 'Choose at least one kind of access, or remove the person instead.');
        const r = await q('UPDATE team_members SET permissions = ? WHERE id = ? AND owner_id = ?', [permissions.join(','), id, req.user.userId]);
        if (!r.affectedRows) throw new HttpError(404, 'Not found.');
        res.json({ message: 'Access updated.' });
    }),

    // DELETE /api/team/members/:id — remove a member or cancel an invitation. Takes effect at once.
    removeMember: handle(async (req, res) => {
        const id = idParam(req.params.id);
        const r = await q('DELETE FROM team_members WHERE id = ? AND owner_id = ?', [id, req.user.userId]);
        if (!r.affectedRows) throw new HttpError(404, 'Not found.');
        res.json({ message: 'Removed from your team.' });
    }),

    // POST /api/team/invitations/:id/accept — only by the invited email address, once verified.
    acceptInvitation: handle(async (req, res) => {
        const id = idParam(req.params.id);
        const user = await me(req.user.userId);
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
        const user = await me(req.user.userId);
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
