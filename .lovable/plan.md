## Objetivo

Reducir las llamadas a Google API a su mínima expresión: **una sola vez por dato, y para siempre**. Los refrescos los decide la administración (botón manual o cron muy espaciado, no por visita de usuario).

## Principio

Hay 2 tipos de llamadas a Google y cada una tiene su tratamiento:

1. **Fotos** (Places Photos) → se descargan **una vez** y se guardan como archivo en nuestro Storage. A partir de ahí, las imágenes se sirven desde nuestro propio dominio. Google no se vuelve a llamar **nunca** para esa foto.
2. **Datos** (searchText, place details, nearby) → se guardan en base de datos **sin caducidad automática**. Solo se refrescan cuando el admin pulsa "Refrescar" o por un cron mensual/bimestral.

## Cambios concretos

### 1. Proxy único de fotos `/api/public/google-photo/$`
- Generalizar el patrón que ya usa `shop-photo.$.ts`.
- Acepta cualquier referencia `places/{placeId}/photos/{photoId}`.
- Flujo: ¿existe en Storage? → redirigir. Si no → 1 llamada a Google, descargar bytes, subir a Storage, redirigir. **Nunca más se vuelve a llamar a Google para esa foto.**

### 2. Migrar todos los call-sites de fotos al proxy
Eliminar las llamadas directas a `places.googleapis.com/.../media` en:
- `hotels.server.ts` → `main_image` deja de ser una URL firmada con la API key; pasa a ser una URL del proxy. (Bonus: ya no se filtra la API key en el HTML).
- `hotels.functions.ts` → `getHotelPhotos` devuelve URLs del proxy, no llama a Google.
- `places.functions.ts` → `resolvePhotoUri` y `getPlacePhotos` devuelven URLs del proxy.
- `health.functions.ts` y `health-google.functions.ts` → idem.

Resultado: **0 llamadas a Google por visita de usuario** una vez que la foto se ha cacheado la primera vez.

### 3. Datos (searchText / details / nearby) sin auto-refresco
- Subir `STALE_MS` de `places_cache` de 60 días a **infinito** (solo refresco manual).
- `hotels_static`: ya es manual. Quitar cualquier llamada a `syncStaticHotelsImpl` desde rutas públicas o loaders. Solo se invoca desde admin.
- Confirmar que `playas-map`, `bus-geocode`, `health-google` solo se llaman bajo demanda y cachean lo que devuelven.

### 4. Panel admin "Refresco de datos Google"
Nueva sección en `/admin/consumo-google` (o página dedicada `/admin/refresco-google`) con botones para disparar manualmente:
- Refrescar hoteles (re-ejecuta `syncStaticHotelsImpl`).
- Refrescar restaurantes por categoría (places_cache).
- Refrescar fotos de playas.
- Refrescar lugares de salud.
Cada botón muestra: última fecha de refresco, nº de registros, llamadas estimadas.

### 5. Cron opcional (muy espaciado)
Dejar preparado pero **desactivado por defecto**: un cron mensual/bimestral que llama a los mismos endpoints de admin. Lo activa el admin si quiere.

## Resultado esperado

| Antes | Después |
|---|---|
| Cada visita a `/hotel/:id` → hasta 20 llamadas a Google | 0 llamadas (todo en Storage) |
| Cada `<img main_image>` de hotel → 1 llamada Google | 0 llamadas (URL del proxy) |
| Lista de restaurantes → fotos via Google cada vez | 0 llamadas (proxy + Storage) |
| `places_cache` se refresca solo a los 60 días | Nunca, salvo botón admin |
| Coste Google previsto | ~0 € en régimen permanente, picos solo al refrescar manualmente |

## Detalles técnicos

- El proxy guarda en bucket público `shop-photos` (reutilizar) bajo `places/{placeId}/photos/{photoId}/w{width}.jpg`.
- Para `hotels_static.main_image`: durante el próximo `syncStaticHotelsImpl`, guardar la **referencia `photo.name`** en `raw`, y construir `main_image` como `/api/public/google-photo/{photo.name}?w=600`. Backfill: una migración SQL que reescribe los `main_image` existentes desde `raw.photos[0].name`.
- Plan de borrado: no se borra nada. Si una foto cambia en Google, el admin pulsa "Invalidar foto" (botón opcional) que borra el objeto del bucket y la siguiente petición la vuelve a descargar.

¿Confirmas y lo implemento en este orden? (1) proxy genérico, (2) migrar hotels (sangrado nº1), (3) migrar places/health, (4) admin de refresco.
