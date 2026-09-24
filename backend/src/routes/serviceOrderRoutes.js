const { Router } = require('express');
const controller = require('../controllers/serviceOrderController');
const { authMiddleware, adminOnly, financeWrite } = require('../middleware/auth');

// Leitura: qualquer usuário autenticado. Escrita/exclusão: ver guardas abaixo.
const router = Router();
router.use(authMiddleware);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.get('/:id/history', controller.history);
router.post('/', adminOnly, controller.create);
router.put('/:id', adminOnly, controller.update);
router.patch('/:id/payment', financeWrite, controller.updatePayment);
router.delete('/:id', adminOnly, controller.remove);

module.exports = router;
