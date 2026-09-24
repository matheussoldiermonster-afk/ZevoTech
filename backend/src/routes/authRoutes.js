const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = Router();

// Proteção contra tentativa de senha por força bruta.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.' },
});

router.post('/login', loginLimiter, authController.login);
router.get('/me', authMiddleware, authController.me);
router.post('/change-password', authMiddleware, loginLimiter, userController.changeOwnPassword);
// CORREÇÃO DE SEGURANÇA: antes era pública e aceitava role ADMIN.
router.post('/register', authMiddleware, adminOnly, authController.register);

module.exports = router;
