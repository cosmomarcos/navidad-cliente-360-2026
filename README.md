# Navidad Cliente 360 · 2026

Aplicación PWA para organizar el intercambio navideño del equipo Cliente 360. La participación está restringida a personas con una invitación válida.

## Versión

**1.8.1 — Puntos de Espíritu Navideño basados en Me gusta.**

## Funcionalidades

- Inicio navideño responsive e instalable como PWA, con ubicación, horario y vista previa del mapa del intercambio.
- Lista pública de participantes con contador dinámico en la pantalla de inicio.
- Inicio de sesión con Google y sesiones mediante cookie HttpOnly, Secure y SameSite=Lax.
- Invitaciones privadas para incorporarse a la edición.
- Perfil de participante y administración de integrantes.
- Configuración del presupuesto y fecha del intercambio.
- Sorteo privado con exclusiones mutuas.
- Consulta individual de la asignación del amigo secreto.
- Lista de deseos con notas, enlaces e imágenes.
- Buzón privado para recibir y enviar mensajes anónimos al amigo secreto.

El chat comunitario general fue retirado. La migración `0004_remove_legacy_community_chat.sql` elimina exclusivamente el historial de ese chat; no elimina usuarios, integrantes, perfiles, invitaciones, deseos ni asignaciones del sorteo.

## Arquitectura

- Frontend: HTML, CSS y JavaScript en `public/`.
- Backend: Cloudflare Worker en `src/index.js`.
- Persistencia: Cloudflare D1.
- Autenticación: Google Identity Services validado en el backend.
- PWA: manifest y Service Worker.

## Configuración requerida en Cloudflare

El archivo `wrangler.toml` contiene el nombre del Worker y el binding D1 de producción. Verifica que el Worker tenga estos valores configurados:

**Secretos**
- `GOOGLE_CLIENT_ID`: ID del cliente OAuth web de Google.
- `SESSION_SECRET`: secreto aleatorio robusto de al menos 32 bytes.

**Variables**
- `ADMIN_EMAIL`: correo Google exacto del administrador principal.
- `APP_NAME` y `EDITION_YEAR`: ya declaradas en `wrangler.toml`.

En Google Cloud Console, registra el dominio de producción como origen JavaScript autorizado y configura el cliente OAuth web correspondiente.

## Preparación de base de datos

Antes de activar la versión 1.0.0, revisa el destino D1 y aplica las migraciones pendientes:

```bash
npm install
npm run db:remote
```

La migración 0004 elimina únicamente la tabla del antiguo chat comunitario. No ejecutes migraciones contra una base distinta de la producción prevista.

## Validación local

Requisitos: Node.js 22 o superior.

```bash
npm install
npm test
npx wrangler dev
```

El flujo de validación de GitHub Actions ejecuta:
- Comprobación sintáctica de los archivos JavaScript.
- Validación del manifest PWA.
- Empaquetado de Wrangler en modo dry-run, sin desplegar.

## Lanzamiento

1. Confirmar secretos y variables del Worker en Cloudflare.
2. Confirmar que el binding D1 apunta a `navidad-cliente-360-db`.
3. Aplicar las migraciones pendientes en D1 de producción.
4. Revisar el resultado de GitHub Actions en la rama de release.
5. Integrar la rama `release/v1.0.0` en `main` únicamente con validaciones aprobadas.
6. Cloudflare Workers Builds desplegará automáticamente los commits de `main`.
7. Verificar `GET /api/health`, login, invitación, sesión, buzón secreto, deseos y consulta de asignación después del despliegue.

## Seguridad y operación

- Las mutaciones de la API requieren un encabezado Origin que coincida con el origen de la aplicación.
- El consumo de invitaciones reserva cada uso con una actualización condicional para evitar exceder el límite por solicitudes concurrentes.
- Las asignaciones del sorteo se generan con aleatoriedad criptográfica del entorno.
- Las respuestas de error del Worker no exponen detalles internos.
- Las rutas administrativas requieren sesión válida y coincidencia con `ADMIN_EMAIL`.
- Las rutas de API no se sirven desde la caché del Service Worker.
- El chat general y su tarea programada de retención ya no forman parte del Worker.

**Importante:** el dry-run y las pruebas estáticas no sustituyen las pruebas funcionales en el dominio de producción ni la verificación de secretos y permisos en Cloudflare.


## Notificaciones de pistas · v1.1.0

Los participantes pueden activar notificaciones push desde **Mensajes → Buzón secreto → Activar notificaciones**. Cuando su amigo secreto envía un mensaje, el destinatario recibe una notificación push incluso si la aplicación no está abierta; el aviso dice “Tu amigo secreto te envio un mensaje” y, al tocarlo, abre el buzón. La pestaña Mensajes también muestra un contador de pistas sin leer.

### Configuración adicional en Cloudflare

- Variable pública `VAPID_PUBLIC_KEY`: ya incluida en `wrangler.toml`.
- Secreto `VAPID_PRIVATE_KEY`: configurar una sola vez en el Worker mediante `npx wrangler secret put VAPID_PRIVATE_KEY`. Nunca guardar este valor en el repositorio.
- Las tablas `push_subscriptions` y `anonymous_clue_reads` se crean automáticamente al usar las funciones correspondientes.

La suscripción se registra por dispositivo/navegador. Cada participante debe activar las notificaciones en cada dispositivo donde quiera recibirlas. En iPhone/iPad, instalar la PWA en la pantalla de inicio antes de activar las notificaciones.


## Espíritu Navideño · puntos por interacción (v1.8.1)

- Enviar una participación no otorga puntos.
- Cada Me gusta de otro participante suma 1 punto al autor, hasta 10 puntos por publicación.
- Se puede retirar el Me gusta; al hacerlo también se descuenta el punto correspondiente.
- No se permiten auto-likes ni votos duplicados.
- Al cerrar cada reto diario, la publicación con más Me gusta recibe 10 puntos adicionales. Si hay empate en el primer lugar, todos los empatados reciben la bonificación.
- El límite de 10 puntos por likes se reinicia en cada reto diario.
- La migración `0008_spirit_likes_scoring.sql` elimina los puntos antiguos por publicar y la bonificación anterior por alcanzar tres votos, para que el ranking arranque con reglas consistentes.

Aplicar la migración antes del despliegue:

```bash
npx wrangler d1 migrations apply navidad-cliente-360-db --remote
npx wrangler deploy
```
