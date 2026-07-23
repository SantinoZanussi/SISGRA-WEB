<?php
// CRUD genérico sobre los documentos JSON editables. `modulos` y `navbar` son los
// mismos archivos que usan /api/modulos y /api/nav, así que no hay doble fuente.

class DataController {

    // GET /api/data/:file  (público) — devuelve el archivo tal cual
    public static function getFile($file) {
        if (!Store::isAllowed($file)) Http::error('Archivo no encontrado', 404);
        $raw = Store::readRaw($file);
        if ($raw === null) Http::error('Archivo no encontrado', 404);
        Http::rawJson($raw);
    }

    // PUT /api/data/:file  [auth]  reemplaza el documento completo
    public static function updateFile($file) {
        if (!Store::isAllowed($file)) Http::error('Archivo no encontrado', 404);
        // objeto (assoc=false) para no aplastar los {} a []
        $body = Http::bodyObject();
        if (!is_object($body) && !is_array($body)) Http::error('Body inválido', 400);
        try {
            Store::write($file, $body);
            Http::json(['ok' => true, 'data' => $body]);
        } catch (Exception $e) {
            Http::error('Error al guardar', 500, ['detail' => $e->getMessage()]);
        }
    }

    // POST /api/data/:file/:collection  [auth]  agrega un item al array
    public static function createItem($file, $collection) {
        if (!Store::isAllowed($file)) Http::error('Archivo no encontrado', 404);
        $data = Store::read($file, true);
        if ($data === null) Http::error('Archivo no encontrado', 404);
        if (!isset($data[$collection]) || !is_array($data[$collection])) {
            Http::error("\"$collection\" no es un array", 400);
        }

        $newItem = Http::body();
        $newItem['id'] = substr($collection, 0, 2) . '-' . now_ms();
        $data[$collection][] = $newItem;
        Store::write($file, $data);
        Http::json(['ok' => true, 'item' => $newItem], 201);
    }

    // PATCH /api/data/:file/:collection/:id  [auth]
    public static function updateItem($file, $collection, $id) {
        if (!Store::isAllowed($file)) Http::error('Archivo no encontrado', 404);
        $data = Store::read($file, true);
        if ($data === null || !isset($data[$collection]) || !is_array($data[$collection])) {
            Http::error('Colección no encontrada', 404);
        }

        $idx = self::findById($data[$collection], $id);
        if ($idx === -1) Http::error('Item no encontrado', 404);

        $data[$collection][$idx] = array_merge($data[$collection][$idx], Http::body());
        Store::write($file, $data);
        Http::json(['ok' => true, 'item' => $data[$collection][$idx]]);
    }

    // DELETE /api/data/:file/:collection/:id  [auth]
    public static function deleteItem($file, $collection, $id) {
        if (!Store::isAllowed($file)) Http::error('Archivo no encontrado', 404);
        $data = Store::read($file, true);
        if ($data === null || !isset($data[$collection]) || !is_array($data[$collection])) {
            Http::error('Colección no encontrada', 404);
        }

        $before = count($data[$collection]);
        $data[$collection] = array_values(array_filter(
            $data[$collection],
            function ($i) use ($id) { return (isset($i['id']) ? $i['id'] : null) !== $id; }
        ));
        if (count($data[$collection]) === $before) Http::error('Item no encontrado', 404);

        Store::write($file, $data);
        Http::json(['ok' => true]);
    }

    // GET /api/meta/ultima-edicion  [auth]
    // mtime mas reciente entre los JSON de contenido; los logs y backups no cuentan como edicion
    public static function ultimaEdicion() {
        $ignorar = ['users', 'alertas_log', 'contactos_log', 'webhook_cache', 'plantillas_backup'];
        $ultima  = 0;
        $archivo = null;
        foreach (glob(DATA_DIR . '/*.json') as $fp) {
            $name = basename($fp, '.json');
            if (in_array($name, $ignorar, true)) continue;
            $mt = filemtime($fp);
            if ($mt && $mt > $ultima) { $ultima = $mt; $archivo = $name; }
        }
        Http::json([
            'fecha'   => $ultima ? iso_from_ms($ultima * 1000) : null,
            'archivo' => $archivo,
        ]);
    }

    private static function findById($arr, $id) {
        foreach ($arr as $i => $item) {
            if ((isset($item['id']) ? $item['id'] : null) === $id) return $i;
        }
        return -1;
    }
}
