<?php
// Shell que hidrata una plantilla por su tipo con page-bootstrap.
// Lo usan /p/<slug> (paginas custom) y la 404 (tipo por defecto).
$tipo = isset($_GET['tipo']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['tipo']) : '404';
if ($tipo === '') $tipo = '404';
if ($tipo === '404') http_response_code(404);
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
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
  bootstrapPage(<?php echo json_encode($tipo); ?>, 'plantilla-root');
</script>
</body>
</html>
