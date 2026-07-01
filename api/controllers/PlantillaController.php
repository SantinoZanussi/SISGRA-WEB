<?php
// Plantillas: punteros a módulos + vigencia. id_plantilla numérico (v2). Sobre plantillas.json.

class PlantillaController {

    private static $TIPOS_BASE = [
        'index', 'blog', 'articulo', 'cliente',
        'cableado', 'fibra', 'seguridad', 'soporte', 'desarrollo',
        'contacto', 'obras', 'sectores', 'pres',
        '404',
    ];

    private static function isTipoValido($tipo) {
        return in_array($tipo, self::$TIPOS_BASE, true) || preg_match('/^btn-/', (string) $tipo);
    }

    private static function tipoInvalidoMsg() {
        return 'Tipo inválido. Valores base: ' . implode(', ', self::$TIPOS_BASE) . ' (o btn-*)';
    }

    // ---- normalización de contenedores / id_modulos ----

    private static function isList($a) {
        if (!is_array($a)) return false;
        return $a === [] || array_keys($a) === range(0, count($a) - 1);
    }

    private static function esInline($x) {
        return is_array($x) && isset($x['inline']) && $x['inline'] === true;
    }

    private static function flatten($conts) {
        $out = [];
        foreach ((array) $conts as $c) {
            if (!is_array($c)) continue;
            foreach ($c as $n) {
                if (!self::esInline($n) && is_numeric($n)) $out[] = $n + 0;
            }
        }
        return $out;
    }

    private static function sanitize($conts) {
        if (!is_array($conts)) return null;
        $out = [];
        foreach ($conts as $c) {
            if (is_array($c) && self::isList($c)) {
                $row = [];
                foreach ($c as $x) {
                    if (self::esInline($x))   $row[] = $x;
                    elseif (is_numeric($x))   $row[] = $x + 0;
                }
                $out[] = $row;
            } else {
                $out[] = [];
            }
        }
        return $out;
    }

    // asegura contenedores válido e id_modulos en sync (migra datos viejos a 1x1)
    private static function normalizar(&$p) {
        $conts = self::sanitize(isset($p['contenedores']) ? $p['contenedores'] : null);
        if ($conts === null) {
            $conts = [];
            foreach ((isset($p['id_modulos']) && is_array($p['id_modulos']) ? $p['id_modulos'] : []) as $id) {
                $conts[] = [$id + 0];
            }
        }
        $p['contenedores'] = $conts;
        $p['id_modulos']   = self::flatten($conts);
    }

    // lista normalizada (misma semántica que el read() del backend viejo)
    private static function load() {
        $doc = Store::read('plantillas', true);
        $list = (is_array($doc) && isset($doc['plantillas']) && is_array($doc['plantillas'])) ? $doc['plantillas'] : [];
        foreach ($list as &$p) self::normalizar($p);
        unset($p);
        return $list;
    }

    private static function save($list) {
        Store::write('plantillas', ['plantillas' => array_values($list)]);
    }

    private static function nextId($list) {
        $max = 0;
        foreach ($list as $p) { $n = (int) $p['id_plantilla']; if ($n > $max) $max = $n; }
        return $max + 1;
    }

    private static function findIdx($list, $id) {
        foreach ($list as $i => $p) { if ((int) $p['id_plantilla'] === (int) $id) return $i; }
        return -1;
    }

    // vincula una página btn-* sin href a su item del navbar apuntando al shell /p/<tipo>
    private static function vincularHrefNav($tipo, $idMenuArr) {
        if (!preg_match('/^btn-/', (string) $tipo) || !is_array($idMenuArr) || !count($idMenuArr)) return;
        $doc = Store::read('navbar', true);
        if (!is_array($doc) || !isset($doc['botones']) || !is_array($doc['botones'])) return;
        $ids = array_map('intval', $idMenuArr);
        $changed = false;
        foreach ($doc['botones'] as &$b) {
            if (in_array((int) $b['id_menu'], $ids, true) && empty($b['href'])) {
                $b['href'] = '/p/' . $tipo;
                $changed = true;
            }
        }
        unset($b);
        if ($changed) Store::write('navbar', $doc);
    }

    // ---- endpoints ----

    // GET /api/plantillas?tipo=index
    public static function listar() {
        $q = Http::query();
        $list = self::load();
        if (!empty($q['tipo'])) {
            $tipo = $q['tipo'];
            $list = array_values(array_filter($list, function ($p) use ($tipo) { return $p['tipo'] === $tipo; }));
        }
        Http::json(['plantillas' => $list]);
    }

    // GET /api/plantillas/tipos
    public static function listarTipos() {
        Http::json(['tipos' => self::$TIPOS_BASE]);
    }

    // GET /api/plantillas/activa/:tipo  (público)
    public static function activaPorTipo($tipo) {
        if (!self::isTipoValido($tipo)) Http::error("Tipo inválido: $tipo", 400);
        foreach (self::load() as $p) {
            if ($p['tipo'] === $tipo && !empty($p['activa'])) Http::json(['plantilla' => $p]);
        }
        Http::error('No hay plantilla activa para este tipo', 404);
    }

    // GET /api/plantillas/:id
    public static function obtener($id) {
        foreach (self::load() as $p) {
            if ((int) $p['id_plantilla'] === (int) $id) Http::json(['plantilla' => $p]);
        }
        Http::error('Plantilla no encontrada', 404);
    }

    // POST /api/plantillas  [auth]
    public static function crear() {
        $b = Http::body();
        $tipo = isset($b['tipo']) ? $b['tipo'] : null;
        if (!$tipo) Http::error('El campo "tipo" es obligatorio', 400);
        if (!self::isTipoValido($tipo)) Http::error(self::tipoInvalidoMsg(), 400);
        $nombre = isset($b['nombre']) ? $b['nombre'] : null;
        if (!$nombre || trim($nombre) === '') Http::error('El campo "nombre" es obligatorio', 400);

        $list  = self::load();
        $nowMs = now_ms();
        $now   = iso_from_ms($nowMs);
        $fin   = iso_from_ms($nowMs + SIETE_DIAS_MS);

        $p = [
            'id_plantilla' => self::nextId($list),
            'tipo'         => $tipo,
            'nombre'       => trim($nombre),
            'descripcion'  => isset($b['descripcion']) ? $b['descripcion'] : '',
            'activa'       => false,
            'fecha_inicio' => $now,
            'fecha_fin'    => $fin,
            'id_menu'      => is_array(isset($b['id_menu']) ? $b['id_menu'] : null) ? $b['id_menu'] : [],
            'id_modulos'   => is_array(isset($b['id_modulos']) ? $b['id_modulos'] : null) ? $b['id_modulos'] : [],
            'contenedores' => is_array(isset($b['contenedores']) ? $b['contenedores'] : null) ? $b['contenedores'] : null,
            'creado_en'    => $now,
            'editado_en'   => $now,
        ];
        self::normalizar($p);
        $list[] = $p;
        self::save($list);
        self::vincularHrefNav($p['tipo'], $p['id_menu']);
        Http::json(['ok' => true, 'plantilla' => $p], 201);
    }

    // PATCH /api/plantillas/:id  [auth]
    public static function actualizar($id) {
        $list = self::load();
        $idx = self::findIdx($list, $id);
        if ($idx === -1) Http::error('Plantilla no encontrada', 404);

        $b = Http::body();
        if (array_key_exists('tipo', $b) && !self::isTipoValido($b['tipo'])) {
            Http::error(self::tipoInvalidoMsg(), 400);
        }

        $p = $list[$idx];
        if (array_key_exists('tipo', $b))        $p['tipo'] = $b['tipo'];
        if (array_key_exists('nombre', $b))      $p['nombre'] = trim((string) $b['nombre']);
        if (array_key_exists('descripcion', $b)) $p['descripcion'] = $b['descripcion'];
        if (is_array(isset($b['id_menu']) ? $b['id_menu'] : null)) $p['id_menu'] = $b['id_menu'];

        $hasCont = is_array(isset($b['contenedores']) ? $b['contenedores'] : null);
        $hasMods = is_array(isset($b['id_modulos']) ? $b['id_modulos'] : null);
        if ($hasCont) {
            $p['contenedores'] = $b['contenedores'];
        } elseif ($hasMods) {
            $p['contenedores'] = array_map(function ($x) { return [$x]; }, $b['id_modulos']);
        }
        if ($hasCont || $hasMods) self::normalizar($p);
        $p['editado_en'] = now_iso();

        $list[$idx] = $p;
        self::save($list);
        Http::json(['ok' => true, 'plantilla' => $p]);
    }

    // POST /api/plantillas/:id/activar  [auth]
    public static function activar($id) {
        $list = self::load();
        $idx = self::findIdx($list, $id);
        if ($idx === -1) Http::error('Plantilla no encontrada', 404);

        $tipo  = $list[$idx]['tipo'];
        $nowMs = now_ms();
        $now   = iso_from_ms($nowMs);
        $fin   = iso_from_ms($nowMs + SIETE_DIAS_MS);

        foreach ($list as $i => $p) {
            if ($p['tipo'] === $tipo) $list[$i]['activa'] = ($i === $idx);
        }
        $list[$idx]['fecha_inicio'] = $now;
        $list[$idx]['fecha_fin']    = $fin;
        $list[$idx]['editado_en']   = $now;

        self::save($list);
        Http::json(['ok' => true, 'plantilla' => $list[$idx]]);
    }

    // POST /api/plantillas/:id/extender  [auth]
    public static function extender($id) {
        $list = self::load();
        $idx = self::findIdx($list, $id);
        if ($idx === -1) Http::error('Plantilla no encontrada', 404);

        $ff = isset($list[$idx]['fecha_fin']) ? $list[$idx]['fecha_fin'] : null;
        $base = $ff ? max(now_ms(), iso_to_ms($ff)) : now_ms();
        $list[$idx]['fecha_fin']  = iso_from_ms($base + SIETE_DIAS_MS);
        $list[$idx]['editado_en'] = now_iso();

        self::save($list);
        Http::json(['ok' => true, 'plantilla' => $list[$idx]]);
    }

    // DELETE /api/plantillas/:id  [auth]
    public static function eliminar($id) {
        $list = self::load();
        $idx = self::findIdx($list, $id);
        if ($idx === -1) Http::error('Plantilla no encontrada', 404);

        $tipo   = $list[$idx]['tipo'];
        $activa = !empty($list[$idx]['activa']);
        $promoted = null;

        if ($activa) {
            $otras = [];
            foreach ($list as $p) {
                if ($p['tipo'] === $tipo && (int) $p['id_plantilla'] !== (int) $id) $otras[] = $p;
            }
            if (count($otras) === 0) {
                Http::error("No se puede eliminar: es la única plantilla para \"$tipo\". Creá otra antes de borrar esta.", 400);
            }
            usort($otras, function ($a, $b) {
                return strcmp((string) (isset($b['editado_en']) ? $b['editado_en'] : ''),
                              (string) (isset($a['editado_en']) ? $a['editado_en'] : ''));
            });
            $promoted = $otras[0];

            $nowMs = now_ms();
            $now   = iso_from_ms($nowMs);
            $fin   = iso_from_ms($nowMs + SIETE_DIAS_MS);
            foreach ($list as $i => $p) {
                if ($p['tipo'] === $tipo) {
                    $list[$i]['activa'] = ((int) $p['id_plantilla'] === (int) $promoted['id_plantilla']);
                    if ($list[$i]['activa']) {
                        $list[$i]['fecha_inicio'] = $now;
                        $list[$i]['fecha_fin']    = $fin;
                        $list[$i]['editado_en']   = $now;
                    }
                }
            }
        }

        $list = array_values(array_filter($list, function ($p) use ($id) {
            return (int) $p['id_plantilla'] !== (int) $id;
        }));
        self::save($list);
        Http::json([
            'ok'           => true,
            'wasActive'    => $activa,
            'tipoAffected' => $tipo,
            'promoted'     => $promoted
                ? ['id_plantilla' => (int) $promoted['id_plantilla'], 'nombre' => $promoted['nombre']]
                : null,
        ]);
    }
}
