<?php
// Middleware de auth: exige un Bearer valido, igual que authMiddleware del Node.

class Auth {
    // corta con 401 si no hay token valido; devuelve el payload si esta ok
    public static function require() {
        $header = self::header();
        if (!$header || stripos($header, 'Bearer ') !== 0) {
            Http::error('Token requerido', 401);
        }
        $token = trim(substr($header, 7));
        try {
            return Jwt::verify($token, JWT_SECRET);
        } catch (Exception $e) {
            Http::error('Token inválido o expirado', 401);
        }
    }

    private static function header() {
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) return $_SERVER['HTTP_AUTHORIZATION'];
        if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        // algunos Apache no exponen el header salvo con apache_request_headers
        if (function_exists('apache_request_headers')) {
            foreach (apache_request_headers() as $k => $v) {
                if (strtolower($k) === 'authorization') return $v;
            }
        }
        return null;
    }
}
