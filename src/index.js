const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data, status = 200, extra = {}) { return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } }); }
function base64url(bytes) { let binary = ""; for (const b of bytes) binary += String.fromCharCode(b); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
async function sha256(value) { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join(""); }
async function sign(value, secret) { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)))); }
async function createSession(user, secret) { const payload = base64url(new TextEncoder().encode(JSON.stringify({ sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 604800 }))); return `${payload}.${await sign(payload, secret)}`; }
async function readSession(request, secret) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const raw = cookieHeader.split(";").map(x => x.trim()).find(x => x.startsWith("nc360_session="))?.slice(14);
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature || signature !== await sign(payload, secret)) return null;
  try { const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)))); return data.exp >= Math.floor(Date.now()/1000) ? data : null; } catch { return null; }
}
function cookie(value, maxAge = 604800) { return `nc360_session=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`; }
async function googleUser(idToken, clientId) {
  if (!idToken || !clientId) throw new Error("Google OAuth no está configurado.");
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) throw new Error("No se pudo validar la identidad de Google.");
  const claims = await response.json();
  if (claims.aud !== clientId || !claims.sub || !claims.email || String(claims.email_verified) !== "true") throw new Error("La identidad de Google no superó la validación.");
  return { sub: claims.sub, email: claims.email.toLowerCase(), name: claims.name || claims.email, picture: claims.picture || null };
}
async function currentUser(request, env) {
  const session = await readSession(request, env.SESSION_SECRET);
  if (!session) return null;
  return env.DB.prepare("SELECT id, email, display_name, avatar_url FROM users WHERE id = ?").bind(session.sub).first();
}
async function isPrimaryAdmin(user, env) { return !!user && !!env.ADMIN_EMAIL && user.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase(); }
async function handleApi(request, env, url) {
  if (request.method === "GET" && url.pathname === "/api/health") return json({ ok: true, app: env.APP_NAME, version: "0.4.0" });
  if (request.method === "GET" && url.pathname === "/api/config") return json({ googleClientId: env.GOOGLE_CLIENT_ID || null });
  if (request.method === "POST" && url.pathname === "/api/auth/google") {
    try {
      const identity = await googleUser((await request.json()).credential, env.GOOGLE_CLIENT_ID);
      let user = await env.DB.prepare("SELECT * FROM users WHERE google_sub = ?").bind(identity.sub).first();
      if (!user) {
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO users (id, google_sub, email, display_name, avatar_url) VALUES (?, ?, ?, ?, ?)").bind(id, identity.sub, identity.email, identity.name, identity.picture).run();
        user = { id, email: identity.email, display_name: identity.name, avatar_url: identity.picture };
      } else {
        await env.DB.prepare("UPDATE users SET email = ?, display_name = ?, avatar_url = ? WHERE id = ?").bind(identity.email, identity.name, identity.picture, user.id).run();
      }
      return json({ ok: true, user: { id: user.id, email: user.email, name: user.display_name } }, 200, { "set-cookie": cookie(await createSession(user, env.SESSION_SECRET)) });
    } catch (error) { return json({ error: error.message || "Error de autenticación." }, 401); }
  }
  if (request.method === "POST" && url.pathname === "/api/auth/logout") return json({ ok: true }, 200, { "set-cookie": cookie("", 0) });
  if (request.method === "GET" && url.pathname === "/api/me") {
    const user = await currentUser(request, env);
    if (!user) return json({ authenticated: false });
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS participant_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id), first_name TEXT NOT NULL, last_name TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))" ).run();
    const membership = await env.DB.prepare("SELECT em.id, em.edition_id, em.status, e.title, e.year FROM edition_members em JOIN editions e ON e.id=em.edition_id WHERE em.user_id=? ORDER BY e.year DESC LIMIT 1").bind(user.id).first();
    const profile = await env.DB.prepare("SELECT first_name, last_name FROM participant_profiles WHERE user_id=?").bind(user.id).first();
    return json({ authenticated: true, user, isPrimaryAdmin: await isPrimaryAdmin(user, env), membership: membership || null, participantProfile: profile || null });
  }
  if (url.pathname.startsWith("/api/admin/")) {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión con Google primero." }, 401);
    if (!(await isPrimaryAdmin(user, env))) return json({ error: "Esta cuenta no es el administrador principal." }, 403);
    if (request.method === "GET" && url.pathname === "/api/admin/status") {
      const workspace = await env.DB.prepare("SELECT id, name FROM workspace LIMIT 1").first();
      const edition = workspace ? await env.DB.prepare("SELECT id, title, year, budget_amount, event_date, status FROM editions WHERE workspace_id = ? ORDER BY year DESC LIMIT 1").bind(workspace.id).first() : null;
      const members = edition ? await env.DB.prepare("SELECT COUNT(*) AS total FROM edition_members WHERE edition_id = ? AND status = 'confirmed'").bind(edition.id).first() : { total: 0 };
      return json({ isPrimaryAdmin: true, email: user.email, initialized: !!edition, edition, participants: members.total || 0 });
    }
    if (request.method === "GET" && url.pathname === "/api/admin/participants") {
      const edition = await env.DB.prepare("SELECT id FROM editions ORDER BY year DESC LIMIT 1").first();
      if (!edition) return json({ participants: [] });
      const result = await env.DB.prepare("SELECT em.user_id, COALESCE(NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''), u.display_name) AS display_name, u.email, u.avatar_url, em.status, em.joined_at FROM edition_members em JOIN users u ON u.id=em.user_id LEFT JOIN participant_profiles p ON p.user_id=em.user_id WHERE em.edition_id=? ORDER BY em.joined_at ASC").bind(edition.id).all();
      return json({ participants: result.results || [] });
    }
    if (request.method === "PATCH" && url.pathname.startsWith("/api/admin/participants/")) {
      const userId = decodeURIComponent(url.pathname.split("/").pop());
      const body = await request.json();
      const edition = await env.DB.prepare("SELECT id FROM editions ORDER BY year DESC LIMIT 1").first();
      if (!edition || typeof body.active !== "boolean") return json({ error: "Solicitud inválida." }, 400);
      const result = await env.DB.prepare("UPDATE edition_members SET status=? WHERE edition_id=? AND user_id=?").bind(body.active ? "confirmed" : "withdrawn", edition.id, userId).run();
      if (!result.meta.changes) return json({ error: "Participante no encontrado." }, 404);
      return json({ ok: true });
    }
    if (url.pathname.startsWith("/api/admin/exclusions")) {
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS edition_exclusions (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, user_a_id TEXT NOT NULL REFERENCES users(id), user_b_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now')), CHECK(user_a_id <> user_b_id), UNIQUE(edition_id, user_a_id, user_b_id))").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_exclusions_edition ON edition_exclusions(edition_id)").run();
    }
    if (request.method === "GET" && url.pathname === "/api/admin/exclusions") {
      const edition = await env.DB.prepare("SELECT id FROM editions ORDER BY year DESC LIMIT 1").first();
      if (!edition) return json({ exclusions: [] });
      const result = await env.DB.prepare("SELECT x.id, x.user_a_id, x.user_b_id, a.display_name AS user_a_name, b.display_name AS user_b_name FROM edition_exclusions x JOIN users a ON a.id=x.user_a_id JOIN users b ON b.id=x.user_b_id WHERE x.edition_id=? ORDER BY x.created_at DESC").bind(edition.id).all();
      return json({ exclusions: result.results || [] });
    }
    if (request.method === "POST" && url.pathname === "/api/admin/exclusions") {
      const body = await request.json();
      const edition = await env.DB.prepare("SELECT id FROM editions ORDER BY year DESC LIMIT 1").first();
      if (!edition || !body.userA || !body.userB || body.userA === body.userB) return json({ error: "Selecciona dos participantes diferentes." }, 400);
      const members = await env.DB.prepare("SELECT user_id FROM edition_members WHERE edition_id=? AND status='confirmed' AND user_id IN (?, ?)").bind(edition.id, body.userA, body.userB).all();
      if ((members.results || []).length !== 2) return json({ error: "Ambas personas deben estar activas en esta edición." }, 400);
      const [a, b] = [body.userA, body.userB].sort();
      const existing = await env.DB.prepare("SELECT id FROM edition_exclusions WHERE edition_id=? AND user_a_id=? AND user_b_id=?").bind(edition.id, a, b).first();
      if (existing) return json({ error: "Esa exclusión ya existe." }, 409);
      await env.DB.prepare("INSERT INTO edition_exclusions (id, edition_id, user_a_id, user_b_id) VALUES (?, ?, ?, ?)").bind(crypto.randomUUID(), edition.id, a, b).run();
      return json({ ok: true });
    }
    if (request.method === "DELETE" && url.pathname.startsWith("/api/admin/exclusions/")) {
      const id = decodeURIComponent(url.pathname.split("/").pop());
      const result = await env.DB.prepare("DELETE FROM edition_exclusions WHERE id=?").bind(id).run();
      if (!result.meta.changes) return json({ error: "Exclusión no encontrada." }, 404);
      return json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/api/admin/bootstrap") {
      if (await env.DB.prepare("SELECT id FROM workspace LIMIT 1").first()) return json({ error: "El grupo principal ya fue inicializado." }, 409);
      const body = await request.json();
      const title = String(body.title || "Navidad Cliente 360 2026").slice(0, 100);
      const year = Number(body.year || 2026);
      const budget = body.budgetAmount === "" || body.budgetAmount == null ? null : Number(body.budgetAmount);
      if (!Number.isInteger(year) || year < 2026 || (budget !== null && (!Number.isFinite(budget) || budget < 0))) return json({ error: "Año o presupuesto inválido." }, 400);
      const workspaceId = crypto.randomUUID(), editionId = crypto.randomUUID(), membershipId = crypto.randomUUID(), invitationId = crypto.randomUUID();
      const token = base64url(crypto.getRandomValues(new Uint8Array(24))), tokenHash = await sha256(token);
      await env.DB.batch([
        env.DB.prepare("INSERT INTO workspace (id, name, owner_user_id) VALUES (?, ?, ?)").bind(workspaceId, "Cliente 360", user.id),
        env.DB.prepare("INSERT INTO memberships (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')").bind(membershipId, workspaceId, user.id),
        env.DB.prepare("INSERT INTO editions (id, workspace_id, title, year, budget_amount, event_date, status) VALUES (?, ?, ?, ?, ?, ?, 'registration')").bind(editionId, workspaceId, title, year, budget, body.eventDate || null),
        env.DB.prepare("INSERT INTO invitations (id, edition_id, token_hash, expires_at, max_uses) VALUES (?, ?, ?, ?, ?)").bind(invitationId, editionId, tokenHash, body.expiresAt || null, Math.max(1, Math.min(500, Number(body.maxUses || 100))))
      ]);
      return json({ ok: true, edition: { id: editionId, title, year }, invitationUrl: `${url.origin}/?invite=${token}` });
    }
    if (request.method === "POST" && url.pathname === "/api/admin/invitations") {
      const body = await request.json();
      const edition = await env.DB.prepare("SELECT id FROM editions ORDER BY year DESC LIMIT 1").first();
      if (!edition) return json({ error: "Primero crea la edición." }, 409);
      const token = base64url(crypto.getRandomValues(new Uint8Array(24))), hash = await sha256(token);
      await env.DB.prepare("INSERT INTO invitations (id, edition_id, token_hash, max_uses) VALUES (?, ?, ?, ?)").bind(crypto.randomUUID(), edition.id, hash, Math.max(1, Math.min(500, Number(body.maxUses || 1)))).run();
      return json({ ok: true, invitationUrl: `${url.origin}/?invite=${token}` });
    }
    return json({ error: "Ruta administrativa no encontrada." }, 404);
  }
  if (request.method === "POST" && url.pathname === "/api/profile/participant") {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión con Google primero." }, 401);
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS participant_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id), first_name TEXT NOT NULL, last_name TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))" ).run();
    const member = await env.DB.prepare("SELECT id FROM edition_members WHERE user_id=? AND status='confirmed' ORDER BY joined_at DESC LIMIT 1").bind(user.id).first();
    if (!member) return json({ error: "Primero confirma tu participación." }, 403);
    const body = await request.json();
    const firstName = String(body.firstName || "").trim().replace(/\\s+/g," ");
    const lastName = String(body.lastName || "").trim().replace(/\\s+/g," ");
    if (firstName.length < 2 || lastName.length < 2 || firstName.length > 80 || lastName.length > 100) return json({ error: "Ingresa nombres y apellidos válidos." }, 400);
    await env.DB.prepare("INSERT INTO participant_profiles (user_id, first_name, last_name, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET first_name=excluded.first_name, last_name=excluded.last_name, updated_at=datetime('now')").bind(user.id, firstName, lastName).run();
    return json({ ok: true, profile: { firstName, lastName } });
  }
  const inviteMatch = url.pathname.match(/^\/api\/invitations\/([A-Za-z0-9_-]+)$/);
  if (request.method === "GET" && inviteMatch) {
    const tokenHash = await sha256(inviteMatch[1]);
    const invite = await env.DB.prepare("SELECT i.id, i.expires_at, i.max_uses, i.uses, i.revoked_at, e.title, e.year, e.status FROM invitations i JOIN editions e ON e.id=i.edition_id WHERE i.token_hash=?").bind(tokenHash).first();
    if (!invite || invite.revoked_at || invite.uses >= invite.max_uses || (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now())) return json({ valid: false }, 404);
    return json({ valid: true, edition: { title: invite.title, year: invite.year, status: invite.status } });
  }
  if (request.method === "POST" && url.pathname === "/api/invitations/join") {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión para participar." }, 401);
    const body = await request.json(); if (!body.token) return json({ error: "Falta el código de invitación." }, 400);
    const hash = await sha256(body.token);
    const invite = await env.DB.prepare("SELECT id, edition_id, expires_at, max_uses, uses, revoked_at FROM invitations WHERE token_hash=?").bind(hash).first();
    if (!invite || invite.revoked_at || invite.uses >= invite.max_uses || (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now())) return json({ error: "La invitación no es válida o ya venció." }, 404);
    const existing = await env.DB.prepare("SELECT id FROM edition_members WHERE edition_id=? AND user_id=?").bind(invite.edition_id, user.id).first();
    if (!existing) {
      const memberId = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO edition_members (id, edition_id, user_id) VALUES (?, ?, ?)").bind(memberId, invite.edition_id, user.id).run();
      await env.DB.prepare("UPDATE invitations SET uses=uses+1 WHERE id=? AND uses<max_uses").bind(invite.id).run();
    }
    return json({ ok: true, message: "Ya formas parte de la edición." });
  }
  return json({ error: "Ruta no encontrada." }, 404);
}
export default { async fetch(request, env) { const url = new URL(request.url); if (url.pathname.startsWith("/api/")) return handleApi(request, env, url); return env.ASSETS.fetch(request); } };
