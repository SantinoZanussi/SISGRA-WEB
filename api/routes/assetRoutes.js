const express = require('express');
const router = express.Router();
const multer = require('multer');
const c = require('../controllers/assetController');
const { authMiddleware } = require('../middleware/auth');

// Guardamos en memoria; el controller escribe el buffer en /img con el nombre final
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// Público: solo lectura (el panel necesita listar las rutas disponibles)
router.get('/', c.listar);

// Protegidas: escritura
router.post('/', authMiddleware, upload.single('file'), c.subir);
router.patch('/:id', authMiddleware, c.renombrar);
router.patch('/:id/lock', authMiddleware, c.toggleLock);
router.delete('/:id', authMiddleware, c.eliminar);

module.exports = router;
