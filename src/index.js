import { buildPushPayload } from "@block65/webcrypto-web-push";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data, status = 200, extra = {}) { return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } }); }
function base64url(bytes) { let binary = ""; for (const b of bytes) binary += String.fromCharCode(b); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
async function sha256(value) { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join(""); }
function secureRandomInt(max) {
  const range = 0x100000000;
  const limit = Math.floor(range / max) * max;
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= limit);
  return value[0] % max;
}
function shuffled(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
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
async function ensureDrawSchema(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS edition_exclusions (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, user_a_id TEXT NOT NULL REFERENCES users(id), user_b_id TEXT NOT NULL REFERENCES users(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP, CHECK(user_a_id <> user_b_id), UNIQUE(edition_id, user_a_id, user_b_id))").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS edition_draw_state (edition_id TEXT PRIMARY KEY REFERENCES editions(id) ON DELETE CASCADE, state TEXT NOT NULL DEFAULT 'registration', ready_at TEXT, drawn_at TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS draw_assignments (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, giver_user_id TEXT NOT NULL REFERENCES users(id), recipient_user_id TEXT NOT NULL REFERENCES users(id), run_number INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(edition_id, giver_user_id))").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS draw_runs (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, run_number INTEGER NOT NULL, status TEXT NOT NULL, participant_count INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_draw_assignments_edition ON draw_assignments(edition_id)").run();
}
function buildSecretAssignments(members, exclusions) {
  const blocked = new Set(exclusions.flatMap(x => [x.user_a_id + ":" + x.user_b_id, x.user_b_id + ":" + x.user_a_id]));
  const recipients = shuffled(members);
  const assigned = new Map(), used = new Set(); let steps = 0;
  function solve(index) {
    if (index === members.length) return true;
    if (++steps > 250000) return false;
    const giver = members[index];
    const candidates = shuffled(recipients.filter(r => r.user_id !== giver.user_id && !used.has(r.user_id) && !blocked.has(giver.user_id + ":" + r.user_id)));
    for (const recipient of candidates) {
      assigned.set(giver.user_id, recipient.user_id); used.add(recipient.user_id);
      if (solve(index + 1)) return true;
      used.delete(recipient.user_id); assigned.delete(giver.user_id);
    }
    return false;
  }
  return solve(0) ? members.map(m => ({ giver_user_id: m.user_id, recipient_user_id: assigned.get(m.user_id) })) : null;
}

async function sendPushToUser(env, userId, payload, subject) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  const rows = await env.DB.prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id=?").bind(userId).all();
  await Promise.all((rows.results || []).map(async row => {
    try {
      const subscription = { endpoint: row.endpoint, expirationTime: null, keys: { p256dh: row.p256dh, auth: row.auth } };
      const init = await buildPushPayload({ data: JSON.stringify(payload), options: { ttl: 3600 } }, subscription, {
        subject, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY
      });
      const response = await fetch(row.endpoint, init);
      if (response.status === 404 || response.status === 410) await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint=?").bind(row.endpoint).run();
      else if (!response.ok) console.warn("Web Push delivery failed", { status: response.status });
    } catch (error) { console.warn("Web Push delivery error", error?.message || String(error)); }
  }));
}

async function handleApi(request, env, url) {
  if (request.method === "GET" && url.pathname === "/api/health") return json({ ok: true, app: env.APP_NAME, version: "1.1.0" });
  if (request.method === "GET" && url.pathname === "/api/config") return json({ googleClientId: env.GOOGLE_CLIENT_ID || null });
  if (request.method === "GET" && url.pathname === "/api/push/public-key") {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión primero." }, 401);
    return json({ publicKey: env.VAPID_PUBLIC_KEY || null });
  }
  if (url.pathname.startsWith("/api/push/")) {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión primero." }, 401);
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
    if (request.method === "POST" && url.pathname === "/api/push/subscribe") {
      const body = await request.json(), endpoint = String(body.endpoint || "");
      const p256dh = String(body.keys?.p256dh || ""), auth = String(body.keys?.auth || "");
      if (!endpoint.startsWith("https://") || endpoint.length > 2048 || !p256dh || !auth || p256dh.length > 256 || auth.length > 128) return json({ error: "La suscripción de notificaciones no es válida." }, 400);
      const membership = await env.DB.prepare("SELECT id FROM edition_members WHERE user_id=? AND status='confirmed' ORDER BY joined_at DESC LIMIT 1").bind(user.id).first();
      if (!membership) return json({ error: "Necesitas una participación activa para activar notificaciones." }, 403);
      await env.DB.prepare("INSERT INTO push_subscriptions (id,user_id,endpoint,p256dh,auth) VALUES (?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,updated_at=datetime('now')").bind(crypto.randomUUID(),user.id,endpoint,p256dh,auth).run();
      return json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/api/push/unsubscribe") {
      const body = await request.json();
      await env.DB.prepare("DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?").bind(user.id,String(body.endpoint || "")).run();
      return json({ ok: true });
    }
    return json({ error: "Ruta de notificaciones no encontrada." }, 404);
  }
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
    const membership = await env.DB.prepare("SELECT em.id, em.edition_id, em.status, e.title, e.year, e.event_date, e.budget_amount, e.currency FROM edition_members em JOIN editions e ON e.id=em.edition_id WHERE em.user_id=? ORDER BY e.year DESC LIMIT 1").bind(user.id).first();
    const profile = await env.DB.prepare("SELECT first_name, last_name FROM participant_profiles WHERE user_id=?").bind(user.id).first();
    return json({ authenticated: true, user, isPrimaryAdmin: await isPrimaryAdmin(user, env), membership: membership || null, participantProfile: profile || null });
  }
  if (request.method === "GET" && url.pathname === "/api/participants") {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión primero." }, 401);
    const membership = await env.DB.prepare("SELECT edition_id FROM edition_members WHERE user_id=? AND status='confirmed' ORDER BY joined_at DESC LIMIT 1").bind(user.id).first();
    if (!membership) return json({ error: "Necesitas una participación activa para consultar la lista." }, 403);
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS participant_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id), first_name TEXT NOT NULL, last_name TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
    const result = await env.DB.prepare("SELECT em.user_id, COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS display_name, u.avatar_url FROM edition_members em JOIN users u ON u.id=em.user_id LEFT JOIN participant_profiles p ON p.user_id=em.user_id WHERE em.edition_id=? AND em.status='confirmed' ORDER BY em.joined_at ASC").bind(membership.edition_id).all();
    return json({ participants: result.results || [], total: (result.results || []).length });
  }
  if (url.pathname.startsWith("/api/admin/")) {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión con Google primero." }, 401);
    if (!(await isPrimaryAdmin(user, env))) return json({ error: "Esta cuenta no es el administrador principal." }, 403);
    if (request.method === "PATCH" && url.pathname === "/api/admin/edition") {
      const body = await request.json();
      const edition = await env.DB.prepare("SELECT id, status FROM editions ORDER BY year DESC LIMIT 1").first();
      if (!edition) return json({ error: "No hay una edición configurada." }, 404);
      if (edition.status !== "registration") return json({ error: "Los ajustes están bloqueados porque el sorteo ya fue realizado o la edición terminó." }, 409);
      const title = String(body.title || "").trim();
      const eventDate = body.eventDate ? String(body.eventDate) : null;
      const budget = body.budgetAmount === "" || body.budgetAmount == null ? null : Number(body.budgetAmount);
      if (title.length < 3 || title.length > 100) return json({ error: "El nombre debe tener entre 3 y 100 caracteres." }, 400);
      if (eventDate && !/^\\d{4}-\\d{2}-\\d{2}$/.test(eventDate)) return json({ error: "La fecha del intercambio no es válida." }, 400);
      if (budget !== null && (!Number.isFinite(budget) || budget < 0 || budget > 1000000)) return json({ error: "El presupuesto debe ser un monto válido." }, 400);
      await env.DB.prepare("UPDATE editions SET title=?, event_date=?, budget_amount=? WHERE id=?").bind(title, eventDate, budget, edition.id).run();
      return json({ ok: true });
    }
    if (url.pathname.startsWith("/api/admin/draw/")) {
      await ensureDrawSchema(env);
      const edition = await env.DB.prepare("SELECT id, status FROM editions ORDER BY year DESC LIMIT 1").first();
      if (!edition) return json({ error: "No hay una edición configurada." }, 404);
      if (request.method === "GET" && url.pathname === "/api/admin/draw/status") {
        const state = await env.DB.prepare("SELECT state, ready_at, drawn_at FROM edition_draw_state WHERE edition_id=?").bind(edition.id).first();
        const members = await env.DB.prepare("SELECT em.user_id, p.first_name, p.last_name FROM edition_members em LEFT JOIN participant_profiles p ON p.user_id=em.user_id WHERE em.edition_id=? AND em.status='confirmed'").bind(edition.id).all();
        const exclusions = await env.DB.prepare("SELECT user_a_id, user_b_id FROM edition_exclusions WHERE edition_id=?").bind(edition.id).all();
        const missing = (members.results || []).filter(m => !m.first_name || !m.last_name);
        return json({ state: state?.state || "registration", readyAt: state?.ready_at || null, drawnAt: state?.drawn_at || null, participants: (members.results || []).length, missingProfiles: missing.length, exclusions: (exclusions.results || []).length, editionStatus: edition.status });
      }
      if (request.method === "POST" && url.pathname === "/api/admin/draw/ready") {
        if (edition.status === "drawn" || edition.status === "completed") return json({ error: "El sorteo ya se realizó. Usa Volver a sortear para reiniciar el proceso." }, 409);
        const members = await env.DB.prepare("SELECT em.user_id, p.first_name, p.last_name FROM edition_members em LEFT JOIN participant_profiles p ON p.user_id=em.user_id WHERE em.edition_id=? AND em.status='confirmed'").bind(edition.id).all();
        const list = members.results || [];
        if (list.length < 2) return json({ error: "Se necesitan al menos dos participantes activos." }, 400);
        const missing = list.filter(m => !m.first_name || !m.last_name);
        if (missing.length) return json({ error: "Hay " + missing.length + " participante(s) sin nombres y apellidos completos. Completa sus perfiles antes de continuar." }, 400);
        const exclusions = await env.DB.prepare("SELECT user_a_id, user_b_id FROM edition_exclusions WHERE edition_id=?").bind(edition.id).all();
        if (!buildSecretAssignments(list, exclusions.results || [])) return json({ error: "Las exclusiones actuales no permiten crear un sorteo válido. Revisa las exclusiones mutuas." }, 409);
        await env.DB.prepare("INSERT INTO edition_draw_state (edition_id, state, ready_at, drawn_at, updated_at) VALUES (?, 'ready', datetime('now'), NULL, datetime('now')) ON CONFLICT(edition_id) DO UPDATE SET state='ready', ready_at=datetime('now'), drawn_at=NULL, updated_at=datetime('now')").bind(edition.id).run();
        return json({ ok: true, state: "ready", participants: list.length });
      }
      if (request.method === "POST" && url.pathname === "/api/admin/draw/execute") {
        const state = await env.DB.prepare("SELECT state FROM edition_draw_state WHERE edition_id=?").bind(edition.id).first();
        if (!state || state.state !== "ready") return json({ error: "La preparación ya no está vigente. Actualiza el estado y vuelve a confirmar que todos están listos." }, 409);
        const membersResult = await env.DB.prepare("SELECT em.user_id, p.first_name, p.last_name FROM edition_members em JOIN participant_profiles p ON p.user_id=em.user_id WHERE em.edition_id=? AND em.status='confirmed'").bind(edition.id).all();
        const members = membersResult.results || [];
        if (members.length < 2 || members.some(m => !m.first_name || !m.last_name)) return json({ error: "La lista de participantes cambió o hay perfiles incompletos. Vuelve a validar la preparación." }, 409);
        const exclusions = await env.DB.prepare("SELECT user_a_id, user_b_id FROM edition_exclusions WHERE edition_id=?").bind(edition.id).all();
        const assignments = buildSecretAssignments(members, exclusions.results || []);
        if (!assignments) return json({ error: "No existe una combinación válida con las exclusiones actuales." }, 409);
        const lock = await env.DB.prepare("UPDATE edition_draw_state SET state='drawing', updated_at=datetime('now') WHERE edition_id=? AND state='ready'").bind(edition.id).run();
        if (!lock.meta.changes) return json({ error: "El sorteo ya está siendo ejecutado o el estado cambió. Actualiza la pantalla." }, 409);
        try {
          const prior = await env.DB.prepare("SELECT COALESCE(MAX(run_number),0) AS n FROM draw_runs WHERE edition_id=?").bind(edition.id).first();
          const runNumber = (prior?.n || 0) + 1, runId = crypto.randomUUID();
          const statements = [
            env.DB.prepare("DELETE FROM draw_assignments WHERE edition_id=?").bind(edition.id),
            env.DB.prepare("INSERT INTO draw_runs (id, edition_id, run_number, status, participant_count) VALUES (?, ?, ?, 'completed', ?)").bind(runId, edition.id, runNumber, assignments.length)
          ];
          for (const a of assignments) statements.push(env.DB.prepare("INSERT INTO draw_assignments (id, edition_id, giver_user_id, recipient_user_id, run_number) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), edition.id, a.giver_user_id, a.recipient_user_id, runNumber));
          statements.push(env.DB.prepare("UPDATE edition_draw_state SET state='drawn', drawn_at=datetime('now'), updated_at=datetime('now') WHERE edition_id=?").bind(edition.id));
          statements.push(env.DB.prepare("UPDATE editions SET status='drawn' WHERE id=?").bind(edition.id));
          await env.DB.batch(statements);
          return json({ ok: true, state: "drawn", participants: assignments.length, runNumber });
        } catch (error) {
          await env.DB.prepare("UPDATE edition_draw_state SET state='ready', updated_at=datetime('now') WHERE edition_id=? AND state='drawing'").bind(edition.id).run();
          throw error;
        }
      }
      if (request.method === "POST" && url.pathname === "/api/admin/draw/reset") {
        const body = await request.json();
        if (body.confirmation !== "VOLVER A SORTEAR") return json({ error: "Escribe VOLVER A SORTEAR para confirmar." }, 400);
        await env.DB.prepare("CREATE TABLE IF NOT EXISTS anonymous_clues (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, giver_user_id TEXT NOT NULL REFERENCES users(id), recipient_user_id TEXT NOT NULL REFERENCES users(id), run_number INTEGER NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
        await env.DB.batch([
          env.DB.prepare("DELETE FROM anonymous_clues WHERE edition_id=?").bind(edition.id),
          env.DB.prepare("DELETE FROM draw_assignments WHERE edition_id=?").bind(edition.id),
          env.DB.prepare("UPDATE draw_runs SET status='superseded' WHERE edition_id=? AND status='completed'").bind(edition.id),
          env.DB.prepare("INSERT INTO edition_draw_state (edition_id, state, ready_at, drawn_at, updated_at) VALUES (?, 'registration', NULL, NULL, datetime('now')) ON CONFLICT(edition_id) DO UPDATE SET state='registration', ready_at=NULL, drawn_at=NULL, updated_at=datetime('now')").bind(edition.id),
          env.DB.prepare("UPDATE editions SET status='registration' WHERE id=?").bind(edition.id)
        ]);
        return json({ ok: true, state: "registration", message: "Asignaciones anteriores eliminadas. Los demás datos e historiales se conservaron." });
      }
    }

    if (request.method === "GET" && url.pathname === "/api/admin/status") {
      const workspace = await env.DB.prepare("SELECT id, name FROM workspace LIMIT 1").first();
      const edition = workspace ? await env.DB.prepare("SELECT id, title, year, budget_amount, event_date, status FROM editions WHERE workspace_id = ? ORDER BY year DESC LIMIT 1").bind(workspace.id).first() : null;
      const members = edition ? await env.DB.prepare("SELECT COUNT(*) AS total FROM edition_members WHERE edition_id = ? AND status = 'confirmed'").bind(edition.id).first() : { total: 0 };
      return json({ isPrimaryAdmin: true, email: user.email, initialized: !!edition, edition, participants: members.total || 0 });
    }
    if (request.method === "GET" && url.pathname === "/api/admin/participants") {
      const edition = await env.DB.prepare("SELECT id FROM editions ORDER BY year DESC LIMIT 1").first();
      if (!edition) return json({ participants: [] });
      const result = await env.DB.prepare("SELECT em.user_id, COALESCE(NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''), u.display_name) AS display_name, u.email, u.avatar_url, em.status, em.joined_at FROM edition_members em JOIN users u ON u.id=em.user_id LEFT JOIN participant_profiles p ON p.user_id=em.user_id WHERE em.edition_id=? AND em.status IN ('confirmed','inactive') ORDER BY CASE em.status WHEN 'confirmed' THEN 0 ELSE 1 END, em.joined_at ASC").bind(edition.id).all();
      return json({ participants: result.results || [] });
    }
    if (request.method === "PATCH" && url.pathname.startsWith("/api/admin/participants/")) {
      const userId = decodeURIComponent(url.pathname.split("/").pop());
      const body = await request.json();
      const edition = await env.DB.prepare("SELECT id FROM editions ORDER BY year DESC LIMIT 1").first();
      if (!edition || typeof body.active !== "boolean") return json({ error: "Solicitud inválida." }, 400);
      const result = await env.DB.prepare("UPDATE edition_members SET status=? WHERE edition_id=? AND user_id=? AND status IN ('confirmed','inactive')").bind(body.active ? "confirmed" : "inactive", edition.id, userId).run();
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
      const edition = await env.DB.prepare("SELECT id FROM editions ORDER BY year DESC LIMIT 1").first();
      if (!edition) return json({ error: "Primero crea la edición." }, 409);
      const token = base64url(crypto.getRandomValues(new Uint8Array(24))), hash = await sha256(token);
      const invitationId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await env.DB.batch([
        env.DB.prepare("UPDATE invitations SET revoked_at=datetime('now') WHERE edition_id=? AND revoked_at IS NULL").bind(edition.id),
        env.DB.prepare("INSERT INTO invitations (id, edition_id, token_hash, expires_at, max_uses, uses) VALUES (?, ?, ?, ?, 500, 0)").bind(invitationId, edition.id, hash, expiresAt)
      ]);
      return json({ ok: true, invitationUrl: `${url.origin}/?invite=${token}`, expiresAt });
    }
    return json({ error: "Ruta administrativa no encontrada." }, 404);
  }
  if (url.pathname.startsWith("/api/community")) {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión primero." }, 401);
    const member = await env.DB.prepare("SELECT edition_id FROM edition_members WHERE user_id=? AND status='confirmed' ORDER BY joined_at DESC LIMIT 1").bind(user.id).first();
    if (!member) return json({ error: "Necesitas una participación activa para entrar a la comunidad." }, 403);
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS anonymous_clues (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, giver_user_id TEXT NOT NULL REFERENCES users(id), recipient_user_id TEXT NOT NULL REFERENCES users(id), run_number INTEGER NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_anonymous_clues_recipient ON anonymous_clues(edition_id, recipient_user_id, run_number, created_at)").run();
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS anonymous_clue_reads (edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, last_seen_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00', PRIMARY KEY(edition_id,user_id))").run();
    if (request.method === "GET" && url.pathname === "/api/community/unread") {
      const draw = await env.DB.prepare("SELECT state FROM edition_draw_state WHERE edition_id=?").bind(member.edition_id).first();
      if (draw?.state !== "drawn") return json({ unread: 0 });
      const assignment = await env.DB.prepare("SELECT run_number FROM draw_assignments WHERE edition_id=? AND giver_user_id=?").bind(member.edition_id,user.id).first();
      if (!assignment) return json({ unread: 0 });
      const read = await env.DB.prepare("SELECT last_seen_at FROM anonymous_clue_reads WHERE edition_id=? AND user_id=?").bind(member.edition_id,user.id).first();
      const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM anonymous_clues WHERE edition_id=? AND recipient_user_id=? AND run_number=? AND created_at > ?").bind(member.edition_id,user.id,assignment.run_number,read?.last_seen_at || "1970-01-01 00:00:00").first();
      return json({ unread: count?.total || 0 });
    }
    if (request.method === "GET" && url.pathname === "/api/community/clues") {
      const draw = await env.DB.prepare("SELECT state FROM edition_draw_state WHERE edition_id=?").bind(member.edition_id).first();
      if (draw?.state !== "drawn") return json({ state: draw?.state || "registration", clues: [], sentCount: 0, limit: 5 });
      const assignment = await env.DB.prepare("SELECT recipient_user_id, run_number FROM draw_assignments WHERE edition_id=? AND giver_user_id=?").bind(member.edition_id, user.id).first();
      if (!assignment) return json({ state: "not_assigned", clues: [], sentCount: 0, limit: 5 });
      const clues = await env.DB.prepare("SELECT id, message, created_at FROM anonymous_clues WHERE edition_id=? AND recipient_user_id=? AND run_number=? ORDER BY created_at DESC LIMIT 30").bind(member.edition_id, user.id, assignment.run_number).all();
      const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM anonymous_clues WHERE edition_id=? AND giver_user_id=? AND run_number=?").bind(member.edition_id, user.id, assignment.run_number).first();
      await env.DB.prepare("INSERT INTO anonymous_clue_reads (edition_id,user_id,last_seen_at) VALUES (?,?,datetime('now')) ON CONFLICT(edition_id,user_id) DO UPDATE SET last_seen_at=datetime('now')").bind(member.edition_id,user.id).run();
      return json({ state: "drawn", clues: clues.results || [], sentCount: count.total || 0, limit: 5 });
    }
    if (request.method === "POST" && url.pathname === "/api/community/clues") {
      const body = await request.json(); const message = String(body.message || "").trim();
      if (message.length < 2 || message.length > 240) return json({ error: "La pista debe tener entre 2 y 240 caracteres." }, 400);
      const draw = await env.DB.prepare("SELECT state FROM edition_draw_state WHERE edition_id=?").bind(member.edition_id).first();
      if (draw?.state !== "drawn") return json({ error: "Las pistas anónimas estarán disponibles después del sorteo." }, 409);
      const assignment = await env.DB.prepare("SELECT recipient_user_id, run_number FROM draw_assignments WHERE edition_id=? AND giver_user_id=?").bind(member.edition_id, user.id).first();
      if (!assignment) return json({ error: "Todavía no tienes una asignación. El administrador debe incluirte en el sorteo." }, 409);
      const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM anonymous_clues WHERE edition_id=? AND giver_user_id=? AND run_number=?").bind(member.edition_id, user.id, assignment.run_number).first();
      if (count.total >= 5) return json({ error: "Ya enviaste las 5 pistas permitidas para este sorteo." }, 409);
      const clueId = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO anonymous_clues (id, edition_id, giver_user_id, recipient_user_id, run_number, message) VALUES (?, ?, ?, ?, ?, ?)").bind(clueId,member.edition_id,user.id,assignment.recipient_user_id,assignment.run_number,message).run();
      await sendPushToUser(env,assignment.recipient_user_id,{title:"¡Tienes un mensaje! 🎁",body:"Tu amigo secreto te envio un mensaje",url:"/?tab=community",tag:"clue-"+clueId},url.origin);
      return json({ ok: true, sentCount: count.total + 1 });
    }
    return json({ error: "Ruta de comunidad no encontrada." }, 404);
  }
  if (url.pathname.startsWith("/api/wishes")) {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión primero." }, 401);
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS participant_wishes (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, note TEXT, url TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS participant_wish_images (wish_id TEXT PRIMARY KEY REFERENCES participant_wishes(id) ON DELETE CASCADE, image_data TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
    const membership = await env.DB.prepare("SELECT edition_id FROM edition_members WHERE user_id=? AND status='confirmed' ORDER BY joined_at DESC LIMIT 1").bind(user.id).first();
    if (!membership) return json({ error: "Necesitas una participación activa para gestionar tus deseos." }, 403);
    if (request.method === "GET" && url.pathname === "/api/wishes") {
      const mine = await env.DB.prepare("SELECT w.id, w.title, w.note, w.url, w.created_at, (SELECT image_data FROM participant_wish_images i WHERE i.wish_id=w.id) AS image_data FROM participant_wishes w WHERE w.edition_id=? AND w.user_id=? ORDER BY w.created_at DESC").bind(membership.edition_id, user.id).all();
      const state = await env.DB.prepare("SELECT state FROM edition_draw_state WHERE edition_id=?").bind(membership.edition_id).first();
      let recipientWishes = [], recipientName = null;
      if (state?.state === "drawn") {
        const assigned = await env.DB.prepare("SELECT a.recipient_user_id, COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS display_name FROM draw_assignments a JOIN users u ON u.id=a.recipient_user_id LEFT JOIN participant_profiles p ON p.user_id=u.id WHERE a.edition_id=? AND a.giver_user_id=?").bind(membership.edition_id, user.id).first();
        if (assigned) {
          recipientName = assigned.display_name;
          const wishes = await env.DB.prepare("SELECT w.title, w.note, w.url, (SELECT image_data FROM participant_wish_images i WHERE i.wish_id=w.id) AS image_data FROM participant_wishes w WHERE w.edition_id=? AND w.user_id=? ORDER BY w.created_at DESC").bind(membership.edition_id, assigned.recipient_user_id).all();
          recipientWishes = wishes.results || [];
        }
      }
      return json({ wishes: mine.results || [], recipientName, recipientWishes, canSeeRecipientWishes: state?.state === "drawn" && !!recipientName });
    }
    if (request.method === "POST" && url.pathname === "/api/wishes") {
      const body = await request.json();
      const title = String(body.title || "").trim();
      const note = String(body.note || "").trim();
      const link = String(body.url || "").trim();
      const imageData = String(body.imageData || "");
      if (imageData && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(imageData) || imageData.length > 280000)) return json({ error: "La imagen no es válida o supera el tamaño permitido." }, 400);
      if (title.length < 2 || title.length > 100) return json({ error: "El deseo debe tener entre 2 y 100 caracteres." }, 400);
      if (note.length > 300) return json({ error: "La descripción no puede superar los 300 caracteres." }, 400);
      if (link && (link.length > 500 || !/^https?:\/\//i.test(link))) return json({ error: "El enlace debe comenzar con https:// o http://." }, 400);
      const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM participant_wishes WHERE edition_id=? AND user_id=?").bind(membership.edition_id, user.id).first();
      if (count.total >= 10) return json({ error: "Puedes registrar hasta 10 deseos." }, 409);
      const wishId = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO participant_wishes (id, edition_id, user_id, title, note, url) VALUES (?, ?, ?, ?, ?, ?)").bind(wishId, membership.edition_id, user.id, title, note || null, link || null).run();
      if (imageData) await env.DB.prepare("INSERT INTO participant_wish_images (wish_id, image_data) VALUES (?, ?)").bind(wishId, imageData).run();
      return json({ ok: true });
    }
    const match = url.pathname.match(/^\/api\/wishes\/([A-Za-z0-9-]+)$/);
    if (request.method === "PUT" && match) {
      const body = await request.json();
      const title = String(body.title || "").trim();
      const note = String(body.note || "").trim();
      const link = String(body.url || "").trim();
      const imageData = String(body.imageData || "");
      if (imageData && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(imageData) || imageData.length > 280000)) return json({ error: "La imagen no es válida o supera el tamaño permitido." }, 400);
      if (title.length < 2 || title.length > 100) return json({ error: "El deseo debe tener entre 2 y 100 caracteres." }, 400);
      if (note.length > 300) return json({ error: "La descripción no puede superar los 300 caracteres." }, 400);
      if (link && (link.length > 500 || !/^https?:\/\//i.test(link))) return json({ error: "El enlace debe comenzar con https:// o http://." }, 400);
      const result = await env.DB.prepare("UPDATE participant_wishes SET title=?, note=?, url=?, updated_at=datetime('now') WHERE id=? AND edition_id=? AND user_id=?").bind(title, note || null, link || null, match[1], membership.edition_id, user.id).run();
      if (!result.meta.changes) return json({ error: "No encontramos ese deseo." }, 404);
      if (body.removeImage) await env.DB.prepare("DELETE FROM participant_wish_images WHERE wish_id=?").bind(match[1]).run();
      if (imageData) await env.DB.prepare("INSERT INTO participant_wish_images (wish_id, image_data) VALUES (?, ?) ON CONFLICT(wish_id) DO UPDATE SET image_data=excluded.image_data, updated_at=datetime('now')").bind(match[1], imageData).run();
      return json({ ok: true });
    }
    if (request.method === "DELETE" && match) {
      const result = await env.DB.prepare("DELETE FROM participant_wishes WHERE id=? AND edition_id=? AND user_id=?").bind(match[1], membership.edition_id, user.id).run();
      if (!result.meta.changes) return json({ error: "No encontramos ese deseo." }, 404);
      return json({ ok: true });
    }
    return json({ error: "Ruta de deseos no encontrada." }, 404);
  }
  if (request.method === "GET" && url.pathname === "/api/secret/me") {
    const participant = await currentUser(request, env);
    if (!participant) return json({ error: "Inicia sesión primero." }, 401);
    await ensureDrawSchema(env);
    const membership = await env.DB.prepare("SELECT em.status, em.edition_id, e.status AS edition_status, e.title FROM edition_members em JOIN editions e ON e.id=em.edition_id WHERE em.user_id=? ORDER BY e.year DESC LIMIT 1").bind(participant.id).first();
    if (!membership || membership.status !== "confirmed") return json({ state: "not_participating" });
    const state = await env.DB.prepare("SELECT state FROM edition_draw_state WHERE edition_id=?").bind(membership.edition_id).first();
    if (!state || state.state !== "drawn") return json({ state: state?.state || "registration", title: membership.title });
    const assignment = await env.DB.prepare("SELECT u.id, COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS display_name FROM draw_assignments a JOIN users u ON u.id=a.recipient_user_id LEFT JOIN participant_profiles p ON p.user_id=u.id WHERE a.edition_id=? AND a.giver_user_id=?").bind(membership.edition_id, participant.id).first();
    if (!assignment) return json({ state: "not_assigned", title: membership.title });
    return json({ state: "drawn", title: membership.title, recipient: { displayName: assignment.display_name } });
  }
  if (request.method === "POST" && url.pathname === "/api/participation/withdraw") {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión primero." }, 401);
    const edition = await env.DB.prepare("SELECT id, status FROM editions ORDER BY year DESC LIMIT 1").first();
    if (!edition) return json({ error: "No hay una edición activa." }, 404);
    if (edition.status === "drawn" || edition.status === "completed") return json({ error: "El sorteo ya se realizó o la edición terminó. Contacta al organizador." }, 409);
    const result = await env.DB.prepare("DELETE FROM edition_members WHERE edition_id=? AND user_id=?").bind(edition.id, user.id).run();
    if (!result.meta.changes) return json({ error: "No tienes una participación activa." }, 409);
    return json({ ok: true, removed: true });
  }
  if (request.method === "POST" && url.pathname === "/api/participation/rejoin") {
    return json({ error: "Para volver a participar necesitas una nueva invitación del organizador." }, 409);
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
    if (!invite || invite.revoked_at || (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now())) return json({ valid: false }, 404);
    return json({ valid: true, edition: { title: invite.title, year: invite.year, status: invite.status } });
  }
  if (request.method === "POST" && url.pathname === "/api/invitations/join") {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión para participar." }, 401);
    const body = await request.json(); if (!body.token) return json({ error: "Falta el código de invitación." }, 400);
    const hash = await sha256(body.token);
    const invite = await env.DB.prepare("SELECT id, edition_id, expires_at, max_uses, uses, revoked_at FROM invitations WHERE token_hash=?").bind(hash).first();
    if (!invite || invite.revoked_at || (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now())) return json({ error: "La invitación no es válida o ya venció." }, 404);
    const existing = await env.DB.prepare("SELECT id FROM edition_members WHERE edition_id=? AND user_id=?").bind(invite.edition_id, user.id).first();
    if (!existing) {
      const memberId = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO edition_members (id, edition_id, user_id) VALUES (?, ?, ?)").bind(memberId, invite.edition_id, user.id).run();
    }
    return json({ ok: true, message: "Ya formas parte de la edición." });
  }
  return json({ error: "Ruta no encontrada." }, 404);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      const mutatingApiRequest = url.pathname.startsWith("/api/") && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
      if (mutatingApiRequest && request.headers.get("Origin") !== url.origin) return json({ error: "Origen no permitido." }, 403);
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env, url);
      return await env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Unhandled Worker error", { path: url.pathname, method: request.method, message: error?.message || String(error) });
      if (url.pathname.startsWith("/api/")) {
        return json({ error: "Error interno del servidor. Intenta nuevamente.", code: "WORKER_EXCEPTION" }, 500);
      }
      return new Response("Error interno. Intenta nuevamente.", { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
  },
};