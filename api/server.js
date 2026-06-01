const express = require("express");
const cors = require('cors');
const os = require('os');
const path = require('path');
const { JWT_SECRET } = require("./middleware/auth.js");

const app = express();
const PORT = process.env.PORT || 3000;
const PROJECT_ROOT = path.join(__dirname, '..');

app.use(express.json());
app.use(cors());

// Force no-cache en todas las respuestas API. Sin esto, el browser cachea
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

//* API ROUTES
const userRoutes = require("./routes/userRoutes");
app.use("/api/auth", userRoutes);

const dataRoutes = require("./routes/dataRoutes");
app.use("/api/data", dataRoutes);

const plantillaRoutes = require("./routes/plantillaRoutes");
app.use("/api/plantillas", plantillaRoutes);

const navRoutes = require("./routes/navRoutes");
app.use("/api/nav", navRoutes);

const webhookRoutes = require("./routes/webhookRoutes");
app.use("/api/webhook", webhookRoutes);

const modulosRoutes = require("./routes/modulosRoutes");
app.use("/api/modulos", modulosRoutes);

const alertasRoutes = require("./routes/alertasRoutes");
app.use("/api/alertas", alertasRoutes);

const assetRoutes = require("./routes/assetRoutes");
app.use("/api/assets", assetRoutes);

app.use(express.static(PROJECT_ROOT, {
  index: 'index.html',
  extensions: ['html'],
}));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint no encontrado', path: req.path });
  }
  res.status(404).sendFile(path.join(PROJECT_ROOT, '404.html'));
});

function getLocalIPv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Solo IPv4 y no internas (loopback)
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '0.0.0.0';
}


const host = "0.0.0.0";
app.listen(PORT, host, () => {
  const localIP = getLocalIPv4();
  console.log(` → Servidor corriendo en:`);
  console.log(`    • http://localhost:${PORT}`);
  console.log(`    • http://${localIP}:${PORT}`);
});