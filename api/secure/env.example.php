<?php
// Copiá este archivo a env.php (queda fuera de git) y completá tus valores de Meta.
// config.php lo incluye automáticamente si existe.

putenv('META_APP_ID=');       // App ID de la app de Meta
putenv('META_APP_SECRET=');   // App Secret (NUNCA se commitea)
putenv('META_PAGE_ID=');      // opcional: ID de la Página de FB a usar (si no, la primera)
// putenv('META_REDIRECT_URI=https://tu-dominio.com/api/social/callback'); // opcional
// putenv('META_GRAPH_VER=v21.0'); // opcional

// --- LinkedIn ---
putenv('LI_CLIENT_ID=');      // Client ID de la app de LinkedIn
putenv('LI_CLIENT_SECRET=');  // Client Secret (NUNCA se commitea)
putenv('LI_ORG_ID=');         // opcional: id numérico de la Página de empresa (si no, se autodetecta)
// putenv('LI_REDIRECT_URI=https://tu-dominio.com/api/social/linkedin/callback'); // opcional
// putenv('LI_VERSION=202607'); // opcional: header Linkedin-Version (YYYYMM)
