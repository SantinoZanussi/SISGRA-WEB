# API SISGRA — backend PHP + MySQL

El backend Node/Express fue reemplazado por PHP (PDO) sobre MySQL/MariaDB.
Los mismos endpoints `/api/*` siguen funcionando igual; cambia solo la implementación.

## Requisitos

- PHP 7.4+ (recomendado 8.x) con extensiones `pdo_mysql` e `iconv`.
- MySQL o MariaDB.
- Apache con `mod_rewrite` (XAMPP ya lo trae).

> **Importante:** el sitio usa rutas absolutas (`/css`, `/services`, `/img`), así
> que el proyecto tiene que quedar en la **raíz** del DocumentRoot. En XAMPP:
> apuntá el DocumentRoot (o un VirtualHost) a la carpeta del proyecto, **no** lo
> metas en `htdocs/SISGRA-WEB/`.

## Puesta en marcha

1. **Configurar la base** en [config.php](config.php) (o por variables de entorno):
   `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`.
   Por defecto: `127.0.0.1`, `sisgra`, `root`, sin contraseña (típico de XAMPP).

2. **Migrar los datos** (crea la base, el esquema e importa los JSON de `api/data/`):
   ```
   php api/migrate.php
   ```
   o abrí una sola vez `http://localhost/api/migrate.php` en el navegador.
   Es re-ejecutable: vuelve a cargar las tablas desde los JSON.

3. **Listo.** El sitio queda en `http://localhost/` y el panel en
   `http://localhost/html/admin` (login inicial **admin / admin**).

## Notas

- La fuente de verdad ahora es MySQL. Los `api/data/*.json` quedan como semilla y
  respaldo (los lee el migrador). Ya no se escriben en runtime.
- `/api/data/modulos` y `/api/data/navbar` leen/escriben las mismas tablas que
  `/api/modulos` y `/api/nav`, así que no divergen.
- Seguridad para producción: cambiá `JWT_SECRET` en `config.php` y la contraseña
  del admin:
  ```sql
  UPDATE users SET password_hash = <hash> WHERE usuario = 'admin';
  ```
  (generá el hash con `password_hash('nueva', PASSWORD_BCRYPT)` en PHP).

## Estructura

```
api/
  config.php            credenciales + rutas + JWT
  index.php             front controller (router de /api/*)
  migrate.php           importador JSON -> MySQL
  sql/schema.sql        definición de tablas
  lib/                  Db (PDO), Http, Jwt, Auth, Store, helpers
  controllers/*.php     un controller por recurso
  data/*.json           semilla / respaldo
.htaccess               enruta /api/* y expone el header Authorization
shell.php               shell de /p/<slug> y de la 404
```
