<?php
// Alertas = solo vencimiento de plantillas con módulos marcados. La API PRES
// consulta por POST /check si hay vencimientos (no se empuja nada).

class AlertasController {
    const ID_VENCIMIENTO = 1;
    const LOG = 'alertas_log';

    private static function catalogoMap() {
        return [1 => 'Vencimiento de módulo'];
    }

    // GET /api/alertas/catalogo  (público)
    public static function catalogo() {
        Http::json(['catalogo' => self::catalogoMap()]);
    }

    // GET /api/alertas/log  [auth]
    public static function listarLog() {
        $raw = Store::readRaw(self::LOG);
        if ($raw === null) Http::json(['alertas' => []]);
        Http::rawJson($raw);
    }

    // POST /api/alertas/check  (público) — la API PRES consulta vencimientos
    public static function check() {
        $vencidos = self::detectarVencimientos();
        Http::json(['ok' => true, 'total' => count($vencidos), 'vencidos' => $vencidos]);
    }

    private static function detectarVencimientos() {
        $cat  = self::catalogoMap();
        $plts = Store::coll('plantillas', 'plantillas');
        $byId = [];
        foreach (Store::coll('modulos', 'modulos') as $m) $byId[(int) $m['id_modulo']] = $m;

        $nowMs    = now_ms();
        $vencidos = [];

        $log = Store::read(self::LOG, true);
        if (!is_array($log) || !isset($log['alertas']) || !is_array($log['alertas'])) $log = ['alertas' => []];
        $existentes = [];
        foreach ($log['alertas'] as $a) { if (isset($a['key'])) $existentes[$a['key']] = true; }
        $logChanged = false;

        foreach ($plts as $p) {
            $ff = isset($p['fecha_fin']) ? $p['fecha_fin'] : null;
            if (!(!empty($p['activa']) && $ff && $nowMs > iso_to_ms($ff))) continue;

            $ids = isset($p['id_modulos']) && is_array($p['id_modulos']) ? $p['id_modulos'] : [];
            foreach ($ids as $id) {
                $m = isset($byId[(int) $id]) ? $byId[(int) $id] : null;
                if (!$m || empty($m['alerta'])) continue;

                $key       = 'venc|' . $p['id_plantilla'] . '|' . $m['id_modulo'] . '|' . $ff;
                $nombreMod = !empty($m['nombre']) ? $m['nombre'] : $m['tipo'];
                $alerta    = $cat[self::ID_VENCIMIENTO] . ': módulo "' . $nombreMod .
                             '" de la plantilla "' . $p['nombre'] . '" (' . $p['tipo'] . ') venció el ' . $ff;

                $vencidos[] = [
                    'id_plantilla'     => $p['id_plantilla'],
                    'nombre_plantilla' => $p['nombre'],
                    'fecha_fin'        => $ff,
                    'alerta'           => $alerta,
                ];

                if (!isset($existentes[$key])) {
                    $log['alertas'][] = [
                        'id'             => gen_id('alert'),
                        'key'            => $key,
                        'id_alerta'      => self::ID_VENCIMIENTO,
                        'alerta'         => $alerta,
                        'date_time_hour' => now_iso(),
                        'estado'         => 'detectado',
                        'meta'           => [
                            'id_plantilla' => $p['id_plantilla'],
                            'id_modulo'    => $m['id_modulo'],
                            'tipo_modulo'  => $m['tipo'],
                            'fecha_fin'    => $ff,
                        ],
                    ];
                    $existentes[$key] = true;
                    $logChanged = true;
                }
            }
        }

        if ($logChanged) Store::write(self::LOG, $log);
        return $vencidos;
    }
}
