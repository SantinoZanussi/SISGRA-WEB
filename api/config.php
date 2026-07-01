<?php
// Config central de la API. Las credenciales se pueden pisar por variables de entorno.

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

// flags para que el JSON de salida sea igual al que emitia Node (unicode y / sin escapar)
define('JSON_FLAGS', JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
