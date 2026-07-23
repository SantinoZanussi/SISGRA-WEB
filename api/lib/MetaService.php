<?php
// Cliente de la Graph API de Meta: OAuth, publicación en Facebook e Instagram,
// y armado del texto (caption). Config sensible en config.php / env; tokens en SocialStore.

class MetaService {

    private static function base() { return 'https://graph.facebook.com/' . META_GRAPH_VER; }

    // redirect del OAuth: el configurado o, si falta, uno derivado del host actual
    public static function redirectUri() {
        if (META_REDIRECT_URI) return META_REDIRECT_URI;
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $base   = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php')), '/');
        return $scheme . '://' . $host . $base . '/social/callback';
    }

    // URL del diálogo de OAuth para autorizar la app
    public static function oauthDialogUrl($state) {
        $scopes = 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management';
        $q = http_build_query([
            'client_id'     => META_APP_ID,
            'redirect_uri'  => self::redirectUri(),
            'state'         => $state,
            'scope'         => $scopes,
            'response_type' => 'code',
        ]);
        return 'https://www.facebook.com/' . META_GRAPH_VER . '/dialog/oauth?' . $q;
    }

    // ---- HTTP (cURL) ----

    private static function exec($url, $postFields = null) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        if ($postFields !== null) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postFields));
        }
        $res  = curl_exec($ch);
        $err  = curl_error($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($res === false) throw new Exception('Error de red con Meta: ' . $err);
        $json = json_decode($res, true);
        if (!is_array($json)) throw new Exception('Respuesta inválida de Meta (HTTP ' . $code . ')');
        if (isset($json['error'])) throw new Exception('Meta: ' . ($json['error']['message'] ?? 'error desconocido'));
        return $json;
    }
    private static function httpGet($url)          { return self::exec($url, null); }
    private static function httpPost($url, $fields) { return self::exec($url, $fields); }

    // ---- OAuth: canjear el code y guardar página + IG vinculado ----

    public static function exchangeCodeAndStore($code) {
        // 1) code -> token corto de usuario
        $short = self::httpGet(self::base() . '/oauth/access_token?' . http_build_query([
            'client_id'     => META_APP_ID,
            'client_secret' => META_APP_SECRET,
            'redirect_uri'  => self::redirectUri(),
            'code'          => $code,
        ]));
        $shortToken = $short['access_token'] ?? null;
        if (!$shortToken) throw new Exception('Meta no devolvió un token de acceso');

        // 2) token corto -> token largo de usuario (~60 días)
        $long = self::httpGet(self::base() . '/oauth/access_token?' . http_build_query([
            'grant_type'        => 'fb_exchange_token',
            'client_id'         => META_APP_ID,
            'client_secret'     => META_APP_SECRET,
            'fb_exchange_token' => $shortToken,
        ]));
        $userToken = $long['access_token'] ?? $shortToken;

        // 3) páginas del usuario, con su token de página (no expira) y la cuenta de IG
        $accounts = self::httpGet(self::base() . '/me/accounts?' . http_build_query([
            'fields'       => 'id,name,access_token,instagram_business_account{id,username}',
            'access_token' => $userToken,
        ]));
        $pages = $accounts['data'] ?? [];
        if (!$pages) throw new Exception('La cuenta no administra ninguna Página de Facebook');

        // la página configurada (META_PAGE_ID) o la primera
        $page = null;
        if (META_PAGE_ID) {
            foreach ($pages as $p) { if (($p['id'] ?? '') === META_PAGE_ID) { $page = $p; break; } }
            if (!$page) throw new Exception('La Página configurada (META_PAGE_ID) no está entre las que administra la cuenta');
        }
        if (!$page) $page = $pages[0];

        $ig = $page['instagram_business_account'] ?? null;
        $data = [
            'page_id'      => $page['id'] ?? '',
            'page_name'    => $page['name'] ?? '',
            'page_token'   => $page['access_token'] ?? '',
            'ig_user_id'   => $ig['id'] ?? '',
            'ig_username'  => $ig['username'] ?? '',
            'connected_at' => now_iso(),
        ];
        if (!$data['page_token']) throw new Exception('No se pudo obtener el token de la Página');
        SocialStore::write($data);
        return $data;
    }

    // ---- Publicación ----

    // arma una URL absoluta y pública (deja pasar las que ya lo son)
    private static function absUrl($pathOrUrl, $sitio) {
        if (!$pathOrUrl) return '';
        if (preg_match('#^https?://#i', $pathOrUrl)) return $pathOrUrl;
        return rtrim($sitio, '/') . '/' . ltrim($pathOrUrl, '/');
    }

    // texto de la publicación: descripción del módulo + link (según red) + hashtags.
    // $contenido = { id, imagen, descripcion, hashtags } armado desde el módulo importado.
    public static function buildCaption($contenido, $cfg, $red) {
        $descripcion = trim((string) field($contenido, 'descripcion', ''));
        $sitio       = field($cfg, 'sitio_url', '');
        $tags        = (array) field($contenido, 'hashtags', []);

        $partes = [];
        if ($descripcion) $partes[] = $descripcion;

        if ($red === 'fb') {
            $link = self::absUrl('/html/articulo/?id=' . rawurlencode(field($contenido, 'id', '')), $sitio);
            if ($sitio) $partes[] = 'Nota completa: ' . $link;
        } else { // ig: el link del caption no es clickeable -> se apunta al link en bio
            if (field($cfg, 'link_bio', '')) $partes[] = 'Nota completa en el link de nuestra bio 👆';
        }
        if ($tags) $partes[] = implode(' ', array_values(array_unique($tags)));

        return implode("\n\n", $partes);
    }

    public static function publishFacebook($contenido, $cfg) {
        $conn = SocialStore::read();
        if (empty($conn['page_id']) || empty($conn['page_token'])) throw new Exception('Falta conectar la Página de Facebook');
        $img = self::absUrl(field($contenido, 'imagen', ''), field($cfg, 'sitio_url', ''));
        if (!$img) throw new Exception('El módulo de redes no tiene imagen generada');

        $res = self::httpPost(self::base() . '/' . $conn['page_id'] . '/photos', [
            'url'          => $img,
            'caption'      => self::buildCaption($contenido, $cfg, 'fb'),
            'access_token' => $conn['page_token'],
        ]);
        return $res['post_id'] ?? ($res['id'] ?? '');
    }

    public static function publishInstagram($contenido, $cfg) {
        $conn = SocialStore::read();
        if (empty($conn['ig_user_id']) || empty($conn['page_token'])) throw new Exception('Falta conectar la cuenta de Instagram');
        $img = self::absUrl(field($contenido, 'imagen', ''), field($cfg, 'sitio_url', ''));
        if (!$img) throw new Exception('El módulo de redes no tiene imagen generada');

        // 1) crear el contenedor del media
        $cont = self::httpPost(self::base() . '/' . $conn['ig_user_id'] . '/media', [
            'image_url'    => $img,
            'caption'      => self::buildCaption($contenido, $cfg, 'ig'),
            'access_token' => $conn['page_token'],
        ]);
        $creationId = $cont['id'] ?? null;
        if (!$creationId) throw new Exception('Instagram no devolvió el contenedor de la publicación');

        // 2) publicar el contenedor
        $pub = self::httpPost(self::base() . '/' . $conn['ig_user_id'] . '/media_publish', [
            'creation_id'  => $creationId,
            'access_token' => $conn['page_token'],
        ]);
        return $pub['id'] ?? '';
    }
}
