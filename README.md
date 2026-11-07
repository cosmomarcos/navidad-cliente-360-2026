# Navidad Cliente 360 2026

PWA pública para presentar la celebración; la participación en la edición se limita a personas con invitación válida.

## Versión 0.1.0

Incluye:
- Landing page navideña responsive.
- Manifest y Service Worker para instalación PWA.
- Worker con API inicial.
- Esquema D1 para usuarios, grupo, edición, invitaciones y miembros.
- Validación de Google ID token en backend.
- Sesión firmada en cookie HttpOnly, Secure y SameSite=Lax.
- Invitaciones almacenadas como hash y flujo de incorporación.
- Endpoint de salud.

No incluye todavía el panel de administración para crear invitaciones ni los módulos de sorteo, chat, deseos, pistas y notificaciones. Se implementarán en siguientes versiones.

## Requisitos

- Node.js LTS
- Cuenta Cloudflare
- Proyecto OAuth de Google con Google Identity Services habilitado

## Configuración inicial

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Crea la base D1:

   ```bash
   npx wrangler d1 create navidad-cliente-360-db
   ```

3. Copia el `database_id` devuelto a `wrangler.toml`.

4. Aplica migraciones:

   ```bash
   npm run db:remote
   ```

5. Configura secretos:

   ```bash
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put SESSION_SECRET
   ```

   `SESSION_SECRET` debe ser una cadena aleatoria robusta de al menos 32 bytes.

6. En Google Cloud Console configura el origen autorizado de tu dominio y el cliente OAuth para web.

7. Ejecuta localmente:

   ```bash
   npm run dev
   ```

8. Despliega:

   ```bash
   npm run deploy
   ```

## Importante antes de producción

- Configurar `ADMIN_EMAIL` con el correo Google que inicializará el grupo.
- Después de iniciar sesión como administrador, invocar `POST /api/admin/bootstrap` con `{ "title": "Navidad Cliente 360 2026", "year": 2026, "budgetAmount": 80, "eventDate": "2026-12-18", "maxUses": 100 }`. El endpoint crea el workspace, la edición y un enlace de invitación. Guardar ese enlace: el token solo se muestra una vez.
- Restringir CORS si se separa el frontend del Worker.
- Añadir protección CSRF a mutaciones autenticadas.
- Añadir rate limiting para login e invitaciones.
- Implementar el alta inicial del workspace, edición 2026 y generación de invitaciones desde un panel administrativo protegido.
- Revisar transacciones de consumo de invitaciones para concurrencia; se requiere una operación condicional atómica.
- Añadir pruebas automatizadas y revisión de seguridad.

## Modelo de despliegue

El Worker sirve los recursos estáticos desde `public/` y enruta `/api/*` al backend. D1 es la única base persistente de esta primera fase.
