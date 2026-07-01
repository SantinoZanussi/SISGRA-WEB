<?php
// Recibe los envíos del formulario de contacto y los guarda como "pendiente".
// Cuando exista el endpoint externo, ENDPOINT_DESTINO deja de ser null.

class ContactosController {
    const ENDPOINT_DESTINO = null;
    const FILE = 'contactos_log';

    // POST /api/contactos  body: { campos: {etiqueta: valor}, pagina?, formulario? }
    public static function crear() {
        $b = Http::body();
        $campos = isset($b['campos']) ? $b['campos'] : null;
        if (!is_array($campos) || count($campos) === 0) {
            Http::error('El envío no tiene campos', 400);
        }

        // solo pares clave->string con límite de tamaño
        $limpio = [];
        foreach ($campos as $k => $v) {
            $key = mb_substr((string) $k, 0, 120);
            $val = ($v === null) ? '' : (is_scalar($v) ? (string) $v : '');
            $limpio[$key] = mb_substr($val, 0, 5000);
        }

        $envio = [
            'id'             => gen_id('contacto'),
            'date_time_hour' => now_iso(),
            'estado'         => 'pendiente',
            'destino_url'    => self::ENDPOINT_DESTINO,
            'pagina'         => !empty($b['pagina']) ? mb_substr((string) $b['pagina'], 0, 200) : null,
            'formulario'     => !empty($b['formulario']) ? mb_substr((string) $b['formulario'], 0, 200) : null,
            'campos'         => $limpio,
        ];

        $log = Store::read(self::FILE, true);
        if (!is_array($log) || !isset($log['envios']) || !is_array($log['envios'])) $log = ['envios' => []];
        $log['envios'][] = $envio;
        Store::write(self::FILE, $log);

        Http::json(['ok' => true, 'id' => $envio['id']], 201);
    }

    // GET /api/contactos  [auth]  historial de envíos
    public static function listar() {
        $raw = Store::readRaw(self::FILE);
        if ($raw === null) Http::json(['envios' => []]);
        Http::rawJson($raw);
    }
}
