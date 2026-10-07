/**
 * Admin → Integrations (utils/integrations.js): API keys, passwords and
 * addresses for email, Zendesk, payments and domains, set in admin instead
 * of the server environment. Secrets are write-only.
 */
const integrations = require('../utils/integrations');
const audit = require('../utils/audit');

const IntegrationsController = {
    // GET /api/admin/integrations
    get: (req, res) => res.json({ groups: integrations.adminView() }),

    // PUT /api/admin/integrations { values: { NAME: value | null } }
    update: async (req, res) => {
        try {
            const changed = await integrations.save(req.body?.values || {});
            // Names only: values (and secrets) never go into the audit log.
            audit(req, 'integrations.update', 'settings', 'integrations', { changed });
            res.json({ message: changed.length ? `Saved: ${changed.join(', ')}` : 'Nothing changed.', groups: integrations.adminView() });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    },
};

module.exports = IntegrationsController;
