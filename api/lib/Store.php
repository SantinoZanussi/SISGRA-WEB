<?php
// Capa de datos sobre archivos JSON en api/data/*.json.
// MySQL se hará más adelante; por ahora todo persiste en JSON.
// Cada archivo es un documento completo; los controllers leen/mutan/escriben el archivo entero.

class Store {
    // documentos que expone el DataController (/api/data/:file)
    const ALLOWED = [
        'hero', 'nosotros', 'servicios', 'clientes', 'blog',
        'contacto', 'seo', 'paginas', 'categorias', 'extra_sections', 'tpl_designs',
        'navbar', 'modulos',
    ];

    public static function path($name) {
        return DATA_DIR . '/' . $name . '.json';
    }

    // contenido crudo tal cual en disco, o null si no existe (para GET byte a byte)
    public static function readRaw($name) {
        $fp = self::path($name);
        return is_file($fp) ? file_get_contents($fp) : null;
    }

    // decodificado; assoc=false conserva la diferencia entre {} y []
    public static function read($name, $assoc = true) {
        $raw = self::readRaw($name);
        return $raw === null ? null : json_decode($raw, $assoc);
    }

    // escribe el archivo entero (indentado, con lock exclusivo)
    public static function write($name, $data) {
        file_put_contents(self::path($name), jenc_pretty($data) . "\n", LOCK_EX);
    }

    // devuelve la colección envuelta {clave:[...]} como array (o [] si falta)
    public static function coll($name, $key, $assoc = true) {
        $d = self::read($name, $assoc);
        if ($assoc) {
            return (is_array($d) && isset($d[$key]) && is_array($d[$key])) ? $d[$key] : [];
        }
        return (is_object($d) && isset($d->$key) && is_array($d->$key)) ? $d->$key : [];
    }

    public static function isAllowed($name) {
        return in_array($name, self::ALLOWED, true);
    }
}
