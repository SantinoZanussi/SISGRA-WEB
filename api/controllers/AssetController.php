<?php
// Imágenes (/img) + etiquetas, sobre assets.json. Sincroniza el registro con el disco.

class AssetController {
    const FILE = 'assets';

    private static $MIME_EXT = [
        'image/png' => '.png', 'image/jpeg' => '.jpg', 'image/jpg' => '.jpg',
        'image/gif' => '.gif', 'image/webp' => '.webp', 'image/svg+xml' => '.svg',
        'image/avif' => '.avif',
    ];
    private static $EXT_MIME = [
        'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
        'gif' => 'image/gif', 'webp' => 'image/webp', 'svg' => 'image/svg+xml',
        'avif' => 'image/avif',
    ];
    private static $GRUPOS_VALIDOS = ['color', 'modulo', 'plantilla', 'menu'];
    private static $DEFAULT_LABELS = [
        ['Rojo', '#ef4444'], ['Naranja', '#f97316'], ['Amarillo', '#eab308'], ['Verde', '#22c55e'],
        ['Azul', '#3b82f6'], ['Violeta', '#8b5cf6'], ['Rosa', '#ec4899'], ['Gris', '#64748b'],
    ];

    // ---- carga / guardado ----

    private static function load() {
        $d = Store::read(self::FILE, true);
        if (!is_array($d)) $d = [];
        if (!isset($d['assets']) || !is_array($d['assets'])) $d['assets'] = [];
        if (!isset($d['labels']) || !is_array($d['labels'])) $d['labels'] = [];
        return $d;
    }
    private static function save($d) { Store::write(self::FILE, $d); }

    // ---- utilidades ----

    private static function slugify($s) {
        $s = (string) $s;
        if (function_exists('iconv')) {
            $t = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
            if ($t !== false) $s = $t;
        }
        $s = strtolower(trim($s));
        $s = preg_replace('/[^a-z0-9]+/', '-', $s);
        $s = trim($s, '-');
        return $s !== '' ? $s : 'imagen';
    }

    private static function nombreDesdeArchivo($rel) {
        $base = pathinfo($rel, PATHINFO_FILENAME);
        $base = trim(preg_replace('/[-_]+/', ' ', $base));
        return $base !== '' ? $base : pathinfo($rel, PATHINFO_FILENAME);
    }

    private static function uniqueFilename($assets, $dir, $base, $ext, $exclude = null) {
        $prefix = $dir ? $dir . '/' : '';
        $taken = [];
        foreach ($assets as $a) {
            if (!empty($a['filename']) && $a['filename'] !== $exclude) $taken[$a['filename']] = true;
        }
        $exists = function ($rel) use ($taken, $exclude) {
            return isset($taken[$rel]) || ($rel !== $exclude && file_exists(IMG_DIR . '/' . $rel));
        };
        $candidate = $prefix . $base . $ext;
        $n = 2;
        while ($exists($candidate)) { $candidate = $prefix . $base . '-' . $n . $ext; $n++; }
        return $candidate;
    }

    private static function escanear($dir = null, $baseRel = '') {
        if ($dir === null) $dir = IMG_DIR;
        $out = [];
        if (!is_dir($dir)) return $out;
        foreach (scandir($dir) as $name) {
            if ($name === '.' || $name === '..') continue;
            $rel  = $baseRel ? $baseRel . '/' . $name : $name;
            $full = $dir . '/' . $name;
            if (is_dir($full)) {
                $out = array_merge($out, self::escanear($full, $rel));
            } else {
                $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
                if (isset(self::$EXT_MIME[$ext])) $out[] = $rel;
            }
        }
        return $out;
    }

    // importa nuevas del disco (bloqueadas) y borra huérfanas; muta $d, devuelve si cambió
    private static function sincronizar(&$d) {
        $enDisco = self::escanear();
        $setDisco = array_flip($enDisco);
        $setReg = [];
        foreach ($d['assets'] as $a) $setReg[$a['filename']] = true;
        $changed = false;

        foreach ($enDisco as $rel) {
            if (isset($setReg[$rel])) continue;
            $now = now_iso();
            $ext = strtolower(pathinfo($rel, PATHINFO_EXTENSION));
            $size = @filesize(IMG_DIR . '/' . $rel);
            $d['assets'][] = [
                'id'        => gen_id('img'),
                'nombre'    => self::nombreDesdeArchivo($rel),
                'filename'  => $rel,
                'path'      => '/img/' . $rel,
                'locked'    => true,
                'mime'      => isset(self::$EXT_MIME[$ext]) ? self::$EXT_MIME[$ext] : 'application/octet-stream',
                'size'      => $size ?: 0,
                'origen'    => 'existente',
                'etiquetas' => [],
                'creado_en' => $now,
                'editado_en'=> $now,
            ];
            $changed = true;
        }

        $before = count($d['assets']);
        $d['assets'] = array_values(array_filter($d['assets'], function ($a) use ($setDisco) {
            return isset($setDisco[$a['filename']]);
        }));
        if (count($d['assets']) !== $before) $changed = true;

        return $changed;
    }

    // siembra la paleta la primera vez; muta $d, devuelve si cambió
    private static function seedLabels(&$d) {
        if (count($d['labels'])) return false;
        foreach (self::$DEFAULT_LABELS as $l) {
            $d['labels'][] = ['id' => gen_id('lbl'), 'nombre' => $l[0], 'color' => $l[1], 'grupo' => 'color'];
        }
        return true;
    }

    private static function findAsset(&$d, $id) {
        foreach ($d['assets'] as $i => $a) { if ($a['id'] === $id) return $i; }
        return -1;
    }
    private static function findLabel(&$d, $id) {
        foreach ($d['labels'] as $i => $l) { if ($l['id'] === $id) return $i; }
        return -1;
    }

    private static function assetNorm($a) {
        $a['etiquetas'] = (isset($a['etiquetas']) && is_array($a['etiquetas'])) ? $a['etiquetas'] : [];
        return $a;
    }

    // ---- endpoints ----

    // GET /api/assets
    public static function listar() {
        $d = self::load();
        $changed = self::sincronizar($d);
        $changed = self::seedLabels($d) || $changed;
        if ($changed) self::save($d);

        $orden = ['subida' => 0, 'existente' => 1];
        $assets = array_map([self::class, 'assetNorm'], $d['assets']);
        usort($assets, function ($a, $b) use ($orden) {
            $oa = isset($orden[$a['origen']]) ? $orden[$a['origen']] : 0;
            $ob = isset($orden[$b['origen']]) ? $orden[$b['origen']] : 0;
            if ($oa !== $ob) return $oa - $ob;
            return strcmp((string) (isset($b['creado_en']) ? $b['creado_en'] : ''),
                          (string) (isset($a['creado_en']) ? $a['creado_en'] : ''));
        });
        Http::json(['assets' => $assets, 'labels' => $d['labels']]);
    }

    // POST /api/assets  [auth, multipart]  campo "file" + opcional "nombre"
    public static function subir() {
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            Http::error('No se recibió ningún archivo (campo "file")', 400);
        }
        $file = $_FILES['file'];
        if ($file['size'] > 10 * 1024 * 1024) Http::error('El archivo supera los 10 MB', 400);

        $mime = $file['type'];
        if (!isset(self::$MIME_EXT[$mime])) {
            Http::error("Tipo de archivo no permitido: $mime. Solo imágenes.", 400);
        }
        $ext = self::$MIME_EXT[$mime];

        $d = self::load();
        $nombreBase = (isset($_POST['nombre']) && trim($_POST['nombre']) !== '')
            ? trim($_POST['nombre'])
            : pathinfo($file['name'], PATHINFO_FILENAME);
        $slug = self::slugify($nombreBase);
        $filename = self::uniqueFilename($d['assets'], '', $slug, $ext);

        if (!is_dir(IMG_DIR)) @mkdir(IMG_DIR, 0775, true);
        if (!@move_uploaded_file($file['tmp_name'], IMG_DIR . '/' . $filename)) {
            Http::error('No se pudo guardar el archivo', 500);
        }

        $now = now_iso();
        $asset = [
            'id'        => gen_id('img'),
            'nombre'    => $nombreBase,
            'filename'  => $filename,
            'path'      => '/img/' . $filename,
            'locked'    => false,
            'mime'      => $mime,
            'size'      => (int) $file['size'],
            'origen'    => 'subida',
            'etiquetas' => [],
            'creado_en' => $now,
            'editado_en'=> $now,
        ];
        $d['assets'][] = $asset;
        self::save($d);
        Http::json(['ok' => true, 'asset' => $asset], 201);
    }

    // PATCH /api/assets/:id  [auth]  { nombre }
    public static function renombrar($id) {
        $d = self::load();
        $i = self::findAsset($d, $id);
        if ($i === -1) Http::error('Imagen no encontrada', 404);
        if (!empty($d['assets'][$i]['locked'])) Http::error('La imagen está bloqueada. Desbloqueala para renombrarla.', 403);

        $b = Http::body();
        $nuevoNombre = trim((string) (isset($b['nombre']) ? $b['nombre'] : ''));
        if ($nuevoNombre === '') Http::error('El campo "nombre" es obligatorio', 400);

        $a = $d['assets'][$i];
        $ext = '.' . pathinfo($a['filename'], PATHINFO_EXTENSION);
        $dir = pathinfo($a['filename'], PATHINFO_DIRNAME);
        if ($dir === '.') $dir = '';
        $slug = self::slugify($nuevoNombre);
        $nuevoFilename = self::uniqueFilename($d['assets'], $dir, $slug, $ext, $a['filename']);

        if ($nuevoFilename !== $a['filename']) {
            if (!@rename(IMG_DIR . '/' . $a['filename'], IMG_DIR . '/' . $nuevoFilename)) {
                Http::error('No se pudo renombrar el archivo', 500);
            }
            $a['filename'] = $nuevoFilename;
            $a['path'] = '/img/' . $nuevoFilename;
        }
        $a['nombre'] = $nuevoNombre;
        $a['editado_en'] = now_iso();
        $d['assets'][$i] = $a;
        self::save($d);
        Http::json(['ok' => true, 'asset' => self::assetNorm($a)]);
    }

    // PATCH /api/assets/:id/lock  [auth]
    public static function toggleLock($id) {
        $d = self::load();
        $i = self::findAsset($d, $id);
        if ($i === -1) Http::error('Imagen no encontrada', 404);
        $d['assets'][$i]['locked'] = empty($d['assets'][$i]['locked']);
        $d['assets'][$i]['editado_en'] = now_iso();
        self::save($d);
        Http::json(['ok' => true, 'asset' => self::assetNorm($d['assets'][$i])]);
    }

    // DELETE /api/assets/:id  [auth]
    public static function eliminar($id) {
        $d = self::load();
        $i = self::findAsset($d, $id);
        if ($i === -1) Http::error('Imagen no encontrada', 404);
        if (!empty($d['assets'][$i]['locked'])) Http::error('La imagen está bloqueada. Desbloqueala para eliminarla.', 403);

        $fp = IMG_DIR . '/' . $d['assets'][$i]['filename'];
        if (file_exists($fp) && !@unlink($fp)) Http::error('No se pudo borrar el archivo', 500);
        array_splice($d['assets'], $i, 1);
        self::save($d);
        Http::json(['ok' => true]);
    }

    // PATCH /api/assets/:id/tags  [auth]  { etiquetas: [labelId,...] }
    public static function asignarTags($id) {
        $d = self::load();
        $i = self::findAsset($d, $id);
        if ($i === -1) Http::error('Imagen no encontrada', 404);

        $b = Http::body();
        $entrada = (isset($b['etiquetas']) && is_array($b['etiquetas'])) ? $b['etiquetas'] : [];
        $validas = [];
        foreach ($d['labels'] as $l) $validas[$l['id']] = true;
        $etiquetas = [];
        foreach ($entrada as $e) { if (isset($validas[$e]) && !in_array($e, $etiquetas, true)) $etiquetas[] = $e; }

        $d['assets'][$i]['etiquetas'] = $etiquetas;
        $d['assets'][$i]['editado_en'] = now_iso();
        self::save($d);
        Http::json(['ok' => true, 'asset' => self::assetNorm($d['assets'][$i])]);
    }

    // GET /api/assets/labels  (público)
    public static function listarLabels() {
        $d = self::load();
        if (self::seedLabels($d)) self::save($d);
        Http::json(['labels' => $d['labels']]);
    }

    // POST /api/assets/labels  [auth]  { nombre, color, grupo }
    public static function crearLabel() {
        $b = Http::body();
        $nom = trim((string) (isset($b['nombre']) ? $b['nombre'] : ''));
        if ($nom === '') Http::error('El campo "nombre" es obligatorio', 400);
        $grp = (isset($b['grupo']) && in_array($b['grupo'], self::$GRUPOS_VALIDOS, true)) ? $b['grupo'] : 'color';
        $col = trim((string) (isset($b['color']) ? $b['color'] : '')) ?: '#64748b';

        $d = self::load();
        $label = ['id' => gen_id('lbl'), 'nombre' => $nom, 'color' => $col, 'grupo' => $grp];
        $d['labels'][] = $label;
        self::save($d);
        Http::json(['ok' => true, 'label' => $label], 201);
    }

    // PATCH /api/assets/labels/:id  [auth]
    public static function editarLabel($id) {
        $d = self::load();
        $i = self::findLabel($d, $id);
        if ($i === -1) Http::error('Etiqueta no encontrada', 404);

        $b = Http::body();
        if (isset($b['nombre']) && is_string($b['nombre']) && trim($b['nombre']) !== '') $d['labels'][$i]['nombre'] = trim($b['nombre']);
        if (isset($b['color']) && is_string($b['color']) && trim($b['color']) !== '') $d['labels'][$i]['color'] = trim($b['color']);
        if (isset($b['grupo']) && in_array($b['grupo'], self::$GRUPOS_VALIDOS, true)) $d['labels'][$i]['grupo'] = $b['grupo'];

        self::save($d);
        Http::json(['ok' => true, 'label' => $d['labels'][$i]]);
    }

    // DELETE /api/assets/labels/:id  [auth]  borra la etiqueta y la quita de las imágenes
    public static function eliminarLabel($id) {
        $d = self::load();
        $i = self::findLabel($d, $id);
        if ($i === -1) Http::error('Etiqueta no encontrada', 404);

        array_splice($d['labels'], $i, 1);
        foreach ($d['assets'] as $k => $a) {
            if (isset($a['etiquetas']) && is_array($a['etiquetas']) && in_array($id, $a['etiquetas'], true)) {
                $d['assets'][$k]['etiquetas'] = array_values(array_filter($a['etiquetas'], function ($e) use ($id) { return $e !== $id; }));
            }
        }
        self::save($d);
        Http::json(['ok' => true]);
    }
}
