<?php
// Front controller de la API. Todo /api/* entra aca via .htaccess.

require __DIR__ . '/config.php';
require __DIR__ . '/lib/helpers.php';
require __DIR__ . '/lib/Db.php';
require __DIR__ . '/lib/Http.php';
require __DIR__ . '/lib/Jwt.php';
require __DIR__ . '/lib/Auth.php';
require __DIR__ . '/lib/Store.php';
require __DIR__ . '/lib/SocialStore.php';
require __DIR__ . '/lib/MetaService.php';
// require __DIR__ . '/lib/LinkedinService.php'; // LinkedIn deshabilitado (se retoma a futuro)
foreach (glob(__DIR__ . '/controllers/*.php') as $c) require $c;

// mismo origen que el front (Apache sirve el sitio y la API juntos)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
// sin cache, como hacia el server Node
header('Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') { http_response_code(204); exit; }

// ruta relativa al directorio /api (soporta instalacion en subcarpeta)
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');
if ($base !== '' && strpos($path, $base) === 0) $path = substr($path, strlen($base));
$path = '/' . trim($path, '/');

// tabla de rutas: [metodo, patron, [Controller, metodo], authRequerida]
$routes = [
    ['POST',   '/auth/login',                        ['AuthController', 'login'],            false],

    ['GET',    '/data/:file',                        ['DataController', 'getFile'],          false],
    ['PUT',    '/data/:file',                        ['DataController', 'updateFile'],       true],
    ['PATCH',  '/data/:file/:collection/:id',        ['DataController', 'updateItem'],       true],
    ['POST',   '/data/:file/:collection',            ['DataController', 'createItem'],       true],
    ['DELETE', '/data/:file/:collection/:id',        ['DataController', 'deleteItem'],       true],

    ['GET',    '/meta/ultima-edicion',               ['DataController', 'ultimaEdicion'],    true],

    ['GET',    '/plantillas/tipos',                  ['PlantillaController', 'listarTipos'],  false],
    ['GET',    '/plantillas/activa/:tipo',           ['PlantillaController', 'activaPorTipo'],false],
    ['GET',    '/plantillas',                        ['PlantillaController', 'listar'],       false],
    ['GET',    '/plantillas/:id',                    ['PlantillaController', 'obtener'],      false],
    ['POST',   '/plantillas',                        ['PlantillaController', 'crear'],        true],
    ['PATCH',  '/plantillas/:id',                    ['PlantillaController', 'actualizar'],   true],
    ['POST',   '/plantillas/:id/activar',            ['PlantillaController', 'activar'],      true],
    ['POST',   '/plantillas/:id/extender',           ['PlantillaController', 'extender'],     true],
    ['DELETE', '/plantillas/:id',                    ['PlantillaController', 'eliminar'],     true],

    ['POST',   '/nav/page',                          ['NavController', 'getPage'],            false],
    ['GET',    '/nav/botones',                       ['NavController', 'listarBotones'],      false],
    ['POST',   '/nav/botones',                       ['NavController', 'crearBoton'],         true],
    ['PATCH',  '/nav/botones/:id',                   ['NavController', 'actualizarBoton'],    true],
    ['DELETE', '/nav/botones/:id',                   ['NavController', 'eliminarBoton'],      true],
    ['POST',   '/nav/sync',                          ['NavController', 'syncPlantillas'],     true],

    ['POST',   '/webhook/pres',                      ['WebhookController', 'recibirWebhook'], false],
    ['GET',    '/webhook/cache',                     ['WebhookController', 'listarCache'],    true],
    ['GET',    '/webhook/cache/:id',                 ['WebhookController', 'obtenerEntrada'], true],
    ['PATCH',  '/webhook/cache/:id',                 ['WebhookController', 'editarEntrada'],  true],
    ['POST',   '/webhook/cache/:id/publicar',        ['WebhookController', 'publicarEntrada'],true],
    ['DELETE', '/webhook/cache/:id',                 ['WebhookController', 'eliminarEntrada'],true],

    ['GET',    '/modulos',                           ['ModulosController', 'listar'],         false],
    ['GET',    '/modulos/:id/usos',                  ['ModulosController', 'usos'],           false],
    ['GET',    '/modulos/:id',                       ['ModulosController', 'obtener'],        false],
    ['POST',   '/modulos',                           ['ModulosController', 'crear'],          true],
    ['PUT',    '/modulos/:id',                       ['ModulosController', 'actualizar'],     true],
    ['DELETE', '/modulos/:id',                       ['ModulosController', 'eliminar'],       true],

    ['GET',    '/alertas/catalogo',                  ['AlertasController', 'catalogo'],       false],
    ['GET',    '/alertas/log',                       ['AlertasController', 'listarLog'],      true],
    ['POST',   '/alertas/check',                     ['AlertasController', 'check'],          false],

    ['GET',    '/assets',                            ['AssetController', 'listar'],           false],
    ['GET',    '/assets/labels',                     ['AssetController', 'listarLabels'],     false],
    ['POST',   '/assets/labels',                     ['AssetController', 'crearLabel'],       true],
    ['PATCH',  '/assets/labels/:id',                 ['AssetController', 'editarLabel'],      true],
    ['DELETE', '/assets/labels/:id',                 ['AssetController', 'eliminarLabel'],    true],
    ['POST',   '/assets',                            ['AssetController', 'subir'],            true],
    ['PATCH',  '/assets/:id/tags',                   ['AssetController', 'asignarTags'],      true],
    ['PATCH',  '/assets/:id/lock',                   ['AssetController', 'toggleLock'],       true],
    ['PATCH',  '/assets/:id',                        ['AssetController', 'renombrar'],        true],
    ['DELETE', '/assets/:id',                        ['AssetController', 'eliminar'],         true],

    ['POST',   '/contactos',                         ['ContactosController', 'crear'],        false],
    ['GET',    '/contactos',                         ['ContactosController', 'listar'],       true],

    ['GET',    '/social/status',                     ['SocialController', 'status'],          true],
    ['GET',    '/social/connect',                    ['SocialController', 'connect'],         true],
    ['GET',    '/social/callback',                   ['SocialController', 'callback'],        false],
    ['POST',   '/social/disconnect',                 ['SocialController', 'disconnect'],      true],

    // LinkedIn deshabilitado (se retoma a futuro; NO borrar):
    // ['GET',    '/social/linkedin/status',            ['SocialController', 'liStatus'],        true],
    // ['GET',    '/social/linkedin/connect',           ['SocialController', 'liConnect'],       true],
    // ['GET',    '/social/linkedin/callback',          ['SocialController', 'liCallback'],      false],
    // ['POST',   '/social/linkedin/disconnect',        ['SocialController', 'liDisconnect'],    true],

    ['POST',   '/social/publish/:id',                ['SocialController', 'publish'],         true],
];

try {
    foreach ($routes as $r) {
        list($rm, $pattern, $handler, $auth) = $r;
        if ($rm !== $method) continue;
        $regex = '#^' . preg_replace('/:[a-zA-Z_]+/', '([^/]+)', $pattern) . '$#';
        if (!preg_match($regex, $path, $m)) continue;

        array_shift($m); // el match completo
        $params = array_map('rawurldecode', $m);
        if ($auth) Auth::require();
        call_user_func_array($handler, $params);
        exit;
    }
    Http::error('Endpoint no encontrado', 404, ['path' => $path]);
} catch (Throwable $e) {
    Http::error('Error interno', 500, ['detail' => $e->getMessage()]);
}
