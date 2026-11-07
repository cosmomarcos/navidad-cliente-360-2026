const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });
}
function base64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}
async function createSession(user, secret) {
  const payload = base64url(new TextEncoder().encode(JSON.stringify({
    sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
  })));
  return `${payload}.${await sign(payload, secret)}`;
}
async function readSession(request, secret) {
  const cookie = request.headers.get("Cookie") || "";
  const raw = cookie.split(";").map(x => x.trim()).find(x => x.startsWith("nc360_session="))?.slice("nc360_session=".length);
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature || signature !== await sign(payload, secret)) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0))));
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch { return null; }
}
function cookie(value, maxAge = 604800) {
  return `nc360_session=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
async function googleUser(idToken, clientId) {
  if (!idToken || !clientId) throw new Error("Google OAuth no está configurado.");
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) throw new Error("No se pudo validar la identidad de Google.");
  const claims = await response.json();
  if (claims.aud !== clientId || !claims.sub || !claims.email || claims.email_verified !== "true") {
    throw new Error("La identidad de Google no superó la validación.");
  }
  return { sub: claims.sub, email: claims.email.toLowerCase(), name: claims.name || claims.email, picture: claims.picture || null };
}
async function currentUser(request, env) {
  const session = await readSession(request, env.SESSION_SECRET);
  if (!session) return null;
  return env.DB.prepare("SELECT id, email, display_name, avatar_url FROM users WHERE id = ?").bind(session.sub).first();
}
async function handleApi(request, env, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    return json({ ok: true, app: env.APP_NAME, version: "0.1.0" });
  }
  if (request.method === "GET" && url.pathname === "/api/config") {
    return json({ googleClientId: env.GOOGLE_CLIENT_ID || null });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/google") {
    try {
      const body = await request.json();
      const identity = await googleUser(body.credential, env.GOOGLE_CLIENT_ID);
      let user = await env.DB.prepare("SELECT * FROM users WHERE google_sub = ?").bind(identity.sub).first();
      if (!user) {
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO users (id, google_sub, email, display_name, avatar_url) VALUES (?, ?, ?, ?, ?)"
        ).bind(id, identity.sub, identity.email, identity.name, identity.picture).run();
        user = { id, email: identity.email, display_name: identity.name, avatar_url: identity.picture };
      } else {
        await env.DB.prepare("UPDATE users SET email = ?, display_name = ?, avatar_url = ? WHERE id = ?")
          .bind(identity.email, identity.name, identity.picture, user.id).run();
      }
      const session = await createSession(user, env.SESSION_SECRET);
      return json({ ok: true, user: { id: user.id, email: user.email, name: user.display_name } }, 200, {
        "set-cookie": cookie(session)
      });
    } catch (error) {
      return json({ error: error.message || "Error de autenticación." }, 401);
    }
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    return json({ ok: true }, 200, { "set-cookie": cookie("", 0) });
  }

  if (request.method === "POST" && url.pathname === "/api/admin/bootstrap") {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión primero." }, 401);
    if (!env.ADMIN_EMAIL || user.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) {
      return json({ error: "Solo el administrador inicial puede configurar la edición." }, 403);
    }
    const existing = await env.DB.prepare("SELECT id FROM workspace LIMIT 1").first();
    if (existing) return json({ error: "El grupo principal ya fue inicializado." }, 409);

    const body = await request.json();
    const title = String(body.title || "Navidad Cliente 360 2026").slice(0, 100);
    const year = Number(body.year || 2026);
    const budget = body.budgetAmount == null ? null : Number(body.budgetAmount);
    if (!Number.isInteger(year) || year < 2026 || (budget !== null && (!Number.isFinite(budget) || budget < 0))) {
      return json({ error: "Año o presupuesto inválido." }, 400);
    }
    const workspaceId = crypto.randomUUID();
    const editionId = crypto.randomUUID();
    const membershipId = crypto.randomUUID();
    const token = base64url(crypto.getRandomValues(new Uint8Array(24)));
    const tokenHash = await sha256(token);
    const invitationId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO workspace (id, name, owner_user_id) VALUES (?, ?, ?)")
        .bind(workspaceId, "Cliente 360", user.id),
      env.DB.prepare("INSERT INTO memberships (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')")
        .bind(membershipId, workspaceId, user.id),
      env.DB.prepare("INSERT INTO editions (id, workspace_id, title, year, budget_amount, event_date, status) VALUES (?, ?, ?, ?, ?, ?, 'registration')")
        .bind(editionId, workspaceId, title, year, budget, body.eventDate || null),
      env.DB.prepare("INSERT INTO invitations (id, edition_id, token_hash, expires_at, max_uses) VALUES (?, ?, ?, ?, ?)")
        .bind(invitationId, editionId, tokenHash, body.expiresAt || null, Math.max(1, Math.min(500, Number(body.maxUses || 100))))
    ]);
    return json({
      ok: true,
      edition: { id: editionId, title, year },
      invitationUrl: `${url.origin}/?invite=${token}`
    });
  }

  if (request.method === "GET" && url.pathname === "/api/me") {
    const user = await currentUser(request, env);
    return user ? json({ authenticated: true, user }) : json({ authenticated: false });
  }

  const inviteMatch = url.pathname.match(/^\/api\/invitations\/([A-Za-z0-9_-]+)$/);
  if (request.method === "GET" && inviteMatch) {
    const tokenHash = await sha256(inviteMatch[1]);
    const invite = await env.DB.prepare(`
      SELECT i.id, i.edition_id, i.expires_at, i.max_uses, i.uses, i.revoked_at,
             e.title, e.year, e.status
      FROM invitations i JOIN editions e ON e.id = i.edition_id
      WHERE i.token_hash = ?
    `).bind(tokenHash).first();
    if (!invite || invite.revoked_at || invite.uses >= invite.max_uses ||
        (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now())) {
      return json({ valid: false }, 404);
    }
    return json({ valid: true, edition: { title: invite.title, year: invite.year, status: invite.status } });
  }

  if (request.method === "POST" && url.pathname === "/api/invitations/join") {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión para participar." }, 401);
    const body = await request.json();
    if (!body.token) return json({ error: "Falta el código de invitación." }, 400);
    const tokenHash = await sha256(body.token);
    const invite = await env.DB.prepare(`
      SELECT i.id, i.edition_id, i.expires_at, i.max_uses, i.uses, i.revoked_at
      FROM invitations i WHERE i.token_hash = ?
    `).bind(tokenHash).first();
    if (!invite || invite.revoked_at || invite.uses >= invite.max_uses ||
        (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now())) {
      return json({ error: "La invitación no es válida o ya venció." }, 404);
    }
    const existing = await env.DB.prepare("SELECT id FROM edition_members WHERE edition_id = ? AND user_id = ?")
      .bind(invite.edition_id, user.id).first();
    if (!existing) {
      const memberId = crypto.randomUUID();
      const batch = await env.DB.batch([
        env.DB.prepare("INSERT INTO edition_members (id, edition_id, user_id) VALUES (?, ?, ?)")
          .bind(memberId, invite.edition_id, user.id),
        env.DB.prepare("UPDATE invitations SET uses = uses + 1 WHERE id = ? AND uses < max_uses").bind(invite.id)
      ]);
      if (!batch?.length) return json({ error: "No se pudo completar la inscripción." }, 409);
    }
    return json({ ok: true, message: "Ya formas parte de la edición." });
  }

  return json({ error: "Ruta no encontrada." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env, url);
    return env.ASSETS.fetch(request);
  }
};
