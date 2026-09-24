const { buildAlerts } = require('../services/alertService');

async function list(req, res, next) {
  try {
    return res.json(await buildAlerts({ isAdmin: req.user?.role === 'ADMIN' }));
  } catch (err) {
    return next(err);
  }
}

module.exports = { list };
