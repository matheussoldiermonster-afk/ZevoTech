const { Router } = require('express');
const controller = require('../controllers/contractController');
const { authMiddleware, adminOnly, financeWrite } = require('../middleware/auth');

// Leitura: qualquer usuário autenticado. Escrita/exclusão: ver guardas abaixo.
const router = Router();
router.use(authMiddleware);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', financeWrite, controller.create);
router.post('/generate-payments', financeWrite, controller.generateBatch);
router.put('/:id', financeWrite, controller.update);
router.post('/:id/generate-payment', financeWrite, controller.generateMonthlyPayment);
router.delete('/:id', adminOnly, controller.remove);

module.exports = router;
