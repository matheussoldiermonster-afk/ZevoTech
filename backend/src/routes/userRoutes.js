const { Router } = require('express');
const controller = require('../controllers/userController');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Gestão de usuários: somente administradores.
const router = Router();
router.use(authMiddleware, adminOnly);

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.put('/:id/password', controller.resetPassword);

module.exports = router;
