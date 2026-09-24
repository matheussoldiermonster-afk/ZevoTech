const { Router } = require('express');
const controller = require('../controllers/backupController');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Backups: somente administradores.
const router = Router();
router.use(authMiddleware, adminOnly);

router.get('/', controller.overview);
router.post('/run', controller.runNow);

module.exports = router;
