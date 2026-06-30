const express = require('express');
const router = express.Router();
const multer = require('multer');
const c = require('../controllers/assetController');
const { authMiddleware } = require('../middleware/auth');

// en memoria; el controller escribe el buffer en /img
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 mb
});

// publico, solo lectura
router.get('/', c.listar);
router.get('/labels', c.listarLabels);

// labels antes de /:id para que no las capture el comodin
router.post('/labels', authMiddleware, c.crearLabel);
router.patch('/labels/:id', authMiddleware, c.editarLabel);
router.delete('/labels/:id', authMiddleware, c.eliminarLabel);

// protegidas, escritura
router.post('/', authMiddleware, upload.single('file'), c.subir);
router.patch('/:id/tags', authMiddleware, c.asignarTags);
router.patch('/:id/lock', authMiddleware, c.toggleLock);
router.patch('/:id', authMiddleware, c.renombrar);
router.delete('/:id', authMiddleware, c.eliminar);

module.exports = router;
