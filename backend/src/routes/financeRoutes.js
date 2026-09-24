const { Router } = require('express');
const controller = require('../controllers/financeController');
const { authMiddleware, financeWrite } = require('../middleware/auth');

// Leitura: qualquer usuário autenticado. Escrita/exclusão: ver guardas abaixo.
const router = Router();
router.use(authMiddleware);

router.get('/receivables', controller.receivables);
router.get('/summary', controller.summary);
router.get('/series', controller.series);
router.post('/receivables/pay', financeWrite, controller.payBatch);

module.exports = router;
