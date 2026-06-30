const express = require("express");
const cors = require('cors');
const os = require('os');
const path = require('path');
const { JWT_SECRET } = require("./middleware/auth.js");

const app = express();
const PORT = process.env.PORT || 3000;
const PROJECT_ROOT = path.join(__dirname, '..');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// no-cache en todas las respuestas, el browser cachea sin esto
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

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

const contactosRoutes = require("./routes/contactosRoutes");
app.use("/api/contactos", contactosRoutes);

// shell que hidrata una plantilla por su tipo con page-bootstrap
// lo usan /p/:slug (custom) y la 404, sin html fisico: todo sale de modulos + plantilla
function pageShellHtml(tipo) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title id="meta-title">SISGRA S.R.L.</title>
  <meta name="description" id="meta-desc" content="">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
  <link rel="icon" href="/img/sdesigra.png">
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/layout.css">
  <link rel="stylesheet" href="/css/components.css">
</head>
<body>
<div id="plantilla-root">
  <div style="padding:6rem 2rem;text-align:center;color:#94a3b8;font-family:'Inter',system-ui,sans-serif;letter-spacing:.15em;text-transform:uppercase;font-size:.75rem;">Cargando…</div>
</div>
<script type="module">
  import { bootstrapPage } from '/services/page-bootstrap.js';
  bootstrapPage(${JSON.stringify(tipo)}, 'plantilla-root');
</script>
</body>
</html>`;
}

// sirve el shell de la plantilla activa tipo 404 con status 404
function render404(res) {
  res.status(404).type('html').send(pageShellHtml('404'));
}

// /p/:slug hidrata la plantilla cuyo tipo === slug desde un shell compartido
app.get('/p/:slug', (req, res) => {
  const slug = String(req.params.slug || '');
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return render404(res);
  res.type('html').send(pageShellHtml(slug));
});

app.use(express.static(PROJECT_ROOT, {
  index: 'index.html',
  extensions: ['html'],
}));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint no encontrado', path: req.path });
  }
  render404(res);
});

function getLocalIPv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
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