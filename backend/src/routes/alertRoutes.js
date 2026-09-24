const { Router } = require('express');
const controller = require('../controllers/alertController');
const { authMiddleware } = require('../middleware/auth');

const router = Router();
router.use(authMiddleware);

router.get('/', controller.list);

module.exports = router;
