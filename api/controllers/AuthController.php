<?php
// Login del panel. Verifica contra api/data/users.json (bcrypt) y emite un JWT.

class AuthController {
    public static function login() {
        $b = Http::body();
        $usuario  = $b['usuario']  ?? null;
        $password = $b['password'] ?? null;

        if (!$usuario || !$password) {
            Http::error('Usuario y contraseña requeridos', 400);
        }

        $user = null;
        foreach (Store::coll('users', 'users') as $u) {
            if (($u['usuario'] ?? null) === $usuario) { $user = $u; break; }
        }
        if (!$user || !password_verify($password, $user['password_hash'])) {
            Http::error('Credenciales incorrectas', 401);
        }

        $token = Jwt::sign(['user' => $user['usuario'], 'role' => $user['role'] ?? 'admin'], JWT_SECRET, JWT_TTL);
        Http::json(['token' => $token, 'expiresIn' => JWT_TTL]);
    }
}
