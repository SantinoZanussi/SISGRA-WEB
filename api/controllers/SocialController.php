<?php
// Endpoints de redes: conexión con Meta (OAuth) y publicación de un post en IG/FB.
// La config no secreta (hashtags, link bio, sitio_url, flags) vive en data/social.json;
// los tokens en SocialStore (api/secure). Ver MetaService para las llamadas a la Graph API.

class SocialController {

    // GET /api/social/status  [auth]  -> estado de conexión (sin exponer el token)
    public static function status() {
        $c = SocialStore::read();
        Http::json([
            'configurado'  => META_APP_ID !== '' && META_APP_SECRET !== '',
            'conectado'    => !empty($c['page_id']) && !empty($c['page_token']),
            'page_name'    => $c['page_name'] ?? '',
            'ig_username'  => $c['ig_username'] ?? '',
            'ig_ok'        => !empty($c['ig_user_id']),
            'connected_at' => $c['connected_at'] ?? null,
        ]);
    }

    // GET /api/social/connect  [auth]  -> URL del diálogo de OAuth
    public static function connect() {
        if (META_APP_ID === '' || META_APP_SECRET === '') {
            Http::error('Falta configurar META_APP_ID / META_APP_SECRET en el servidor', 400);
        }
        // nonce para validar el callback (evita CSRF en el OAuth)
        $state = bin2hex(random_bytes(16));
        $c = SocialStore::read();
        $c['oauth_state']    = $state;
        $c['oauth_state_ts'] = now_ms();
        SocialStore::write($c);
        Http::json(['url' => MetaService::oauthDialogUrl($state)]);
    }

    // GET /api/social/callback  (público, validado por state) <- redirect de Facebook
    public static function callback() {
        $q     = Http::query();
        $code  = $q['code']  ?? '';
        $state = $q['state'] ?? '';
        $err   = $q['error_description'] ?? ($q['error'] ?? '');

        if ($err)   self::closePopup('No se pudo conectar: ' . $err, false);
        if (!$code) self::closePopup('Meta no devolvió un código de autorización', false);

        $c     = SocialStore::read();
        $saved = $c['oauth_state'] ?? '';
        $ts    = $c['oauth_state_ts'] ?? 0;
        if ($saved === '' || !hash_equals($saved, (string) $state) || (now_ms() - $ts) > 10 * 60 * 1000) {
            self::closePopup('La sesión de conexión venció o es inválida. Probá de nuevo.', false);
        }

        try {
            MetaService::exchangeCodeAndStore($code);
            $c2 = SocialStore::read();
            unset($c2['oauth_state'], $c2['oauth_state_ts']);
            SocialStore::write($c2);
            self::closePopup('¡Cuenta conectada con Meta!', true);
        } catch (Exception $e) {
            self::closePopup($e->getMessage(), false);
        }
    }

    // POST /api/social/disconnect  [auth]
    public static function disconnect() {
        SocialStore::clear();
        Http::json(['ok' => true]);
    }

    /* ==== LinkedIn DESHABILITADO (se retomará a futuro; NO borrar) ====

    // GET /api/social/linkedin/status  [auth]
    public static function liStatus() {
        $li  = SocialStore::readLinkedin();
        $exp = $li['expires_at'] ?? 0;
        Http::json([
            'configurado'  => LI_CLIENT_ID !== '' && LI_CLIENT_SECRET !== '',
            'conectado'    => !empty($li['access_token']) && !empty($li['org_urn']),
            'org_name'     => $li['org_name'] ?? '',
            'dias_restantes' => $exp ? max(0, (int) floor(($exp - now_ms()) / 86400000)) : null,
            'vencido'      => $exp ? (now_ms() >= $exp) : false,
            'conectado_en' => $li['conectado_en'] ?? null,
        ]);
    }

    // GET /api/social/linkedin/connect  [auth]
    public static function liConnect() {
        if (LI_CLIENT_ID === '' || LI_CLIENT_SECRET === '') {
            Http::error('Falta configurar LI_CLIENT_ID / LI_CLIENT_SECRET en el servidor', 400);
        }
        $state = bin2hex(random_bytes(16));
        $li = SocialStore::readLinkedin();
        $li['oauth_state']    = $state;
        $li['oauth_state_ts'] = now_ms();
        SocialStore::writeLinkedin($li);
        Http::json(['url' => LinkedinService::oauthDialogUrl($state)]);
    }

    // GET /api/social/linkedin/callback  (público, validado por state)
    public static function liCallback() {
        $q     = Http::query();
        $code  = $q['code']  ?? '';
        $state = $q['state'] ?? '';
        $err   = $q['error_description'] ?? ($q['error'] ?? '');

        if ($err)   self::closePopup('No se pudo conectar: ' . $err, false);
        if (!$code) self::closePopup('LinkedIn no devolvió un código de autorización', false);

        $li    = SocialStore::readLinkedin();
        $saved = $li['oauth_state'] ?? '';
        $ts    = $li['oauth_state_ts'] ?? 0;
        if ($saved === '' || !hash_equals($saved, (string) $state) || (now_ms() - $ts) > 10 * 60 * 1000) {
            self::closePopup('La sesión de conexión venció o es inválida. Probá de nuevo.', false);
        }

        try {
            LinkedinService::exchangeCodeAndStore($code);
            $li2 = SocialStore::readLinkedin();
            unset($li2['oauth_state'], $li2['oauth_state_ts']);
            SocialStore::writeLinkedin($li2);
            self::closePopup('¡Página de LinkedIn conectada!', true);
        } catch (Exception $e) {
            self::closePopup($e->getMessage(), false);
        }
    }

    // POST /api/social/linkedin/disconnect  [auth]
    public static function liDisconnect() {
        SocialStore::clearLinkedin();
        Http::json(['ok' => true]);
    }
    ==== fin LinkedIn deshabilitado ==== */

    // POST /api/social/publish/:id  [auth]  publica un post; body opcional {red:'ig'|'fb'}
    public static function publish($id) {
        $post = self::findPost($id);
        if (!$post) Http::error('Artículo no encontrado', 404);
        if (!SocialStore::isConnected()) Http::error('No hay conexión con Meta. Conectá la cuenta primero.', 400);
        // LinkedIn (a futuro): sería → if (!SocialStore::isConnected() && !SocialStore::isLinkedinConnected()) { ... }
        if (empty($post['id_modulo_redes'])) Http::error('El artículo no tiene un módulo de Redes sociales importado', 400);

        $cfg  = Store::read('social', true) ?: [];
        $b    = Http::body();
        $only = (isset($b['red']) && in_array($b['red'], ['ig', 'fb'], true)) ? $b['red'] : null; // + 'li' cuando se reactive LinkedIn

        // el disparo automático (sin red) solo publica las pendientes; Reintentar (con red) fuerza esa red
        $redes = self::publishPost($post, $cfg, $only, $only === null);
        self::saveRedes($id, $redes);
        Http::json(['ok' => true, 'redes' => $redes]);
    }

    // Reutilizable por el disparo automático (Fase 4) y por el botón Reintentar.
    // $only='ig'|'fb' publica una sola red; null publica las activas.
    // $skipDone=true saltea las redes ya publicadas (para no duplicar al re-guardar).
    public static function publishPost($post, $cfg, $only = null, $skipDone = false) {
        $prev = (isset($post['redes']) && is_array($post['redes'])) ? $post['redes'] : [];
        $done = function ($net) use ($prev) { return ($prev[$net]['estado'] ?? '') === 'publicado'; };

        // imagen + descripción + hashtags salen del módulo de redes importado en el post
        $contenido = self::contenidoDesdeModulo($post);

        $out    = [];
        $wantFb = ($cfg['publicar_fb'] ?? true) && (!$only || $only === 'fb') && !($skipDone && $done('fb'));
        $wantIg = ($cfg['publicar_ig'] ?? true) && (!$only || $only === 'ig') && !($skipDone && $done('ig'));
        if ($wantFb) $out['fb'] = self::tryPublish(function () use ($contenido, $cfg) { return MetaService::publishFacebook($contenido, $cfg); });
        if ($wantIg) $out['ig'] = self::tryPublish(function () use ($contenido, $cfg) { return MetaService::publishInstagram($contenido, $cfg); });
        // LinkedIn (a futuro; NO borrar):
        // $wantLi = ($cfg['publicar_li'] ?? true) && (!$only || $only === 'li') && !($skipDone && $done('li'));
        // if ($wantLi) $out['li'] = self::tryPublish(function () use ($contenido, $cfg) { return LinkedinService::publicar($contenido, $cfg); });
        return $out;
    }

    // arma { id, imagen, descripcion, hashtags } desde el módulo social importado
    private static function contenidoDesdeModulo($post) {
        $mod  = !empty($post['id_modulo_redes']) ? self::findModulo($post['id_modulo_redes']) : null;
        $data = ($mod && isset($mod['data']) && is_array($mod['data'])) ? $mod['data'] : [];
        return [
            'id'          => $post['id'] ?? '',
            'imagen'      => $data['imagen_generada'] ?? '',
            'descripcion' => $data['descripcion'] ?? '',
            'hashtags'    => (isset($data['hashtags']) && is_array($data['hashtags'])) ? $data['hashtags'] : [],
        ];
    }

    private static function findModulo($id) {
        foreach (Store::coll('modulos', 'modulos') as $m) {
            if ((int) ($m['id_modulo'] ?? 0) === (int) $id) return $m;
        }
        return null;
    }

    private static function tryPublish($fn) {
        try {
            return ['estado' => 'publicado', 'post_id' => $fn(), 'error' => null, 'en' => now_iso()];
        } catch (Exception $e) {
            return ['estado' => 'error', 'post_id' => null, 'error' => $e->getMessage(), 'en' => now_iso()];
        }
    }

    private static function findPost($id) {
        foreach (Store::coll('blog', 'posts') as $p) {
            if (($p['id'] ?? null) === $id) return $p;
        }
        return null;
    }

    // guarda el estado por red dentro del post (merge, no pisa la otra red)
    private static function saveRedes($id, $redes) {
        $data = Store::read('blog', true);
        if (!isset($data['posts']) || !is_array($data['posts'])) return;
        foreach ($data['posts'] as &$p) {
            if (($p['id'] ?? null) === $id) {
                $prev = (isset($p['redes']) && is_array($p['redes'])) ? $p['redes'] : [];
                $p['redes'] = array_merge($prev, $redes);
                break;
            }
        }
        unset($p);
        Store::write('blog', $data);
    }

    // HTML mínimo para el popup del OAuth: avisa al opener y se cierra
    private static function closePopup($msg, $ok) {
        http_response_code(200);
        header('Content-Type: text/html; charset=utf-8');
        $m     = htmlspecialchars($msg, ENT_QUOTES, 'UTF-8');
        $color = $ok ? '#16a34a' : '#dc2626';
        $flag  = $ok ? 'true' : 'false';
        echo "<!doctype html><meta charset='utf-8'>"
           . "<body style=\"font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;\">"
           . "<div style=\"text-align:center;padding:1.5rem;\">"
           . "<div style=\"font-size:1.05rem;font-weight:700;color:$color;\">$m</div>"
           . "<div style=\"margin-top:.5rem;color:#94a3b8;font-size:.85rem;\">Podés cerrar esta ventana.</div></div>"
           . "<script>try{window.opener&&window.opener.postMessage({source:'meta-oauth',ok:$flag},'*');}catch(e){}"
           . "setTimeout(function(){window.close();},1600);</script>";
        exit;
    }
}
