<?php
// Config central de la API. Las credenciales se pueden pisar por variables de entorno.

// Overrides locales sin commitear (putenv de secretos, ej. META_APP_SECRET). Opcional.
if (is_file(__DIR__ . '/secure/env.php')) require __DIR__ . '/secure/env.php';

// --- Base de datos (por defecto, valores tipicos de XAMPP/MariaDB) ---
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'sisgra');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') === false ? 'admin12345' : getenv('DB_PASS'));

// --- Auth ---
// mismo default que usaba el backend Node; cambialo en produccion via env
define('JWT_SECRET', getenv('JWT_SECRET') ?: 'sisgra_secret_2026_change_in_production');
define('JWT_TTL', 8 * 60 * 60); // 8 horas, en segundos

// --- Rutas del proyecto ---
define('API_DIR', __DIR__);
define('PROJECT_ROOT', dirname(__DIR__));
define('DATA_DIR', __DIR__ . '/data');   // solo lo usa el migrador
define('IMG_DIR', PROJECT_ROOT . '/img');
define('HTML_DIR', PROJECT_ROOT . '/html');
define('SECURE_DIR', __DIR__ . '/secure'); // tokens de Meta, fuera de lo servible

// --- Meta / Redes sociales (Instagram + Facebook) ---
// El App Secret NUNCA se commitea: cargalo por env (META_APP_SECRET) en el server.
define('META_APP_ID',      getenv('META_APP_ID') ?: '');
define('META_APP_SECRET',  getenv('META_APP_SECRET') ?: '');
define('META_GRAPH_VER',   getenv('META_GRAPH_VER') ?: 'v21.0');
// ID de la Página de FB a usar (opcional; si se omite toma la primera del usuario)
define('META_PAGE_ID',     getenv('META_PAGE_ID') ?: '');
// redirect del OAuth; si queda vacío se arma desde el host del request
define('META_REDIRECT_URI', getenv('META_REDIRECT_URI') ?: '');

// --- LinkedIn (publica en la Página de empresa) ---
define('LI_CLIENT_ID',     getenv('LI_CLIENT_ID') ?: '');
define('LI_CLIENT_SECRET', getenv('LI_CLIENT_SECRET') ?: '');
// id numérico de la Página de empresa; si falta se autodetecta con rw_organization_admin
define('LI_ORG_ID',        getenv('LI_ORG_ID') ?: '');
define('LI_REDIRECT_URI',  getenv('LI_REDIRECT_URI') ?: '');
// header Linkedin-Version, en formato YYYYMM (LinkedIn saca de servicio las viejas)
define('LI_VERSION',       getenv('LI_VERSION') ?: '202607');

// flags para que el JSON de salida sea igual al que emitia Node (unicode y / sin escapar)
define('JSON_FLAGS', JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
