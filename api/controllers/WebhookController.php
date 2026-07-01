<?php
// Cache de contenido recibido desde la API PRES. El editor lo revisa y publica.

class WebhookController {
    const FILE = 'webhook_cache';

    private static function readCache() {
        $d = Store::read(self::FILE, true);
        if (!is_array($d) || !isset($d['entradas']) || !is_array($d['entradas'])) return ['entradas' => []];
        return $d;
    }

    // POST /api/webhook/pres  (público)
    public static function recibirWebhook() {
        $b   = Http::body();
        $obj = Http::bodyObject();
        $id_pedido = isset($b['id_pedido']) ? $b['id_pedido'] : null;
        $contenido = isset($obj->contenido) ? $obj->contenido : null;
        if (!$id_pedido) Http::error('Se requiere id_pedido', 400);
        if ($contenido === null || $contenido === '') Http::error('Se requiere contenido', 400);

        $entrada = [
            'id_entrada'            => gen_id('wh'),
            'id_pedido'             => $id_pedido,
            'contenido'             => $contenido,
            'contenido_editado'     => null,
            'editado'               => false,
            'procesado'             => false,
            'id_plantilla_asignada' => null,
            'id_seccion_asignada'   => null,
            'recibido_en'           => now_iso(),
            'procesado_en'          => null,
        ];
        $cache = self::readCache();
        $cache['entradas'][] = $entrada;
        Store::write(self::FILE, $cache);
        Http::json(['ok' => true, 'id_entrada' => $entrada['id_entrada']], 201);
    }

    // GET /api/webhook/cache  [auth]  ?procesado=true|false
    public static function listarCache() {
        $q = Http::query();
        $entradas = self::readCache()['entradas'];
        if (isset($q['procesado'])) {
            $flag = ($q['procesado'] === 'true');
            $entradas = array_values(array_filter($entradas, function ($e) use ($flag) {
                return !empty($e['procesado']) === $flag;
            }));
        }
        Http::json(['entradas' => $entradas]);
    }

    // GET /api/webhook/cache/:id  [auth]
    public static function obtenerEntrada($id) {
        foreach (self::readCache()['entradas'] as $e) {
            if ($e['id_entrada'] === $id) Http::json($e);
        }
        Http::error('Entrada no encontrada', 404);
    }

    // PATCH /api/webhook/cache/:id  [auth]  edita el contenido antes de publicar
    public static function editarEntrada($id) {
        $obj = Http::bodyObject();
        if (!property_exists($obj, 'contenido_editado')) Http::error('Se requiere contenido_editado', 400);

        $cache = self::readCache();
        $idx = self::findIdx($cache['entradas'], $id);
        if ($idx === -1) Http::error('Entrada no encontrada', 404);

        $cache['entradas'][$idx]['contenido_editado'] = $obj->contenido_editado;
        $cache['entradas'][$idx]['editado'] = true;
        Store::write(self::FILE, $cache);
        Http::json(['ok' => true, 'entrada' => $cache['entradas'][$idx]]);
    }

    // POST /api/webhook/cache/:id/publicar  [auth]
    // En v2 las plantillas no tienen contenido.secciones embebido, así que no hay
    // sección donde aplicar (se conserva por compatibilidad con la API PRES).
    public static function publicarEntrada($id) {
        $b = Http::body();
        $id_plantilla = isset($b['id_plantilla']) ? $b['id_plantilla'] : null;
        $id_seccion   = isset($b['id_seccion']) ? $b['id_seccion'] : null;
        if (!$id_plantilla) Http::error('Se requiere id_plantilla', 400);
        if (!$id_seccion)   Http::error('Se requiere id_seccion', 400);

        if (self::findIdx(self::readCache()['entradas'], $id) === -1) Http::error('Entrada no encontrada', 404);

        $existe = false;
        foreach (Store::coll('plantillas', 'plantillas') as $p) {
            if ((int) $p['id_plantilla'] === (int) $id_plantilla) { $existe = true; break; }
        }
        if (!$existe) Http::error('Plantilla no encontrada', 404);

        Http::error('Sección no encontrada en la plantilla', 404);
    }

    // DELETE /api/webhook/cache/:id  [auth]
    public static function eliminarEntrada($id) {
        $cache = self::readCache();
        $antes = count($cache['entradas']);
        $cache['entradas'] = array_values(array_filter($cache['entradas'], function ($e) use ($id) {
            return $e['id_entrada'] !== $id;
        }));
        if (count($cache['entradas']) === $antes) Http::error('Entrada no encontrada', 404);
        Store::write(self::FILE, $cache);
        Http::json(['ok' => true]);
    }

    private static function findIdx($entradas, $id) {
        foreach ($entradas as $i => $e) { if ($e['id_entrada'] === $id) return $i; }
        return -1;
    }
}
