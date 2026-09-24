const { Router } = require('express');
const controller = require('../controllers/monthlyPaymentController');
const { authMiddleware, financeWrite } = require('../middleware/auth');

// Leitura: qualquer usuário autenticado. Escrita/exclusão: ver guardas abaixo.
const router = Router();
router.use(authMiddleware);

router.get('/', controller.list);
router.get('/summary', controller.summary);
router.put('/:id', financeWrite, controller.update);

module.exports = router;
