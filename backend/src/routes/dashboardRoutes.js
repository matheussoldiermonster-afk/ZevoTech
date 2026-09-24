const { Router } = require('express');
const controller = require('../controllers/dashboardController');
const { authMiddleware } = require('../middleware/auth');

// Leitura: qualquer usuário autenticado.
const router = Router();
router.use(authMiddleware);

router.get('/summary', controller.summary); // legado
router.get('/kpis', controller.kpis);
router.get('/operations', controller.operations);
router.get('/equipment', controller.equipment);

module.exports = router;
