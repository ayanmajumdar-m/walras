const authRouter = require('express').Router();
const AuthController = require('../controllers/auth.controllers');

// The two halves of the OpenID Connect authorization code flow. Both are
// browser redirects, not XHR — the user must actually visit BUTTR ID.
authRouter.get('/buttr/start', AuthController.start);
authRouter.get('/buttr/callback', AuthController.callback);

authRouter.post('/logout', AuthController.logout);
authRouter.get('/config', AuthController.config);

module.exports = authRouter;
