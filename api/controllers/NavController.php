<?php
// Navbar en árbol (padre = id_menu del padre; 0 = raíz). Sobre navbar.json,
// tocando plantillas.json cuando hace falta (páginas custom / desvincular).

class NavController {

    private static function loadBotones() {
        return Store::coll('navbar', 'botones');
    }
    private static function saveBotones($botones) {
        Store::write('navbar', ['botones' => array_values($botones)]);
    }

    private static function loadPlantillas() {
        $doc = Store::read('plantillas', true);
        return (is_array($doc) && isset($doc['plantillas']) && is_array($doc['plantillas'])) ? $doc['plantillas'] : [];
    }
    private static function savePlantillas($list) {
        Store::write('plantillas', ['plantillas' => array_values($list)]);
    }

    // ---- helpers de plantilla vinculada ----

    private static function idxPlantillaDeMenu($plts, $idMenu) {
        foreach ($plts as $i => $p) {
            $ids = isset($p['id_menu']) && is_array($p['id_menu']) ? array_map('intval', $p['id_menu']) : [];
            if (in_array((int) $idMenu, $ids, true)) return $i;
        }
        return -1;
    }

    private static function esCustom($p) {
        return $p && preg_match('/^btn-/', (string) $p['tipo']);
    }

    // ---- helpers del árbol ----

    private static function findIdx($botones, $idMenu) {
        foreach ($botones as $i => $b) { if ((int) $b['id_menu'] === (int) $idMenu) return $i; }
        return -1;
    }

    private static function padreTitulo($boton, $botones) {
        if (empty($boton['padre'])) return null;
        foreach ($botones as $b) {
            if ((int) $b['id_menu'] === (int) $boton['padre']) return $b['titulo'];
        }
        return null;
    }

    private static function tieneHijos($idMenu, $botones) {
        foreach ($botones as $x) {
            if ((int) (isset($x['padre']) ? $x['padre'] : 0) === (int) $idMenu) return true;
        }
        return false;
    }

    private static function nextMenuId($botones) {
        $max = 0;
        foreach ($botones as $b) $max = max($max, (int) $b['id_menu']);
        return $max + 1;
    }

    // valida `padre`: 0, o el id de otro item que no sea el mismo ni un descendiente
    private static function validarPadre($botones, $padre, $idPropio) {
        $id = (int) $padre;
        if ($id === 0) return 0;
        if ($id === $idPropio) return null;
        if (self::findIdx($botones, $id) === -1) return null;

        $cur = $id;
        $vistos = [];
        while ($cur && !in_array($cur, $vistos, true)) {
            $vistos[] = $cur;
            if ($cur === $idPropio) return null;
            $i = self::findIdx($botones, $cur);
            $cur = $i === -1 ? 0 : (int) $botones[$i]['padre'];
        }
        return $id;
    }

    // orden único y contiguo 1..N; con (idMover, destino) reubica, sino solo normaliza
    private static function reordenar(&$botones, $idMover, $destino) {
        $ordenados = $botones;
        usort($ordenados, function ($a, $b) { return ((int) $a['orden']) - ((int) $b['orden']); });

        if ($idMover !== null && $destino !== null) {
            $i = -1;
            foreach ($ordenados as $k => $b) { if ((int) $b['id_menu'] === (int) $idMover) { $i = $k; break; } }
            if ($i !== -1) {
                $item = array_splice($ordenados, $i, 1)[0];
                $pos  = min(max((int) $destino ?: 1, 1), count($ordenados) + 1) - 1;
                array_splice($ordenados, $pos, 0, [$item]);
            }
        }

        $ordenMap = [];
        foreach ($ordenados as $idx => $b) $ordenMap[(int) $b['id_menu']] = $idx + 1;
        foreach ($botones as &$b) $b['orden'] = $ordenMap[(int) $b['id_menu']];
        unset($b);
    }

    private static function borrarShellCustom($tipo) {
        $dir = HTML_DIR . '/' . $tipo;
        if (is_dir($dir)) self::rrmdir($dir);
    }

    private static function rrmdir($dir) {
        foreach (scandir($dir) as $f) {
            if ($f === '.' || $f === '..') continue;
            $path = $dir . '/' . $f;
            is_dir($path) ? self::rrmdir($path) : @unlink($path);
        }
        @rmdir($dir);
    }

    // ---- endpoints ----

    // GET /api/nav/botones
    public static function listarBotones() {
        $botones = self::loadBotones();
        $plts    = self::loadPlantillas();
        $out = [];
        foreach ($botones as $b) {
            $i = self::idxPlantillaDeMenu($plts, $b['id_menu']);
            $p = $i === -1 ? null : $plts[$i];
            $out[] = array_merge($b, [
                'padreTitulo' => self::padreTitulo($b, $botones),
                'tieneHijos'  => self::tieneHijos($b['id_menu'], $botones),
                'esCustom'    => (bool) self::esCustom($p),
                'plantilla'   => $p ? ['id' => (int) $p['id_plantilla'], 'nombre' => $p['nombre'], 'tipo' => $p['tipo']] : null,
            ]);
        }
        Http::json(['botones' => $out]);
    }

    // POST /api/nav/botones  [auth]
    public static function crearBoton() {
        $b = Http::body();
        $titulo = isset($b['titulo']) ? $b['titulo'] : null;
        if (!$titulo || trim($titulo) === '') Http::error('El campo "titulo" es obligatorio', 400);

        $botones = self::loadBotones();
        $padreId = self::validarPadre($botones, isset($b['padre']) ? $b['padre'] : null, -1);
        if ($padreId === null) Http::error('El "padre" indicado no existe', 400);

        $id_menu = self::nextMenuId($botones);
        $nuevo = [
            'id_menu' => $id_menu,
            'titulo'  => trim($titulo),
            'padre'   => $padreId,
            'menu'    => 'CE',
            'href'    => null,
            'orden'   => count($botones) + 1,
            'activo'  => array_key_exists('activo', $b) ? (bool) $b['activo'] : true,
        ];
        $botones[] = $nuevo;
        self::reordenar($botones, $id_menu, array_key_exists('orden', $b) ? (int) $b['orden'] : null);
        self::saveBotones($botones);

        $final = $botones[self::findIdx($botones, $id_menu)];
        Http::json(['ok' => true, 'boton' => array_merge($final, ['padreTitulo' => self::padreTitulo($final, $botones)])], 201);
    }

    // PATCH /api/nav/botones/:id  [auth]
    public static function actualizarBoton($id) {
        $id = (int) $id;
        $botones = self::loadBotones();
        $idx = self::findIdx($botones, $id);
        if ($idx === -1) Http::error('Ítem no encontrado', 404);

        $b = Http::body();
        if (array_key_exists('titulo', $b)) $botones[$idx]['titulo'] = $b['titulo'];
        if (array_key_exists('activo', $b)) $botones[$idx]['activo'] = (bool) $b['activo'];

        if (array_key_exists('padre', $b)) {
            $padreId = self::validarPadre($botones, $b['padre'], $id);
            if ($padreId === null) Http::error('Padre inválido: no existe o crea un ciclo', 400);
            $botones[$idx]['padre'] = $padreId;
        }
        if (array_key_exists('orden', $b)) {
            self::reordenar($botones, $id, (int) $b['orden']);
        }

        self::saveBotones($botones);
        $final = $botones[self::findIdx($botones, $id)];
        Http::json(['ok' => true, 'boton' => array_merge($final, ['padreTitulo' => self::padreTitulo($final, $botones)])]);
    }

    // DELETE /api/nav/botones/:id  [auth]
    public static function eliminarBoton($id) {
        $id = (int) $id;
        $botones = self::loadBotones();
        $idx = self::findIdx($botones, $id);
        if ($idx === -1) Http::error('Ítem no encontrado', 404);

        $plts = self::loadPlantillas();
        $pi = self::idxPlantillaDeMenu($plts, $id);
        $p = $pi === -1 ? null : $plts[$pi];
        $plantillaEliminada = null;

        if (self::esCustom($p)) {
            $plantillaEliminada = $p['nombre'];
            $tipo = $p['tipo'];
            unset($plts[$pi]);
            self::savePlantillas($plts);
            self::borrarShellCustom($tipo);
        } elseif ($p) {
            // página del sistema: desvincular el id_menu, conservar la plantilla
            $ids = isset($p['id_menu']) && is_array($p['id_menu']) ? $p['id_menu'] : [];
            $plts[$pi]['id_menu'] = array_values(array_filter($ids, function ($m) use ($id) { return (int) $m !== $id; }));
            self::savePlantillas($plts);
        }

        // saca el item y sube sus hijos a la raíz
        array_splice($botones, $idx, 1);
        foreach ($botones as &$x) {
            if ((int) (isset($x['padre']) ? $x['padre'] : 0) === $id) $x['padre'] = 0;
        }
        unset($x);
        self::reordenar($botones, null, null);
        self::saveBotones($botones);

        Http::json(['ok' => true, 'plantillaEliminada' => $plantillaEliminada]);
    }

    // POST /api/nav/page  datos de la página de un item (compat)
    public static function getPage() {
        $b = Http::body();
        if (!array_key_exists('id_menu', $b)) Http::error('Se requiere id_menu', 400);
        $botones = self::loadBotones();
        $idx = self::findIdx($botones, (int) $b['id_menu']);
        if ($idx === -1) Http::error('Ítem no encontrado', 404);
        $boton = $botones[$idx];

        $plts = self::loadPlantillas();
        $pi = self::idxPlantillaDeMenu($plts, $boton['id_menu']);
        $p = $pi === -1 ? null : $plts[$pi];
        Http::json([
            'id_menu'   => (int) $boton['id_menu'],
            'titulo'    => $boton['titulo'],
            'href'      => $boton['href'],
            'plantilla' => $p ? ['id_plantilla' => (int) $p['id_plantilla'], 'nombre' => $p['nombre'], 'tipo' => $p['tipo']] : null,
        ]);
    }

    // POST /api/nav/sync  obsoleto en v2
    public static function syncPlantillas() {
        Http::json(['ok' => true, 'message' => 'Sync obsoleto en v2: el nav se resuelve desde navbar.json en tiempo de render.']);
    }
}
