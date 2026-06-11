const express = require('express');
const router = express.Router();
const c = require('../controllers/contactosController');
const { authMiddleware } = require('../middleware/auth');

router.post('/', c.crear);
router.get('/', authMiddleware, c.listar);

module.exports = router;
