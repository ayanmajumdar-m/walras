const teamRouter = require('express').Router();
const TeamController = require('../controllers/team.controllers');
const authenticateToken = require('../utils/auth.middleware');
const rateLimit = require('../utils/rateLimit');

// Not in utils/team.js ACCESS_ROUTES, so authenticateToken refuses these
// while working in someone else's account: team changes are always your own.
teamRouter.use(authenticateToken);

const inviteLimit = rateLimit({
    windowMs: 60 * 60 * 1000, max: 20, keyFn: (req) => `team-invite:${req.user?.userId}`,
    message: 'Too many invitations sent. Please try again later.',
});

teamRouter.get('/', TeamController.overview);
teamRouter.post('/members', inviteLimit, TeamController.invite);
teamRouter.put('/members/:id', TeamController.updateMember);
teamRouter.delete('/members/:id', TeamController.removeMember);
teamRouter.post('/invitations/:id/accept', TeamController.acceptInvitation);
teamRouter.delete('/invitations/:id', TeamController.declineInvitation);
teamRouter.delete('/memberships/:ownerId', TeamController.leave);

module.exports = teamRouter;
