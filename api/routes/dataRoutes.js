const express = require('express');
const router = express.Router();
const dataController = require('../controllers/dataController');
const { authMiddleware } = require('../middleware/auth');

// Public: solo lectura
router.get('/:file', dataController.getFile);

// Protegidas: escritura
router.put('/:file', authMiddleware, dataController.updateFile);
router.patch('/:file/:collection/:id', authMiddleware, dataController.updateItem);
router.post('/:file/:collection', authMiddleware, dataController.createItem);
router.delete('/:file/:collection/:id', authMiddleware, dataController.deleteItem);

module.exports = router;