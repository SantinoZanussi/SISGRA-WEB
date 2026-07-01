<?php
// Migrador JSON -> MySQL. Crea la base, corre el esquema e importa api/data/*.json.
// Uso:  php api/migrate.php     (o abrilo en el navegador una vez, bajo XAMPP)
// Es re-ejecutable: reemplaza el contenido de las tablas con lo que hay en los JSON.

require __DIR__ . '/config.php';
require __DIR__ . '/lib/helpers.php';
require __DIR__ . '/lib/Db.php';
require __DIR__ . '/lib/Store.php';

header('Content-Type: text/plain; charset=utf-8');

function say($msg) { echo $msg . "\n"; @ob_flush(); @flush(); }

function readJsonFile($name) {
    $fp = DATA_DIR . '/' . $name . '.json';
    if (!is_file($fp)) return null;
    return json_decode(file_get_contents($fp), false); // objeto: conserva {} vs []
}

// --- 1. crear la base si no existe ---
try {
    $root = new PDO(
        sprintf('mysql:host=%s;port=%s;charset=utf8mb4', DB_HOST, DB_PORT),
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $root->exec('CREATE DATABASE IF NOT EXISTS `' . DB_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    say('DB `' . DB_NAME . '` lista.');
} catch (Exception $e) {
    say('ERROR conectando a MySQL: ' . $e->getMessage());
    exit(1);
}

// --- 2. correr el esquema ---
$pdo = Db::conn();
$schema = file_get_contents(__DIR__ . '/sql/schema.sql');
foreach (explode(';', $schema) as $stmt) {
    $s = trim($stmt);
    if ($s === '') continue;
    $pdo->exec($s);
}
say('Esquema aplicado.');

// --- 3. documentos genericos ---
$docs = ['hero','nosotros','servicios','clientes','blog','contacto','seo','paginas','categorias','extra_sections','tpl_designs'];
$pdo->exec('DELETE FROM documents');
$nDocs = 0;
foreach ($docs as $name) {
    $d = readJsonFile($name);
    if ($d === null) { say("  (falta $name.json, salteado)"); continue; }
    Store::docPut($name, $d);
    $nDocs++;
}
say("Documentos importados: $nDocs");

// --- 4. modulos y navbar (tablas propias) ---
$mod = readJsonFile('modulos');
Store::replaceModulos($mod && isset($mod->modulos) ? $mod->modulos : []);
say('Modulos importados: ' . count(Db::all('SELECT id_modulo FROM modulos')));

$nav = readJsonFile('navbar');
Store::replaceNavbar($nav && isset($nav->botones) ? $nav->botones : []);
say('Navbar importado: ' . count(Db::all('SELECT id_menu FROM navbar')));

// --- 5. plantillas ---
$plt = readJsonFile('plantillas');
$pdo->exec('DELETE FROM plantillas');
$ins = $pdo->prepare('INSERT INTO plantillas
  (id_plantilla, tipo, nombre, descripcion, activa, fecha_inicio, fecha_fin, id_menu, id_modulos, contenedores, creado_en, editado_en)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
$nPlt = 0;
foreach (($plt && isset($plt->plantillas) ? $plt->plantillas : []) as $t) {
    $ins->execute([
        (int) field($t, 'id_plantilla'),
        field($t, 'tipo', ''),
        field($t, 'nombre', ''),
        field($t, 'descripcion', ''),
        field($t, 'activa') ? 1 : 0,
        field($t, 'fecha_inicio', null),
        field($t, 'fecha_fin', null),
        jenc(field($t, 'id_menu', [])),
        jenc(field($t, 'id_modulos', [])),
        jenc(field($t, 'contenedores', null)),
        field($t, 'creado_en', null),
        field($t, 'editado_en', null),
    ]);
    $nPlt++;
}
say("Plantillas importadas: $nPlt");

// --- 6. assets + labels ---
$as = readJsonFile('assets');
$pdo->exec('DELETE FROM assets');
$pdo->exec('DELETE FROM asset_labels');
$insA = $pdo->prepare('INSERT INTO assets
  (id, nombre, filename, path, locked, mime, size, origen, etiquetas, creado_en, editado_en)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)');
foreach (($as && isset($as->assets) ? $as->assets : []) as $x) {
    $insA->execute([
        field($x, 'id'),
        field($x, 'nombre', ''),
        field($x, 'filename', ''),
        field($x, 'path', ''),
        field($x, 'locked') ? 1 : 0,
        field($x, 'mime', null),
        (int) field($x, 'size', 0),
        field($x, 'origen', null),
        jenc(field($x, 'etiquetas', [])),
        field($x, 'creado_en', null),
        field($x, 'editado_en', null),
    ]);
}
$insL = $pdo->prepare('INSERT INTO asset_labels (id, nombre, color, grupo) VALUES (?,?,?,?)');
foreach (($as && isset($as->labels) ? $as->labels : []) as $l) {
    $insL->execute([field($l, 'id'), field($l, 'nombre', ''), field($l, 'color', null), field($l, 'grupo', 'color')]);
}
say('Assets importados: ' . count(Db::all('SELECT id FROM assets')) . ' | Labels: ' . count(Db::all('SELECT id FROM asset_labels')));

// --- 7. logs y webhook ---
$alog = readJsonFile('alertas_log');
$pdo->exec('DELETE FROM alertas_log');
$insAl = $pdo->prepare('INSERT INTO alertas_log (id, k, id_alerta, alerta, date_time_hour, estado, meta) VALUES (?,?,?,?,?,?,?)');
foreach (($alog && isset($alog->alertas) ? $alog->alertas : []) as $x) {
    $insAl->execute([
        field($x, 'id'),
        field($x, 'key', ''),
        (int) field($x, 'id_alerta', 0),
        field($x, 'alerta', null),
        field($x, 'date_time_hour', null),
        field($x, 'estado', null),
        jenc(field($x, 'meta', new stdClass())),
    ]);
}

$clog = readJsonFile('contactos_log');
$pdo->exec('DELETE FROM contactos_log');
$insC = $pdo->prepare('INSERT INTO contactos_log (id, date_time_hour, estado, destino_url, pagina, formulario, campos) VALUES (?,?,?,?,?,?,?)');
foreach (($clog && isset($clog->envios) ? $clog->envios : []) as $x) {
    $insC->execute([
        field($x, 'id'),
        field($x, 'date_time_hour', null),
        field($x, 'estado', null),
        field($x, 'destino_url', null),
        field($x, 'pagina', null),
        field($x, 'formulario', null),
        jenc(field($x, 'campos', new stdClass())),
    ]);
}

$wc = readJsonFile('webhook_cache');
$pdo->exec('DELETE FROM webhook_cache');
$insW = $pdo->prepare('INSERT INTO webhook_cache
  (id_entrada, id_pedido, contenido, contenido_editado, editado, procesado, id_plantilla_asignada, id_seccion_asignada, recibido_en, procesado_en)
  VALUES (?,?,?,?,?,?,?,?,?,?)');
foreach (($wc && isset($wc->entradas) ? $wc->entradas : []) as $x) {
    $insW->execute([
        field($x, 'id_entrada'),
        field($x, 'id_pedido', null),
        jenc(field($x, 'contenido', null)),
        jenc(field($x, 'contenido_editado', null)),
        field($x, 'editado') ? 1 : 0,
        field($x, 'procesado') ? 1 : 0,
        field($x, 'id_plantilla_asignada', null),
        field($x, 'id_seccion_asignada', null),
        field($x, 'recibido_en', null),
        field($x, 'procesado_en', null),
    ]);
}
say('Logs y webhook importados.');

// --- 8. usuario admin (no pisa si ya existe) ---
Db::run('INSERT IGNORE INTO users (usuario, password_hash, role) VALUES (?,?,?)',
    ['admin', password_hash('admin', PASSWORD_BCRYPT), 'admin']);
say('Usuario admin listo (admin / admin).');

say('');
say('Migracion completa.');
