<?php
// Cliente de la API de LinkedIn (versionada): OAuth, subida de imagen y publicación
// en la Página de empresa. A diferencia de Meta, LinkedIn NO acepta la imagen por URL:
// hay que registrar el upload y mandar el binario. Tokens en SocialStore (sub-clave linkedin).
//
// ==== DESHABILITADO: se retomará a futuro. NO borrar. ====
// No se carga desde api/index.php (require comentado). Para reactivar: descomentar el require +
// las rutas + la config (config.php/env.php) + los métodos LinkedIn de SocialStore + las
// referencias en SocialController + el frontend (panel.js y el HTML del panel), y esta clase.
/*
class LinkedinService {

    const AUTH_URL  = 'https://www.linkedin.com/oauth/v2/authorization';
    const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
    const API       = 'https://api.linkedin.com/rest';

    // publicar en la Página + leer sus posts + descubrir de qué Páginas es admin
    const SCOPES = 'w_organization_social r_organization_social rw_organization_admin';

    public static function redirectUri() {
        if (LI_REDIRECT_URI) return LI_REDIRECT_URI;
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $base   = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php')), '/');
        return $scheme . '://' . $host . $base . '/social/linkedin/callback';
    }

    public static function oauthDialogUrl($state) {
        return self::AUTH_URL . '?' . http_build_query([
            'response_type' => 'code',
            'client_id'     => LI_CLIENT_ID,
            'redirect_uri'  => self::redirectUri(),
            'state'         => $state,
            'scope'         => self::SCOPES,
        ]);
    }

    // ---- HTTP ----

    // devuelve ['status'=>int,'headers'=>[k=>v],'json'=>array|null,'raw'=>string]
    private static function req($method, $url, $opts = []) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        if (isset($opts['body'])) curl_setopt($ch, CURLOPT_POSTFIELDS, $opts['body']);
        if (!empty($opts['headers'])) curl_setopt($ch, CURLOPT_HTTPHEADER, $opts['headers']);

        $headers = [];
        curl_setopt($ch, CURLOPT_HEADERFUNCTION, function ($c, $line) use (&$headers) {
            $p = explode(':', $line, 2);
            if (count($p) === 2) $headers[strtolower(trim($p[0]))] = trim($p[1]);
            return strlen($line);
        });

        $raw    = curl_exec($ch);
        $err    = curl_error($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($raw === false) throw new Exception('Error de red con LinkedIn: ' . $err);

        $json = json_decode($raw, true);
        return ['status' => $status, 'headers' => $headers, 'json' => is_array($json) ? $json : null, 'raw' => $raw];
    }

    // headers estándar de la API versionada
    private static function apiHeaders($token, $extra = []) {
        return array_merge([
            'Authorization: Bearer ' . $token,
            'Linkedin-Version: ' . LI_VERSION,
            'X-Restli-Protocol-Version: 2.0.0',
        ], $extra);
    }

    private static function fail($r, $ctx) {
        $msg = $r['json']['message'] ?? ($r['raw'] !== '' ? substr($r['raw'], 0, 200) : 'sin detalle');
        throw new Exception("LinkedIn ($ctx, HTTP {$r['status']}): $msg");
    }

    // ---- OAuth ----

    public static function exchangeCodeAndStore($code) {
        $r = self::req('POST', self::TOKEN_URL, [
            'headers' => ['Content-Type: application/x-www-form-urlencoded'],
            'body'    => http_build_query([
                'grant_type'    => 'authorization_code',
                'code'          => $code,
                'redirect_uri'  => self::redirectUri(),
                'client_id'     => LI_CLIENT_ID,
                'client_secret' => LI_CLIENT_SECRET,
            ]),
        ]);
        if ($r['status'] >= 400 || empty($r['json']['access_token'])) self::fail($r, 'token');

        $tok = $r['json'];
        $li = [
            'access_token'  => $tok['access_token'],
            'expires_at'    => now_ms() + ((int) ($tok['expires_in'] ?? 0)) * 1000,
            'refresh_token' => $tok['refresh_token'] ?? '',
            'conectado_en'  => now_iso(),
        ];

        // organización: la configurada o la primera donde el usuario sea admin
        if (LI_ORG_ID) {
            $li['org_urn']  = 'urn:li:organization:' . LI_ORG_ID;
            $li['org_name'] = '';
        } else {
            $org = self::descubrirOrganizacion($li['access_token']);
            $li['org_urn']  = $org['urn'];
            $li['org_name'] = $org['name'];
        }
        SocialStore::writeLinkedin($li);
        return $li;
    }

    // busca una Página donde la cuenta sea ADMINISTRATOR (necesita rw_organization_admin)
    private static function descubrirOrganizacion($token) {
        $url = self::API . '/organizationAcls?' . http_build_query([
            'q'          => 'roleAssignee',
            'role'       => 'ADMINISTRATOR',
            'state'      => 'APPROVED',
            'projection' => '(elements*(organization~(id,localizedName)))',
        ]);
        $r = self::req('GET', $url, ['headers' => self::apiHeaders($token)]);
        if ($r['status'] >= 400) self::fail($r, 'organizationAcls');

        $els = $r['json']['elements'] ?? [];
        if (!$els) throw new Exception('La cuenta no administra ninguna Página de empresa en LinkedIn');

        $first = $els[0];
        $urn   = $first['organization'] ?? '';
        $name  = $first['organization~']['localizedName'] ?? '';
        if (!$urn) throw new Exception('No se pudo resolver la Página de empresa');
        return ['urn' => $urn, 'name' => $name];
    }

    // token válido: refresca si venció y hay refresh_token (no hay cron, se hace on-demand)
    private static function tokenValido() {
        $li = SocialStore::readLinkedin();
        if (empty($li['access_token'])) throw new Exception('LinkedIn no está conectado');

        $vencido = !empty($li['expires_at']) && now_ms() >= ($li['expires_at'] - 60000);
        if (!$vencido) return $li['access_token'];

        if (empty($li['refresh_token'])) {
            throw new Exception('El acceso a LinkedIn venció. Reconectá la cuenta desde el panel.');
        }
        $r = self::req('POST', self::TOKEN_URL, [
            'headers' => ['Content-Type: application/x-www-form-urlencoded'],
            'body'    => http_build_query([
                'grant_type'    => 'refresh_token',
                'refresh_token' => $li['refresh_token'],
                'client_id'     => LI_CLIENT_ID,
                'client_secret' => LI_CLIENT_SECRET,
            ]),
        ]);
        if ($r['status'] >= 400 || empty($r['json']['access_token'])) {
            throw new Exception('El acceso a LinkedIn venció y no se pudo renovar. Reconectá la cuenta desde el panel.');
        }
        $li['access_token'] = $r['json']['access_token'];
        $li['expires_at']   = now_ms() + ((int) ($r['json']['expires_in'] ?? 0)) * 1000;
        if (!empty($r['json']['refresh_token'])) $li['refresh_token'] = $r['json']['refresh_token'];
        SocialStore::writeLinkedin($li);
        return $li['access_token'];
    }

    // ---- Publicación ----

    // bytes de la portada: si es local la lee del disco, si es externa la baja
    private static function imagenBytes($ruta, $sitio) {
        if (!$ruta) throw new Exception('El módulo de redes no tiene imagen generada');
        if (!preg_match('#^https?://#i', $ruta)) {
            $fp = IMG_DIR . '/' . ltrim(preg_replace('#^/img/#', '', $ruta), '/');
            if (!is_file($fp)) throw new Exception('No se encontró la imagen en el servidor: ' . $ruta);
            return file_get_contents($fp);
        }
        $r = self::req('GET', $ruta);
        if ($r['status'] >= 400 || $r['raw'] === '') throw new Exception('No se pudo descargar la imagen de la portada');
        return $r['raw'];
    }

    // texto del post: descripción + link al artículo (clickeable) + hashtags
    public static function buildCaption($contenido, $cfg) {
        $descripcion = trim((string) field($contenido, 'descripcion', ''));
        $sitio       = field($cfg, 'sitio_url', '');
        $tags        = (array) field($contenido, 'hashtags', []);

        $partes = [];
        if ($descripcion) $partes[] = $descripcion;
        if ($sitio) {
            $partes[] = 'Nota completa: ' . rtrim($sitio, '/') . '/html/articulo/?id=' . rawurlencode(field($contenido, 'id', ''));
        }
        if ($tags) {
            $tags = array_values(array_unique($tags));
            if (count($tags) > 30) $tags = array_slice($tags, 0, 30); // mismo tope que IG, por prolijidad
            $partes[] = implode(' ', $tags);
        }
        return implode("\n\n", $partes);
    }

    public static function publicar($contenido, $cfg) {
        $li    = SocialStore::readLinkedin();
        $org   = $li['org_urn'] ?? '';
        if (!$org) throw new Exception('Falta conectar la Página de empresa de LinkedIn');
        $token = self::tokenValido();

        $bytes = self::imagenBytes(field($contenido, 'imagen', ''), field($cfg, 'sitio_url', ''));

        // 1) registrar la subida
        $init = self::req('POST', self::API . '/images?action=initializeUpload', [
            'headers' => self::apiHeaders($token, ['Content-Type: application/json']),
            'body'    => jenc(['initializeUploadRequest' => ['owner' => $org]]),
        ]);
        if ($init['status'] >= 400) self::fail($init, 'initializeUpload');
        $uploadUrl = $init['json']['value']['uploadUrl'] ?? '';
        $imageUrn  = $init['json']['value']['image'] ?? '';
        if (!$uploadUrl || !$imageUrn) throw new Exception('LinkedIn no devolvió la URL de subida');

        // 2) subir el binario
        $up = self::req('PUT', $uploadUrl, [
            'headers' => ['Authorization: Bearer ' . $token, 'Content-Type: image/jpeg'],
            'body'    => $bytes,
        ]);
        if ($up['status'] >= 400) self::fail($up, 'upload');

        // 3) crear el post referenciando la imagen
        $post = [
            'author'       => $org,
            'commentary'   => self::buildCaption($contenido, $cfg),
            'visibility'   => 'PUBLIC',
            'distribution' => [
                'feedDistribution'               => 'MAIN_FEED',
                'targetEntities'                 => [],
                'thirdPartyDistributionChannels' => [],
            ],
            'content' => ['media' => [
                'id'      => $imageUrn,
                'altText' => substr(trim((string) field($contenido, 'descripcion', '')), 0, 120),
            ]],
            'lifecycleState'            => 'PUBLISHED',
            'isReshareDisabledByAuthor' => false,
        ];
        $res = self::req('POST', self::API . '/posts', [
            'headers' => self::apiHeaders($token, ['Content-Type: application/json']),
            'body'    => jenc($post),
        ]);
        if ($res['status'] >= 400) self::fail($res, 'posts');

        // el id del post viene en el header x-restli-id
        return $res['headers']['x-restli-id'] ?? ($res['json']['id'] ?? '');
    }
}
*/
