const { Router } = require('express');
const controller = require('../controllers/reportController');
const { authMiddleware } = require('../middleware/auth');

// Leitura: qualquer usuário autenticado.
const router = Router();
router.use(authMiddleware);

router.get('/monthly', controller.monthly);
router.get('/monthly/pdf', controller.monthlyPdf);
router.get('/monthly/xlsx', controller.monthlyXlsx);

module.exports = router;
