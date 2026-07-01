<?php
// Parseo del request y helpers de respuesta JSON.

class Http {
    private static $body = null;

    // body JSON parseado a array asociativo; para multipart devuelve $_POST
    public static function body() {
        if (self::$body !== null) return self::$body;
        $ctype = $_SERVER['CONTENT_TYPE'] ?? '';
        if (stripos($ctype, 'application/json') !== false) {
            $raw = file_get_contents('php://input');
            $parsed = json_decode($raw, true);
            self::$body = is_array($parsed) ? $parsed : [];
        } else {
            self::$body = $_POST;
        }
        return self::$body;
    }

    // igual que body() pero como objeto (assoc=false): conserva {} contra []
    // util para campos libres (data, design, contenido) que deben mantener su forma
    public static function bodyObject() {
        $ctype = $_SERVER['CONTENT_TYPE'] ?? '';
        if (stripos($ctype, 'application/json') !== false) {
            $parsed = json_decode(file_get_contents('php://input'), false);
            return $parsed === null ? new stdClass() : $parsed;
        }
        return (object) $_POST;
    }

    public static function query() {
        return $_GET;
    }

    public static function json($data, $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_FLAGS);
        exit;
    }

    // emite JSON ya serializado tal cual (para devolver documentos byte a byte)
    public static function rawJson($jsonString, $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo $jsonString;
        exit;
    }

    // {error: msg} + campos extra opcionales, con status
    public static function error($msg, $status = 400, $extra = []) {
        self::json(array_merge(['error' => $msg], $extra), $status);
    }
}
