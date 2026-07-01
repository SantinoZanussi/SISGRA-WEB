<?php
// JWT HS256 minimo, sin dependencias (reemplaza al paquete jsonwebtoken).

class Jwt {
    public static function sign($payload, $secret, $ttl = null) {
        $now = time();
        $payload['iat'] = $now;
        if ($ttl !== null) $payload['exp'] = $now + $ttl;

        $header  = self::b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $body    = self::b64(json_encode($payload));
        $sig     = self::b64(hash_hmac('sha256', "$header.$body", $secret, true));
        return "$header.$body.$sig";
    }

    // devuelve el payload o lanza Exception si es invalido/expirado
    public static function verify($token, $secret) {
        $parts = explode('.', (string) $token);
        if (count($parts) !== 3) throw new Exception('Token malformado');
        list($header, $body, $sig) = $parts;

        $expected = self::b64(hash_hmac('sha256', "$header.$body", $secret, true));
        if (!hash_equals($expected, $sig)) throw new Exception('Firma invalida');

        $payload = json_decode(self::unb64($body), true);
        if (!is_array($payload)) throw new Exception('Payload invalido');
        if (isset($payload['exp']) && time() >= $payload['exp']) throw new Exception('Token expirado');
        return $payload;
    }

    private static function b64($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function unb64($data) {
        $pad = strlen($data) % 4;
        if ($pad) $data .= str_repeat('=', 4 - $pad);
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
