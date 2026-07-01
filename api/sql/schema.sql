-- Esquema de la API SISGRA (MySQL / MariaDB).
-- Los blobs anidados (data, design, contenedores, etc.) van como LONGTEXT con JSON
-- adentro: maxima compatibilidad y no se usan funciones JSON de SQL.
-- Los timestamps se guardan como string ISO-8601 (igual que el JSON viejo) para no
-- perder los milisegundos ni la Z al comparar vencimientos.

SET NAMES utf8mb4;

-- documentos genericos editables por bloque (hero, blog, seo, clientes, ...)
CREATE TABLE IF NOT EXISTS documents (
  name    VARCHAR(64) NOT NULL PRIMARY KEY,
  content LONGTEXT    NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- catalogo plano de modulos
CREATE TABLE IF NOT EXISTS modulos (
  id_modulo  INT          NOT NULL PRIMARY KEY,
  tipo       VARCHAR(64)  NOT NULL,
  nombre     VARCHAR(255) NOT NULL,
  id_pagina  LONGTEXT     NULL,
  data       LONGTEXT     NULL,
  design     LONGTEXT     NULL,
  alerta     TINYINT(1)   NOT NULL DEFAULT 0,
  creado_en  VARCHAR(32)  NULL,
  editado_en VARCHAR(32)  NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- plantillas: punteros a modulos + metadata de vigencia
CREATE TABLE IF NOT EXISTS plantillas (
  id_plantilla INT          NOT NULL PRIMARY KEY,
  tipo         VARCHAR(64)  NOT NULL,
  nombre       VARCHAR(255) NOT NULL,
  descripcion  TEXT         NULL,
  activa       TINYINT(1)   NOT NULL DEFAULT 0,
  fecha_inicio VARCHAR(32)  NULL,
  fecha_fin    VARCHAR(32)  NULL,
  id_menu      LONGTEXT     NULL,
  id_modulos   LONGTEXT     NULL,
  contenedores LONGTEXT     NULL,
  creado_en    VARCHAR(32)  NULL,
  editado_en   VARCHAR(32)  NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- items del navbar (arbol por `padre`)
CREATE TABLE IF NOT EXISTS navbar (
  id_menu INT          NOT NULL PRIMARY KEY,
  titulo  VARCHAR(255) NOT NULL,
  padre   INT          NOT NULL DEFAULT 0,
  menu    VARCHAR(16)  NOT NULL DEFAULT 'CE',
  href    VARCHAR(512) NULL,
  orden   INT          NOT NULL DEFAULT 0,
  activo  TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- imagenes registradas (subidas + detectadas en /img)
CREATE TABLE IF NOT EXISTS assets (
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  nombre     VARCHAR(255) NOT NULL,
  filename   VARCHAR(512) NOT NULL,
  path       VARCHAR(512) NOT NULL,
  locked     TINYINT(1)   NOT NULL DEFAULT 0,
  mime       VARCHAR(64)  NULL,
  size       INT          NOT NULL DEFAULT 0,
  origen     VARCHAR(32)  NULL,
  etiquetas  LONGTEXT     NULL,
  creado_en  VARCHAR(32)  NULL,
  editado_en VARCHAR(32)  NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- etiquetas de imagenes (color | modulo | plantilla | menu)
CREATE TABLE IF NOT EXISTS asset_labels (
  id     VARCHAR(64)  NOT NULL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  color  VARCHAR(32)  NULL,
  grupo  VARCHAR(32)  NOT NULL DEFAULT 'color'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- historial de vencimientos detectados
CREATE TABLE IF NOT EXISTS alertas_log (
  id             VARCHAR(64)  NOT NULL PRIMARY KEY,
  k              VARCHAR(255) NOT NULL UNIQUE,
  id_alerta      INT          NOT NULL,
  alerta         TEXT         NULL,
  date_time_hour VARCHAR(32)  NULL,
  estado         VARCHAR(32)  NULL,
  meta           LONGTEXT     NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- envios del formulario de contacto
CREATE TABLE IF NOT EXISTS contactos_log (
  id             VARCHAR(64)  NOT NULL PRIMARY KEY,
  date_time_hour VARCHAR(32)  NULL,
  estado         VARCHAR(32)  NULL,
  destino_url    VARCHAR(512) NULL,
  pagina         VARCHAR(255) NULL,
  formulario     VARCHAR(255) NULL,
  campos         LONGTEXT     NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- cache de contenido recibido desde la API PRES via webhook
CREATE TABLE IF NOT EXISTS webhook_cache (
  id_entrada            VARCHAR(64) NOT NULL PRIMARY KEY,
  id_pedido             VARCHAR(255) NULL,
  contenido             LONGTEXT     NULL,
  contenido_editado     LONGTEXT     NULL,
  editado               TINYINT(1)   NOT NULL DEFAULT 0,
  procesado             TINYINT(1)   NOT NULL DEFAULT 0,
  id_plantilla_asignada INT          NULL,
  id_seccion_asignada   VARCHAR(255) NULL,
  recibido_en           VARCHAR(32)  NULL,
  procesado_en          VARCHAR(32)  NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- usuarios del panel (reemplaza al admin hardcodeado)
CREATE TABLE IF NOT EXISTS users (
  id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario       VARCHAR(64)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(32)  NOT NULL DEFAULT 'admin'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
