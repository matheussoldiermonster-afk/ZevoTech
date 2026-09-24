const { Router } = require('express');
const controller = require('../controllers/clientController');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Leitura: qualquer usuário autenticado. Escrita/exclusão: ver guardas abaixo.
const router = Router();
router.use(authMiddleware);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', adminOnly, controller.create);
router.put('/:id', adminOnly, controller.update);
router.delete('/:id', adminOnly, controller.remove);

module.exports = router;
