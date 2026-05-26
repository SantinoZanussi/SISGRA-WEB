const express = require('express');
const router = express.Router();
const c = require('../controllers/plantillaController');
const { authMiddleware } = require('../middleware/auth');

router.get('/tipos',          c.listarTipos);
router.get('/activa/:tipo',   c.activaPorTipo);
router.get('/',               c.listar);
router.get('/:id',            c.obtener);
router.post('/',              authMiddleware, c.crear);
router.patch('/:id',          authMiddleware, c.actualizar);
router.post('/:id/activar',   authMiddleware, c.activar);
router.delete('/:id',         authMiddleware, c.eliminar);

module.exports = router;
