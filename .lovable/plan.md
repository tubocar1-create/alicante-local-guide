# Sistema de Autenticación y Gestión de Usuarios

Implementación end-to-end sobre Lovable Cloud (Supabase Auth) respetando lo ya existente: hay `useBusinessAuth`, tabla `profiles`, `user_roles`, trigger `handle_new_user`, `assign_admin_role_if_allowed`, y rutas `business.login` / `business.onboarding`. El público hoy usa un sistema "beta" simulado (`beta_user_v1` en localStorage vía `useAuth` + `/magic`). Vamos a **añadir** auth real para todos los usuarios sin romper el flujo beta existente.

## Alcance

### 1. Base de datos (migración)
- Ampliar `profiles` con: `full_name`, `city`, `language`, `terms_accepted_at`, `last_seen_at`, `login_method`, `blocked` (bool, futuro). `avatar_url` ya existe.
- Tabla `user_consents` (user_id, type, accepted_at, version) para timestamp de consentimientos.
- Tabla `user_permissions` (user_id, permission ['geolocation'|'microphone'], granted bool, updated_at) para registrar permisos del navegador.
- Trigger `update_last_seen` opcional vía RPC ligero (`touch_last_seen()`).
- Asegurar RLS: cada usuario lee/edita su propio perfil/consents/permissions; admin (vía `has_role`) lee todo.
- Storage bucket `avatars` (público) con políticas: upload solo en carpeta `{user_id}/`.

### 2. Auth (cliente)
- Habilitar Google OAuth managed (`configure_social_auth: ["google"]`) sin desactivar email.
- **No** activar auto-confirm: verificación email obligatoria.
- Hook unificado `useAppAuth` (basado en `useBusinessAuth`, expuesto para toda la app) con: `user`, `session`, `profile`, `roles`, `isAuthenticated`, `emailVerified`, `signOut`.
- Mantener `useAuth` beta intacto (no romper rutas que dependen).

### 3. Rutas nuevas
- `/auth/signup` — email + password + confirmar + nombre + checkbox términos. Validación con zod, errores amigables.
- `/auth/login` — email/password + botón Google (vía `lovable.auth.signInWithOAuth`).
- `/auth/forgot-password` — pide email → `resetPasswordForEmail` con `redirectTo: /auth/reset-password`.
- `/auth/reset-password` — detecta `type=recovery`, formulario nueva contraseña, `updateUser`.
- `/auth/verify-email` — pantalla post-signup con botón "Reenviar correo" y mensaje 📩.
- `/auth/callback` — landing del OAuth si hace falta (sino redirect a `/`).
- `/perfil` ya existe → reemplazar/ampliar con: avatar (upload a bucket), nombre, ciudad, idioma, método login, estado verificación, permisos activos, botón **Cerrar sesión**.
- `/admin/usuarios` ya existe → reescribir como tabla real de `auth.users` + `profiles`: email, verificado, último acceso, método, permisos, rol. Solo `admin`.

### 4. Permisos contextuales
- Componente `<PermissionPrompt type="geolocation|microphone">` reutilizable con copy explicativo y botón "Permitir / Ahora no".
- Al conceder/denegar, persistir en `user_permissions` (si hay sesión) y en `localStorage` (fallback anónimo).
- Hook `useGeolocationPermission` y `useMicrophonePermission` que leen `navigator.permissions.query`.
- Degradación elegante: si denegado, ocultar features o mostrar CTA secundario.

### 5. Política de datos
- Páginas `/legal/privacidad` y `/legal/terminos` (placeholder con copy básico, editable).
- Checkbox obligatorio en signup → inserta fila en `user_consents` con timestamp y versión.
- Link visible en footer del signup.

### 6. Sesión
- `onAuthStateChange` ya cableado en `__root.tsx` (verificar). Añadir invalidación de queries.
- Auto-refresh token (default de supabase-js, ya activo).
- `last_seen_at` update on app open (RPC ligero o update directo con RLS propia).
- Botón Sign Out en perfil + en menú lateral si existe.

### 7. Admin Usuarios
- Server fn `listUsersAdmin` con `requireSupabaseAuth` + check `has_role(admin)` que usa `supabaseAdmin.auth.admin.listUsers()` y joinea `profiles`, `user_permissions`, `user_roles`.
- UI: tabla con búsqueda, paginación, columnas: email, verificado ✅, método (`identities[0].provider`), último acceso, creado, permisos, rol.
- Acción "Bloquear" deshabilitada (futuro), pero columna preparada.

### 8. UX
- Mobile-first, diseño coherente con el resto (Tailwind tokens existentes, rounded-3xl, soft shadows).
- Toasts con `sonner` para errores/éxitos.
- Max 2 pasos en onboarding (signup → verificar email → entra).

## Detalles técnicos

- **Google OAuth**: usar exclusivamente `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`. Llamar `supabase--configure_social_auth providers:["google"]` en el mismo turno.
- **Email signup**: `supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/auth/verify-email", data: { full_name } } })`. El trigger `handle_new_user` ya crea profile.
- **Reset**: `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + "/auth/reset-password" })`.
- **Avatar storage**: bucket `avatars` público, política insert/update `auth.uid()::text = (storage.foldername(name))[1]`.
- **Admin listUsers**: server fn dedicada, NO exponer service role al cliente.
- **RLS profiles**: las policies actuales (todos pueden leer) son aceptables si solo exponemos campos públicos. Restringir UPDATE a `auth.uid() = id`.
- **No tocar** `useAuth` (beta) ni `/magic` ni `/login` actual del beta (queda como acceso beta paralelo). Las nuevas rutas viven bajo `/auth/*` para no colisionar.

## Lo que NO hago en este pase
- Bloqueo real de usuarios (solo dejo columna `blocked`).
- Favoritos / historial / rutas recientes (campos futuros).
- Borrado de cuenta (no pedido explícitamente).
- Editor de contenido legal (páginas con copy fijo inicial).

## Pasos de ejecución
1. Migración SQL (tablas, columnas, bucket, RLS).
2. `configure_social_auth` Google.
3. Hook `useAppAuth` + componentes auth (signup/login/forgot/reset/verify).
4. Rutas `/auth/*` y refactor `/perfil`.
5. Componentes de permisos + persistencia.
6. Páginas legales placeholder.
7. Server fn admin + refactor `/admin/usuarios`.
8. Verificar build, smoke test del flujo.

¿Apruebas el plan para implementar?