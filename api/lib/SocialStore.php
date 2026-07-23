<?php
// Guarda/lee los secretos de Meta (tokens de página, ids). Vive en api/secure y
// nunca se expone por la API: ningún endpoint lo devuelve tal cual.

class SocialStore {
    private static function file() { return SECURE_DIR . '/meta.json'; }

    public static function read() {
        $fp = self::file();
        if (!is_file($fp)) return [];
        $d = json_decode(file_get_contents($fp), true);
        return is_array($d) ? $d : [];
    }

    public static function write($data) {
        if (!is_dir(SECURE_DIR)) @mkdir(SECURE_DIR, 0700, true);
        file_put_contents(self::file(), jenc_pretty($data) . "\n", LOCK_EX);
        @chmod(self::file(), 0600);
    }

    public static function clear() {
        $fp = self::file();
        if (is_file($fp)) @unlink($fp);
    }

    public static function isConnected() {
        $d = self::read();
        return !empty($d['page_id']) && !empty($d['page_token']);
    }

    // ---- LinkedIn: vive en la sub-clave 'linkedin' del mismo archivo seguro ----

    public static function readLinkedin() {
        $d = self::read();
        return (isset($d['linkedin']) && is_array($d['linkedin'])) ? $d['linkedin'] : [];
    }

    public static function writeLinkedin($li) {
        $d = self::read();
        $d['linkedin'] = $li;
        self::write($d);
    }

    public static function clearLinkedin() {
        $d = self::read();
        unset($d['linkedin']);
        self::write($d);
    }

    public static function isLinkedinConnected() {
        $li = self::readLinkedin();
        return !empty($li['access_token']) && !empty($li['org_urn']);
    }
}
