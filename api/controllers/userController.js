const bcryptjs = require("bcryptjs");
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET || "sisgra_secret_2026_change_in_production";

const REAL_HASH = bcryptjs.hashSync("sisgra2026", 10);

// login
exports.loginUser = async (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  if (usuario !== 'admin') {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const valid = await bcryptjs.compare(password, REAL_HASH);
  if (!valid) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const token = jwt.sign(
    { user: 'admin', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, expiresIn: 28800 });
};