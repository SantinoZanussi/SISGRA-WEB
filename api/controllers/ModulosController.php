<?php
// Catálogo plano de módulos (CRUD por id_modulo numérico) sobre modulos.json.
// Se lee/escribe como objeto (assoc=false) para conservar los data/design {} vacíos.

class ModulosController {

    // normaliza la página asignada: null, 'all', array de ids, id suelto o texto legacy
    public static function normPagina($v) {
        if ($v === null || $v === '') return null;
        if (is_array($v)) {
            $ids = [];
            foreach ($v as $x) { if (is_numeric($x)) $ids[] = $x + 0; }
            $ids = array_values(array_unique($ids));
            return count($ids) ? $ids : null;
        }
        return is_numeric($v) ? $v + 0 : (string) $v;
    }

    // documento {modulos:[...]} como stdClass (conserva {}); sus items son objetos
    private static function loadDoc() {
        $doc = Store::read('modulos', false);
        if (!is_object($doc)) $doc = new stdClass();
        if (!isset($doc->modulos) || !is_array($doc->modulos)) $doc->modulos = [];
        return $doc;
    }

    private static function plantillasQueUsan($id) {
        $out = [];
        foreach (Store::coll('plantillas', 'plantillas') as $p) {
            $ids = isset($p['id_modulos']) && is_array($p['id_modulos']) ? array_map('intval', $p['id_modulos']) : [];
            if (in_array((int) $id, $ids, true)) {
                $out[] = ['id_plantilla' => $p['id_plantilla'], 'nombre' => $p['nombre'], 'tipo' => $p['tipo']];
            }
        }
        return $out;
    }

    private static function nextId($mods) {
        $max = 0;
        foreach ($mods as $m) { $n = (int) $m->id_modulo; if ($n > $max) $max = $n; }
        return $max + 1;
    }

    private static function find($mods, $id) {
        foreach ($mods as $m) { if ((int) $m->id_modulo === (int) $id) return $m; }
        return null;
    }

    // GET /api/modulos  — devuelve el archivo tal cual
    public static function listar() {
        $raw = Store::readRaw('modulos');
        if ($raw === null) Http::json(['modulos' => []]);
        Http::rawJson($raw);
    }

    // GET /api/modulos/:id
    public static function obtener($id) {
        $m = self::find(self::loadDoc()->modulos, $id);
        if (!$m) Http::error('Módulo no encontrado', 404);
        Http::json(['modulo' => $m]);
    }

    // GET /api/modulos/:id/usos
    public static function usos($id) {
        Http::json(['usos' => self::plantillasQueUsan((int) $id)]);
    }

    // POST /api/modulos  [auth]
    public static function crear() {
        $b   = Http::body();
        $obj = Http::bodyObject();

        $tipo = isset($b['tipo']) ? $b['tipo'] : null;
        if (!$tipo) Http::error('El campo "tipo" es obligatorio', 400);
        $nombre = isset($b['nombre']) ? trim((string) $b['nombre']) : '';
        if ($nombre === '') Http::error('El campo "nombre" es obligatorio', 400);

        $doc = self::loadDoc();
        $now = now_iso();
        $m = new stdClass();
        $m->id_modulo  = self::nextId($doc->modulos);
        $m->tipo       = $tipo;
        $m->nombre     = $nombre;
        $m->id_pagina  = self::normPagina(isset($b['id_pagina']) ? $b['id_pagina'] : null);
        $m->data       = isset($obj->data)   ? $obj->data   : new stdClass();
        $m->design     = isset($obj->design) ? $obj->design : new stdClass();
        $m->alerta     = (isset($b['alerta']) && $b['alerta'] === true);
        $m->creado_en  = $now;
        $m->editado_en = $now;

        $doc->modulos[] = $m;
        Store::write('modulos', $doc);
        Http::json(['ok' => true, 'modulo' => $m], 201);
    }

    // PUT /api/modulos/:id  [auth]
    public static function actualizar($id) {
        $doc = self::loadDoc();
        $m = self::find($doc->modulos, $id);
        if (!$m) Http::error('Módulo no encontrado', 404);

        $b   = Http::body();
        $obj = Http::bodyObject();
        if (array_key_exists('tipo', $b))      $m->tipo      = $b['tipo'];
        if (array_key_exists('nombre', $b))    $m->nombre    = trim((string) $b['nombre']);
        if (array_key_exists('id_pagina', $b)) $m->id_pagina = self::normPagina($b['id_pagina']);
        if (array_key_exists('data', $b))      $m->data      = isset($obj->data) ? $obj->data : null;
        if (array_key_exists('design', $b))    $m->design    = isset($obj->design) ? $obj->design : null;
        if (array_key_exists('alerta', $b))    $m->alerta    = ($b['alerta'] === true);
        $m->editado_en = now_iso();

        Store::write('modulos', $doc);
        Http::json(['ok' => true, 'modulo' => $m]);
    }

    // DELETE /api/modulos/:id  [auth]
    public static function eliminar($id) {
        $id  = (int) $id;
        $doc = self::loadDoc();
        if (!self::find($doc->modulos, $id)) Http::error('Módulo no encontrado', 404);

        $usos = self::plantillasQueUsan($id);
        if (count($usos)) {
            $nombres = array_map(function ($u) { return $u['nombre']; }, $usos);
            Http::error(
                'No se puede eliminar: lo usan ' . count($usos) . ' plantilla(s): ' . implode(', ', $nombres),
                400, ['usos' => $usos]
            );
        }

        $doc->modulos = array_values(array_filter($doc->modulos, function ($m) use ($id) {
            return (int) $m->id_modulo !== $id;
        }));
        Store::write('modulos', $doc);
        Http::json(['ok' => true]);
    }
}
