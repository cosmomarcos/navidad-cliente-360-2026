import { buildPushPayload } from "@block65/webcrypto-web-push";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data, status = 200, extra = {}) { return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } }); }
const schemaInitPromises = new Map();
function ensureSchemaOnce(key, initialize) {
  if (!schemaInitPromises.has(key)) {
    const promise = Promise.resolve().then(initialize).catch(error => {
      schemaInitPromises.delete(key);
      throw error;
    });
    schemaInitPromises.set(key, promise);
  }
  return schemaInitPromises.get(key);
}
async function ensureWishesSchema(env) {
  return ensureSchemaOnce("wishes", async () => {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS participant_wishes (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, note TEXT, url TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS participant_wish_images (wish_id TEXT PRIMARY KEY REFERENCES participant_wishes(id) ON DELETE CASCADE, image_data TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS participant_wish_reads (edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, last_seen_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00', PRIMARY KEY(edition_id,user_id))").run();
  });
}
async function ensureCommunitySchema(env) {
  return ensureSchemaOnce("community", async () => {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS anonymous_clues (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, giver_user_id TEXT NOT NULL REFERENCES users(id), recipient_user_id TEXT NOT NULL REFERENCES users(id), run_number INTEGER NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_anonymous_clues_recipient ON anonymous_clues(edition_id, recipient_user_id, run_number, created_at)").run();
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS anonymous_clue_reads (edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, last_seen_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00', PRIMARY KEY(edition_id,user_id))").run();
  });
}
async function ensureParticipantProfilesSchema(env) {
  return ensureSchemaOnce("participant-profiles", async () => {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS participant_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id), first_name TEXT NOT NULL, last_name TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  });
}
async function ensurePushSchema(env) {
  return ensureSchemaOnce("push-subscriptions", async () => {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  });
}
function dataUrlResponse(value, fallbackType = "application/octet-stream") {
  const match = String(value || "").match(/^data:([^,]*);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return json({ error: "Archivo no disponible." }, 404);
  const contentType = (match[1].split(";")[0] || fallbackType).trim();
  const binary = atob(match[2].replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Response(bytes, { headers: { "content-type": contentType, "cache-control": "private, max-age=300", "x-content-type-options": "nosniff" } });
}
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
  return ensureSchemaOnce("draw", async () => {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS edition_exclusions (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, user_a_id TEXT NOT NULL REFERENCES users(id), user_b_id TEXT NOT NULL REFERENCES users(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP, CHECK(user_a_id <> user_b_id), UNIQUE(edition_id, user_a_id, user_b_id))").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS edition_draw_state (edition_id TEXT PRIMARY KEY REFERENCES editions(id) ON DELETE CASCADE, state TEXT NOT NULL DEFAULT 'registration', ready_at TEXT, drawn_at TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS draw_assignments (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, giver_user_id TEXT NOT NULL REFERENCES users(id), recipient_user_id TEXT NOT NULL REFERENCES users(id), run_number INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(edition_id, giver_user_id))").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS draw_runs (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, run_number INTEGER NOT NULL, status TEXT NOT NULL, participant_count INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_draw_assignments_edition ON draw_assignments(edition_id)").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS draw_revelations (edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, revealed_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(edition_id,user_id))").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_draw_revelations_edition ON draw_revelations(edition_id,revealed_at)").run();
  });
}

async function ensureSpiritSchema(env) {
  return ensureSchemaOnce("spirit", async () => {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_challenges (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 10, bonus_points INTEGER NOT NULL DEFAULT 5, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
      try { await env.DB.prepare("ALTER TABLE spirit_challenges ADD COLUMN challenge_type TEXT NOT NULL DEFAULT 'text'").run(); } catch {}
      try { await env.DB.prepare("ALTER TABLE spirit_challenges ADD COLUMN config_json TEXT").run(); } catch {}
      try { await env.DB.prepare("ALTER TABLE spirit_submissions ADD COLUMN media_data TEXT").run(); } catch {}
      try { await env.DB.prepare("ALTER TABLE spirit_submissions ADD COLUMN media_type TEXT").run(); } catch {}
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_spirit_challenges_active ON spirit_challenges(edition_id, starts_at, ends_at)").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_submissions (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, challenge_id TEXT NOT NULL REFERENCES spirit_challenges(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, caption TEXT NOT NULL, image_data TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(challenge_id,user_id))").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_spirit_submissions_challenge ON spirit_submissions(challenge_id, created_at)").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_votes (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES spirit_submissions(id) ON DELETE CASCADE, voter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(submission_id,voter_user_id))").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_points (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, source_type TEXT NOT NULL, source_id TEXT NOT NULL, points INTEGER NOT NULL, description TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(edition_id,user_id,source_type,source_id))").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_spirit_points_ranking ON spirit_points(edition_id,user_id)").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_leader_streaks (edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, current_streak INTEGER NOT NULL DEFAULT 0, last_first_date TEXT, PRIMARY KEY(edition_id,user_id))").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_challenge_results (challenge_id TEXT PRIMARY KEY REFERENCES spirit_challenges(id) ON DELETE CASCADE, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, processed_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_submission_reads (edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, last_seen_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00', PRIMARY KEY(edition_id,user_id))").run();
  });
}

async function finalizeExpiredSpiritChallenges(env, editionId) {
  const expired = await env.DB.prepare("SELECT id FROM spirit_challenges WHERE edition_id=? AND ends_at<=datetime('now')").bind(editionId).all();
  for (const challenge of expired.results || []) {
    const winners = await env.DB.prepare("SELECT s.user_id,COUNT(v.id) AS votes FROM spirit_submissions s LEFT JOIN spirit_votes v ON v.submission_id=s.id WHERE s.challenge_id=? GROUP BY s.id HAVING COUNT(v.id)>0 AND COUNT(v.id)=(SELECT MAX(vote_count) FROM (SELECT COUNT(v2.id) AS vote_count FROM spirit_submissions s2 LEFT JOIN spirit_votes v2 ON v2.submission_id=s2.id WHERE s2.challenge_id=? GROUP BY s2.id))").bind(challenge.id,challenge.id).all();
    for (const winner of winners.results || []) {
      await env.DB.prepare("INSERT OR IGNORE INTO spirit_points (id,edition_id,user_id,source_type,source_id,points,description) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),editionId,winner.user_id,"daily_winner",challenge.id,10,"Publicación más votada del día").run();
    }
  }
}


function spiritLimaDay(value) {
  return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Lima",year:"numeric",month:"2-digit",day:"2-digit"}).format(value);
}
async function processSpiritChallengeClosures(env) {
  await ensureSpiritSchema(env);
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_challenge_open_notifications (challenge_id TEXT PRIMARY KEY REFERENCES spirit_challenges(id) ON DELETE CASCADE, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, notified_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  const now=new Date().toISOString().slice(0,19).replace("T"," ");
  const due=await env.DB.prepare("SELECT c.id,c.edition_id,c.title,c.ends_at FROM spirit_challenges c LEFT JOIN spirit_challenge_results r ON r.challenge_id=c.id WHERE c.ends_at<=? AND r.challenge_id IS NULL ORDER BY c.ends_at").bind(now).all();
  for(const challenge of due.results||[]) {
    await finalizeExpiredSpiritChallenges(env,challenge.edition_id);
    const all=await env.DB.prepare("SELECT u.id AS user_id,COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS display_name,COALESCE((SELECT SUM(sp.points) FROM spirit_points sp WHERE sp.edition_id=? AND sp.user_id=u.id),0) AS points FROM edition_members em JOIN users u ON u.id=em.user_id LEFT JOIN participant_profiles p ON p.user_id=u.id WHERE em.edition_id=? AND em.status='confirmed' ORDER BY points DESC,display_name COLLATE NOCASE").bind(challenge.edition_id,challenge.edition_id).all();
    let prevPoints=null,prevRank=0;
    const ranked=(all.results||[]).map((person,index)=>{const score=Number(person.points||0),rank=prevPoints===score?prevRank:prevRank+1;prevPoints=score;prevRank=rank;return {...person,rank};});
    const winners=ranked.filter(person=>person.rank<=3);
    const firstIds=new Set(winners.filter(person=>person.rank===1).map(person=>person.user_id));
    const day=spiritLimaDay(new Date(challenge.ends_at.replace(" ","T")+"Z"));
    const members=await env.DB.prepare("SELECT user_id FROM edition_members WHERE edition_id=? AND status='confirmed'").bind(challenge.edition_id).all();
    for(const member of members.results||[]) {
      if(firstIds.has(member.user_id)) {
        const prev=await env.DB.prepare("SELECT current_streak,last_first_date FROM spirit_leader_streaks WHERE edition_id=? AND user_id=?").bind(challenge.edition_id,member.user_id).first();
        const yesterday=new Date(day+"T12:00:00Z");yesterday.setUTCDate(yesterday.getUTCDate()-1);
        const streak=prev?.last_first_date===spiritLimaDay(yesterday)?Number(prev.current_streak)+1:1;
        await env.DB.prepare("INSERT INTO spirit_leader_streaks (edition_id,user_id,current_streak,last_first_date) VALUES (?,?,?,?) ON CONFLICT(edition_id,user_id) DO UPDATE SET current_streak=excluded.current_streak,last_first_date=excluded.last_first_date").bind(challenge.edition_id,member.user_id,streak,day).run();
      } else {
        await env.DB.prepare("INSERT INTO spirit_leader_streaks (edition_id,user_id,current_streak,last_first_date) VALUES (?,?,0,NULL) ON CONFLICT(edition_id,user_id) DO UPDATE SET current_streak=0,last_first_date=NULL").bind(challenge.edition_id,member.user_id).run();
      }
    }
    await env.DB.prepare("INSERT OR IGNORE INTO spirit_challenge_results (challenge_id,edition_id) VALUES (?,?)").bind(challenge.id,challenge.edition_id).run();
    for(const person of winners) {
      const place=person.rank;
      const others=winners.filter(item=>item.rank===place).length-1;
      const streak=place===1?(await env.DB.prepare("SELECT current_streak FROM spirit_leader_streaks WHERE edition_id=? AND user_id=?").bind(challenge.edition_id,person.user_id).first())?.current_streak||1:0;
      const placeText=place===1?"primer":place===2?"segundo":"tercer";
      const title=place===1?"🏆 ¡Primer lugar!":place===2?"🥈 ¡Segundo lugar!":"🥉 ¡Tercer lugar!";
      let body=others>0?"¡Felicitaciones! Compartes el "+placeText+" lugar con "+(others===1?"1 participante más.":others+" participantes más."):"¡Felicitaciones! Ocupas el "+placeText+" lugar.";
      if(place===1&&streak>1) body+=" Racha de "+streak+" días consecutivos 🔥";
      await sendPushToUser(env,person.user_id,{title,body,tag:"spirit-result-"+challenge.id+"-"+person.user_id,url:"/?tab=spirit"},env.VAPID_SUBJECT||"https://navidad-cliente-360-2026.torresmarcos16.workers.dev");
    }
  }
  const opening=await env.DB.prepare("SELECT c.id,c.edition_id FROM spirit_challenges c LEFT JOIN spirit_challenge_open_notifications n ON n.challenge_id=c.id WHERE c.starts_at<=? AND c.ends_at>? AND n.challenge_id IS NULL ORDER BY c.starts_at").bind(now,now).all();
  for(const challenge of opening.results||[]) {
    const recipients=await env.DB.prepare("SELECT user_id FROM edition_members WHERE edition_id=? AND status='confirmed'").bind(challenge.edition_id).all();
    for(const recipient of recipients.results||[]) {
      await sendPushToUser(env,recipient.user_id,{title:"🎄 ¡NUEVO RETO ACTIVO!",body:"¡Ve y demuestra tu espíritu navideño! 🎁",tag:"spirit-open-"+challenge.id,url:"/?tab=spirit"},env.VAPID_SUBJECT||"https://navidad-cliente-360-2026.torresmarcos16.workers.dev");
    }
    await env.DB.prepare("INSERT OR IGNORE INTO spirit_challenge_open_notifications (challenge_id,edition_id) VALUES (?,?)").bind(challenge.id,challenge.edition_id).run();
  }
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
  await ensurePushSchema(env);
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

async function notifySpiritParticipants(env, editionId, authorUserId, submissionId, authorName, subject) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
  const author = await env.DB.prepare("SELECT COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS display_name FROM users u LEFT JOIN participant_profiles p ON p.user_id=u.id WHERE u.id=?")
    .bind(authorUserId).first();
  const displayName = author?.display_name || authorName || "Un participante";
  const recipients = await env.DB.prepare("SELECT DISTINCT user_id FROM edition_members WHERE edition_id=? AND status='confirmed' AND user_id<>?")
    .bind(editionId, authorUserId).all();
  const payload = {
    title: "🎄 ¡Nueva participación en Espíritu Navideño!",
    body: displayName + " publicó. ¡Envía tu participación ahora y participa por el premio! 🎁",
    tag: "spirit-new-submission-" + submissionId,
    url: "/?tab=spirit"
  };
  await Promise.all((recipients.results || []).map(row => sendPushToUser(env, row.user_id, payload, subject)));
}

async function notifyWishOwner(env, editionId, authorUserId, wishTitle, subject) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
  const assignment = await env.DB.prepare("SELECT giver_user_id FROM draw_assignments WHERE edition_id=? AND recipient_user_id=?").bind(editionId, authorUserId).first();
  if (!assignment?.giver_user_id) return;
  const author = await env.DB.prepare("SELECT COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS display_name FROM users u LEFT JOIN participant_profiles p ON p.user_id=u.id WHERE u.id=?").bind(authorUserId).first();
  const name = author?.display_name || "Tu amigo secreto";
  await sendPushToUser(env, assignment.giver_user_id, { title: "💝 ¡Tu amigo secreto agregó un deseo!", body: name + " agregó o actualizó: " + String(wishTitle || "un deseo").slice(0,80), tag: "wish-update-" + editionId + "-" + authorUserId, url: "/?tab=wishes" }, subject);
}

async function handleApi(request, env, url) {
  if (request.method === "GET" && url.pathname === "/api/health") return json({ ok: true, app: env.APP_NAME, version: "1.8.1" });
  if (request.method === "GET" && url.pathname === "/api/config") return json({ googleClientId: env.GOOGLE_CLIENT_ID || null });
  if (request.method === "GET" && url.pathname === "/api/push/public-key") {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión primero." }, 401);
    return json({ publicKey: env.VAPID_PUBLIC_KEY || null });
  }
  if (url.pathname.startsWith("/api/push/")) {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión primero." }, 401);
    await ensurePushSchema(env);
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
    await ensureParticipantProfilesSchema(env);
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

  if (url.pathname.startsWith("/api/spirit/")) {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión primero." }, 401);
    const member = await env.DB.prepare("SELECT em.edition_id FROM edition_members em WHERE em.user_id=? AND em.status='confirmed' ORDER BY em.joined_at DESC LIMIT 1").bind(user.id).first();
    if (!member) return json({ error: "Necesitas una participación activa para entrar a Espíritu Navideño." }, 403);
    await ensureSpiritSchema(env);
    const spiritMediaMatch=url.pathname.match(/^\/api\/spirit\/media\/([A-Za-z0-9-]+)$/);
    if(request.method==="GET"&&spiritMediaMatch){
      const media=await env.DB.prepare("SELECT media_data,image_data,media_type FROM spirit_submissions WHERE id=? AND edition_id=?").bind(spiritMediaMatch[1],member.edition_id).first();
      if(!media)return json({error:"No encontramos el archivo de esta publicación."},404);
      return dataUrlResponse(media.media_data||media.image_data,media.media_type||"image/jpeg");
    }
    let challenge = await env.DB.prepare("SELECT id,title,description,points,bonus_points,challenge_type,config_json,starts_at,ends_at FROM spirit_challenges WHERE edition_id=? AND starts_at<=datetime('now') AND ends_at>datetime('now') ORDER BY starts_at DESC LIMIT 1").bind(member.edition_id).first();
    let challengeCorrectAnswer=null;
    if(challenge){
      let config={};try{config=JSON.parse(challenge.config_json||"{}");}catch{}
      challengeCorrectAnswer=String(config.correctAnswer||"");
      challenge={...challenge,config:{question:config.question||"",options:Array.isArray(config.options)?config.options:[]}};
      delete challenge.config_json;
    }
    if (request.method === "GET" && url.pathname === "/api/spirit/unread") {
      const read = await env.DB.prepare("SELECT last_seen_at FROM spirit_submission_reads WHERE edition_id=? AND user_id=?").bind(member.edition_id,user.id).first();
      const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM spirit_submissions WHERE edition_id=? AND user_id<>? AND created_at>?").bind(member.edition_id,user.id,read?.last_seen_at || "1970-01-01 00:00:00").first();
      return json({ unread: count?.total || 0 });
    }
    if (request.method === "GET" && url.pathname === "/api/spirit/board") {
      const ranking = await env.DB.prepare("SELECT u.id AS user_id,COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS display_name,u.avatar_url,COALESCE(pts.points,0) AS points,COALESCE(subs.completed,0) AS completed,COALESCE(st.current_streak,0) AS first_place_streak FROM edition_members em JOIN users u ON u.id=em.user_id LEFT JOIN participant_profiles p ON p.user_id=u.id LEFT JOIN (SELECT user_id,SUM(points) AS points FROM spirit_points WHERE edition_id=? GROUP BY user_id) pts ON pts.user_id=em.user_id LEFT JOIN (SELECT user_id,COUNT(*) AS completed FROM spirit_submissions WHERE edition_id=? GROUP BY user_id) subs ON subs.user_id=em.user_id LEFT JOIN spirit_leader_streaks st ON st.edition_id=em.edition_id AND st.user_id=em.user_id WHERE em.edition_id=? AND em.status='confirmed' ORDER BY points DESC,display_name COLLATE NOCASE").bind(member.edition_id,member.edition_id,member.edition_id).all();
      let previousPoints=null,previousRank=0;
      const allRows=(ranking.results||[]).map((person,index)=>{const score=Number(person.points||0),rank=previousPoints===score?previousRank:previousRank+1;previousPoints=score;previousRank=rank;return {...person,rank};});
      const rows=allRows.filter(person=>person.rank<=3).map(person=>({...person,tieCount:allRows.filter(other=>other.rank===person.rank).length}));
      const mine=allRows.findIndex(x=>x.user_id===user.id);
      const myRank=mine>=0?allRows[mine].rank:null;
      let submissions=[];
      if(challenge){
        const feed=await env.DB.prepare("SELECT s.id,s.user_id,s.caption,s.media_type,CASE WHEN s.media_data IS NOT NULL OR s.image_data IS NOT NULL THEN 1 ELSE 0 END AS has_media,s.created_at,COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS display_name,u.avatar_url,COALESCE(vote_counts.votes,0) AS votes,CASE WHEN mine.id IS NULL THEN 0 ELSE 1 END AS voted FROM spirit_submissions s JOIN users u ON u.id=s.user_id LEFT JOIN participant_profiles p ON p.user_id=s.user_id LEFT JOIN (SELECT v.submission_id,COUNT(*) AS votes FROM spirit_votes v JOIN spirit_submissions fs ON fs.id=v.submission_id WHERE fs.challenge_id=? GROUP BY v.submission_id) vote_counts ON vote_counts.submission_id=s.id LEFT JOIN spirit_votes mine ON mine.submission_id=s.id AND mine.voter_user_id=? WHERE s.challenge_id=? ORDER BY s.created_at DESC LIMIT 30").bind(challenge.id,user.id,challenge.id).all();
        submissions=(feed.results||[]).map(item=>({...item,eligibleForVoting:challenge.challenge_type!=="trivia"||item.caption===challengeCorrectAnswer}));
      }
      await env.DB.prepare("INSERT INTO spirit_submission_reads (edition_id,user_id,last_seen_at) VALUES (?,?,datetime('now')) ON CONFLICT(edition_id,user_id) DO UPDATE SET last_seen_at=datetime('now')").bind(member.edition_id,user.id).run();
      return json({challenge:challenge||null,submissions,ranking:rows,myPoints:mine>=0?allRows[mine].points:0,myRank,mySubmission:submissions.find(x=>x.user_id===user.id)||null});
    }
    if (request.method === "POST" && url.pathname === "/api/spirit/submissions") {
      if(!challenge)return json({error:"No hay un reto activo en este momento."},409);
      const body=await request.json(),caption=String(body.caption||"").trim(),mediaData=String(body.mediaData||body.imageData||""),mediaType=String(body.mediaType||(body.imageData?"image/jpeg":""));
      const challengeType=challenge.challenge_type||"text";
      if(challengeType==="text"&&(caption.length<2||caption.length>500))return json({error:"Tu participación debe tener entre 2 y 500 caracteres."},400);
      if(challengeType==="photo"&&(!mediaData.startsWith("data:image/jpeg;base64,")||mediaData.length>300000))return json({error:"Debes adjuntar una foto JPG válida."},400);
      if(challengeType==="voice"&&(!/^data:audio\/(webm|ogg|mp4)(?:;[^,]*)?;base64,/i.test(mediaData)||mediaData.length>500000))return json({error:"Graba un audio válido de máximo 30 segundos."},400);
      if(challengeType==="trivia"&&(caption.length<1||caption.length>120))return json({error:"Selecciona una respuesta para la trivia."},400);
      if(challengeType==="photo"||challengeType==="voice"){if(caption.length>500)return json({error:"El texto complementario es demasiado largo."},400);}
      const configRaw=await env.DB.prepare("SELECT config_json FROM spirit_challenges WHERE id=?").bind(challenge.id).first();
      let challengeConfig={};try{challengeConfig=JSON.parse(configRaw?.config_json||"{}");}catch{}
      const correct=challengeType!=="trivia"||String(caption)===String(challengeConfig.correctAnswer||"");
      const prior=await env.DB.prepare("SELECT id FROM spirit_submissions WHERE challenge_id=? AND user_id=?").bind(challenge.id,user.id).first();
      if(prior)return json({error:"Ya participaste en el reto de hoy. ¡Vuelve mañana!"},409);
      const id=crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO spirit_submissions (id,edition_id,challenge_id,user_id,caption,image_data,media_data,media_type) VALUES (?,?,?,?,?,?,?,?)").bind(id,member.edition_id,challenge.id,user.id,caption||((challengeType==="photo")?"Participación con foto":(challengeType==="voice")?"Participación con voz":caption),null,mediaData||null,mediaType||null),
      ]);
      await notifySpiritParticipants(env, member.edition_id, user.id, id, user.display_name, url.origin);
      return json({ok:true,points:0,correct});
    }
    const deleteMatch=url.pathname.match(/^\/api\/spirit\/submissions\/([A-Za-z0-9-]+)$/);
    if(request.method==="DELETE"&&deleteMatch){
      const submission=await env.DB.prepare("SELECT id FROM spirit_submissions WHERE id=? AND edition_id=? AND user_id=?").bind(deleteMatch[1],member.edition_id,user.id).first();
      if(!submission)return json({error:"No encontramos una participación tuya para eliminar."},404);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM spirit_points WHERE edition_id=? AND ((source_id=? AND source_type IN (?,?)) OR (source_type=? AND source_id IN (SELECT id FROM spirit_votes WHERE submission_id=?)))").bind(member.edition_id,submission.id,"submission","community_bonus","like",submission.id),
        env.DB.prepare("DELETE FROM spirit_submissions WHERE id=? AND edition_id=? AND user_id=?").bind(submission.id,member.edition_id,user.id)
      ]);
      return json({ok:true,message:"Tu participación y los puntos asociados fueron eliminados."});
    }
    const voteMatch=url.pathname.match(/^\/api\/spirit\/submissions\/([A-Za-z0-9-]+)\/vote$/);
    if(request.method==="POST"&&voteMatch){
      if(!challenge)return json({error:"El reto ya terminó."},409);
      const submission=await env.DB.prepare("SELECT s.id,s.user_id,s.edition_id,s.challenge_id,s.caption FROM spirit_submissions s WHERE s.id=? AND s.edition_id=? AND s.challenge_id=?").bind(voteMatch[1],member.edition_id,challenge.id).first();
      if(!submission)return json({error:"La publicación no pertenece al reto activo."},404);
      if(submission.user_id===user.id)return json({error:"No puedes darte Me gusta a tu propia publicación."},409);
      if(challenge.challenge_type==="trivia"){
        const trivia=await env.DB.prepare("SELECT config_json FROM spirit_challenges WHERE id=?").bind(submission.challenge_id).first();
        let answer="";try{answer=JSON.parse(trivia?.config_json||"{}").correctAnswer||"";}catch{}
        if(String(submission.caption)!==String(answer))return json({error:"Esta respuesta no fue correcta y no puede recibir votos."},409);
      }
      const voteId=crypto.randomUUID();
      try{
        await env.DB.batch([
          env.DB.prepare("INSERT INTO spirit_votes (id,submission_id,voter_user_id) VALUES (?,?,?)").bind(voteId,submission.id,user.id),
          env.DB.prepare("DELETE FROM spirit_points WHERE edition_id=? AND source_type='like' AND source_id IN (SELECT id FROM spirit_votes WHERE submission_id=?)").bind(member.edition_id,submission.id),
          env.DB.prepare("INSERT OR IGNORE INTO spirit_points (id,edition_id,user_id,source_type,source_id,points,description) SELECT lower(hex(randomblob(16))),s.edition_id,s.user_id,'like',v.id,1,'Me gusta recibido' FROM spirit_votes v JOIN spirit_submissions s ON s.id=v.submission_id WHERE v.submission_id=? ORDER BY v.created_at,v.id LIMIT 10").bind(submission.id)
        ]);
      }catch{return json({error:"Ya diste Me gusta a esta publicación."},409);}
      const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM spirit_votes WHERE submission_id=?").bind(submission.id).first();
      const earned=await env.DB.prepare("SELECT COUNT(*) AS total FROM spirit_points WHERE edition_id=? AND source_type='like' AND source_id IN (SELECT id FROM spirit_votes WHERE submission_id=?)").bind(member.edition_id,submission.id).first();
      const voter=await env.DB.prepare("SELECT COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS name FROM users u LEFT JOIN participant_profiles p ON p.user_id=u.id WHERE u.id=?").bind(user.id).first();
      await sendPushToUser(env,submission.user_id,{title:"❤️ ¡Nueva reacción en Espíritu!",body:(voter?.name||"Un participante")+" le dio me gusta a tu publicación.",tag:"spirit-like-"+submission.id,url:"/?tab=spirit"},url.origin);
      return json({ok:true,voted:true,votes:count?.total||0,pointsForPost:earned?.total||0});
    }
    if(request.method==="DELETE"&&voteMatch){
      if(!challenge)return json({error:"El reto ya terminó."},409);
      const submission=await env.DB.prepare("SELECT id FROM spirit_submissions WHERE id=? AND edition_id=? AND challenge_id=? AND user_id<>?").bind(voteMatch[1],member.edition_id,challenge.id,user.id).first();
      if(!submission)return json({error:"No puedes retirar este Me gusta."},404);
      const vote=await env.DB.prepare("SELECT id FROM spirit_votes WHERE submission_id=? AND voter_user_id=?").bind(submission.id,user.id).first();
      if(!vote)return json({error:"Todavía no has dado Me gusta a esta publicación."},404);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM spirit_points WHERE edition_id=? AND source_type='like' AND source_id IN (SELECT id FROM spirit_votes WHERE submission_id=?)").bind(member.edition_id,submission.id),
        env.DB.prepare("DELETE FROM spirit_votes WHERE id=?").bind(vote.id),
        env.DB.prepare("INSERT OR IGNORE INTO spirit_points (id,edition_id,user_id,source_type,source_id,points,description) SELECT lower(hex(randomblob(16))),s.edition_id,s.user_id,'like',v.id,1,'Me gusta recibido' FROM spirit_votes v JOIN spirit_submissions s ON s.id=v.submission_id WHERE v.submission_id=? ORDER BY v.created_at,v.id LIMIT 10").bind(submission.id)
      ]);
      const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM spirit_votes WHERE submission_id=?").bind(submission.id).first();
      return json({ok:true,voted:false,votes:count?.total||0});
    }
    return json({error:"Ruta de Espíritu Navideño no encontrada."},404);
  }

  if (url.pathname.startsWith("/api/admin/")) {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión con Google primero." }, 401);
    if (!(await isPrimaryAdmin(user, env))) return json({ error: "Esta cuenta no es el administrador principal." }, 403);

    if (url.pathname === "/api/admin/spirit/challenges" && request.method === "GET") {
      await ensureSpiritSchema(env);
      const edition=await env.DB.prepare("SELECT id FROM editions ORDER BY year DESC LIMIT 1").first();
      if(!edition)return json({active:null});
      await env.DB.prepare("DELETE FROM spirit_challenges WHERE edition_id=? AND id LIKE 'seed-%' AND starts_at>datetime('now') AND NOT EXISTS (SELECT 1 FROM spirit_submissions s WHERE s.challenge_id=spirit_challenges.id)").bind(edition.id).run();
      const active=await env.DB.prepare("SELECT id,title,challenge_type,starts_at,ends_at FROM spirit_challenges WHERE edition_id=? AND starts_at<=datetime('now') AND ends_at>datetime('now') ORDER BY starts_at DESC LIMIT 1").bind(edition.id).first();
      const scheduled=await env.DB.prepare("SELECT id,title,challenge_type,starts_at,ends_at FROM spirit_challenges WHERE edition_id=? AND starts_at>datetime('now') ORDER BY starts_at LIMIT 10").bind(edition.id).all();
      return json({active:active||null,scheduled:scheduled.results||[]});
    }
    if (url.pathname === "/api/admin/spirit/challenges" && request.method === "POST") {
      await ensureSpiritSchema(env);
      const edition=await env.DB.prepare("SELECT id FROM editions ORDER BY year DESC LIMIT 1").first();
      if(!edition)return json({error:"No hay una edición configurada."},404);
      const body=await request.json(),title=String(body.title||"").trim(),description=String(body.description||"").trim(),type=String(body.challengeType||"text");
      const points=Number(body.points||10),bonus=Number(body.bonusPoints||5),config=body.config&&typeof body.config==="object"?body.config:{};
      if(!["text","photo","voice","trivia"].includes(type))return json({error:"Tipo de reto no válido."},400);
      if(title.length<3||title.length>80||description.length<5||description.length>300)return json({error:"Completa un título y una descripción válidos."},400);
      if(!Number.isInteger(points)||points<1||points>100||!Number.isInteger(bonus)||bonus<1||bonus>50)return json({error:"Los puntos deben estar dentro de los límites permitidos."},400);
      if(type==="trivia"&&(!String(config.question||"").trim()||!Array.isArray(config.options)||config.options.length<2||!config.options.includes(config.correctAnswer)))return json({error:"Configura una pregunta, sus opciones y la respuesta correcta."},400);
      const scheduledDate=String(body.scheduledDate||"");
      if(!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate))return json({error:"Selecciona la fecha en que debe abrirse el reto."},400);
      const start=new Date(scheduledDate+"T14:00:00.000Z"),end=new Date(start.getTime()+13*60*60*1000);
      if(!Number.isFinite(start.getTime())||start.getTime()<=Date.now())return json({error:"Elige una fecha futura. Los retos abren a las 9:00 a. m. hora Perú."},400);
      const startSql=start.toISOString().slice(0,19).replace("T"," "),endSql=end.toISOString().slice(0,19).replace("T"," ");
      const overlap=await env.DB.prepare("SELECT id FROM spirit_challenges WHERE edition_id=? AND starts_at<? AND ends_at>? LIMIT 1").bind(edition.id,endSql,startSql).first();
      if(overlap)return json({error:"Ya existe un reto programado para ese día."},409);
      const id=crypto.randomUUID();
      await env.DB.prepare("INSERT INTO spirit_challenges (id,edition_id,title,description,points,bonus_points,challenge_type,config_json,starts_at,ends_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(id,edition.id,title,description,points,bonus,type,JSON.stringify(config),startSql,endSql,user.id).run();
      return json({ok:true,id,startsAt:startSql,endsAt:endSql});
    }

    if (request.method === "POST" && url.pathname === "/api/admin/spirit/reset-my-points") {
      const member=await env.DB.prepare("SELECT edition_id FROM edition_members WHERE user_id=? AND status='confirmed' ORDER BY joined_at DESC LIMIT 1").bind(user.id).first();
      if(!member)return json({error:"No tienes una edición activa."},403);
      await ensureSpiritSchema(env);
      const result=await env.DB.prepare("DELETE FROM spirit_points WHERE edition_id=? AND user_id=?").bind(member.edition_id,user.id).run();
      return json({ok:true,deleted:result.meta?.changes||0});
    }

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
      if (request.method === "GET" && url.pathname === "/api/admin/draw/results") {
        const state = await env.DB.prepare("SELECT state FROM edition_draw_state WHERE edition_id=?").bind(edition.id).first();
        if (!state || state.state !== "drawn" || !["drawn","completed"].includes(edition.status)) return json({ error: "Todavía no hay un sorteo ejecutado para revelar." }, 409);
        const run = await env.DB.prepare("SELECT run_number, participant_count, created_at FROM draw_runs WHERE edition_id=? AND status='completed' ORDER BY run_number DESC LIMIT 1").bind(edition.id).first();
        if (!run) return json({ error: "No se encontró el registro de ejecución del sorteo." }, 404);
        const rows = await env.DB.prepare("SELECT a.giver_user_id, a.recipient_user_id, COALESCE(NULLIF(TRIM(COALESCE(pg.first_name,'') || ' ' || COALESCE(pg.last_name,'')),''), ug.display_name) AS giver_name, COALESCE(NULLIF(TRIM(COALESCE(pr.first_name,'') || ' ' || COALESCE(pr.last_name,'')),''), ur.display_name) AS recipient_name FROM draw_assignments a JOIN users ug ON ug.id=a.giver_user_id JOIN users ur ON ur.id=a.recipient_user_id LEFT JOIN participant_profiles pg ON pg.user_id=ug.id LEFT JOIN participant_profiles pr ON pr.user_id=ur.id WHERE a.edition_id=? AND a.run_number=? ORDER BY giver_name COLLATE NOCASE").bind(edition.id, run.run_number).all();
        const assignments = rows.results || [];
        const participants = await env.DB.prepare("SELECT COUNT(*) AS total FROM edition_members WHERE edition_id=? AND status='confirmed'").bind(edition.id).first();
        const uniqueRecipients = new Set(assignments.map(a => a.recipient_user_id)).size;
        const selfAssignments = assignments.filter(a => a.giver_user_id === a.recipient_user_id).length;
        const violations = await env.DB.prepare("SELECT COUNT(*) AS total FROM draw_assignments a JOIN edition_exclusions x ON x.edition_id=a.edition_id AND ((x.user_a_id=a.giver_user_id AND x.user_b_id=a.recipient_user_id) OR (x.user_b_id=a.giver_user_id AND x.user_a_id=a.recipient_user_id)) WHERE a.edition_id=? AND a.run_number=?").bind(edition.id, run.run_number).first();
        const integrity = { participants: participants?.total || 0, assignments: assignments.length, uniqueRecipients, missingAssignments: Math.max(0, (participants?.total || 0) - assignments.length), duplicateRecipients: Math.max(0, assignments.length - uniqueRecipients), selfAssignments, exclusionViolations: violations?.total || 0 };
        integrity.valid = integrity.participants >= 2 && integrity.assignments === integrity.participants && integrity.uniqueRecipients === integrity.participants && integrity.selfAssignments === 0 && integrity.exclusionViolations === 0;
        return json({ runNumber: run.run_number, createdAt: run.created_at, integrity, assignments: assignments.map(a => ({ giverName: a.giver_name, recipientName: a.recipient_name })) });
      }
      if (request.method === "GET" && url.pathname === "/api/admin/draw/revelations") {
        const members = await env.DB.prepare("SELECT em.user_id, COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS display_name, CASE WHEN r.user_id IS NULL THEN 0 ELSE 1 END AS revealed FROM edition_members em JOIN users u ON u.id=em.user_id LEFT JOIN participant_profiles p ON p.user_id=u.id LEFT JOIN draw_revelations r ON r.edition_id=em.edition_id AND r.user_id=em.user_id WHERE em.edition_id=? AND em.status='confirmed' ORDER BY revealed DESC, display_name COLLATE NOCASE ASC").bind(edition.id).all();
        const participants=(members.results||[]).map(m=>({displayName:m.display_name,revealed:!!m.revealed}));
        return json({total:participants.length,revealed:participants.filter(p=>p.revealed).length,participants});
      }
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
            env.DB.prepare("DELETE FROM draw_revelations WHERE edition_id=?").bind(edition.id),
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
    await ensureCommunitySchema(env);
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
      if (draw?.state !== "drawn") return json({ state: draw?.state || "registration", clues: [], sentCount: 0, limit: null });
      const assignment = await env.DB.prepare("SELECT recipient_user_id, run_number FROM draw_assignments WHERE edition_id=? AND giver_user_id=?").bind(member.edition_id, user.id).first();
      if (!assignment) return json({ state: "not_assigned", clues: [], sentCount: 0, limit: null });
      const clues = await env.DB.prepare("SELECT id, message, created_at FROM anonymous_clues WHERE edition_id=? AND recipient_user_id=? AND run_number=? ORDER BY created_at DESC LIMIT 30").bind(member.edition_id, user.id, assignment.run_number).all();
      const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM anonymous_clues WHERE edition_id=? AND giver_user_id=? AND run_number=?").bind(member.edition_id, user.id, assignment.run_number).first();
      await env.DB.prepare("INSERT INTO anonymous_clue_reads (edition_id,user_id,last_seen_at) VALUES (?,?,datetime('now')) ON CONFLICT(edition_id,user_id) DO UPDATE SET last_seen_at=datetime('now')").bind(member.edition_id,user.id).run();
      return json({ state: "drawn", clues: clues.results || [], sentCount: count.total || 0, limit: null });
    }
    if (request.method === "POST" && url.pathname === "/api/community/clues") {
      const body = await request.json(); const message = String(body.message || "").trim();
      if (message.length < 2 || message.length > 240) return json({ error: "La pista debe tener entre 2 y 240 caracteres." }, 400);
      const draw = await env.DB.prepare("SELECT state FROM edition_draw_state WHERE edition_id=?").bind(member.edition_id).first();
      if (draw?.state !== "drawn") return json({ error: "Las pistas anónimas estarán disponibles después del sorteo." }, 409);
      const assignment = await env.DB.prepare("SELECT recipient_user_id, run_number FROM draw_assignments WHERE edition_id=? AND giver_user_id=?").bind(member.edition_id, user.id).first();
      if (!assignment) return json({ error: "Todavía no tienes una asignación. El administrador debe incluirte en el sorteo." }, 409);
      const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM anonymous_clues WHERE edition_id=? AND giver_user_id=? AND run_number=?").bind(member.edition_id, user.id, assignment.run_number).first();
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
    await ensureWishesSchema(env);
    const membership = await env.DB.prepare("SELECT edition_id FROM edition_members WHERE user_id=? AND status='confirmed' ORDER BY joined_at DESC LIMIT 1").bind(user.id).first();
    if (!membership) return json({ error: "Necesitas una participación activa para gestionar tus deseos." }, 403);
    if (request.method === "GET" && url.pathname === "/api/wishes/unread") {
      const state = await env.DB.prepare("SELECT state FROM edition_draw_state WHERE edition_id=?").bind(membership.edition_id).first();
      if (state?.state !== "drawn") return json({ unread: 0 });
      const assigned = await env.DB.prepare("SELECT recipient_user_id FROM draw_assignments WHERE edition_id=? AND giver_user_id=?").bind(membership.edition_id,user.id).first();
      if (!assigned) return json({ unread: 0 });
      const read = await env.DB.prepare("SELECT last_seen_at FROM participant_wish_reads WHERE edition_id=? AND user_id=?").bind(membership.edition_id,user.id).first();
      const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM participant_wishes WHERE edition_id=? AND user_id=? AND updated_at>?").bind(membership.edition_id,assigned.recipient_user_id,read?.last_seen_at || "1970-01-01 00:00:00").first();
      return json({ unread: count?.total || 0 });
    }
    const wishImageMatch = url.pathname.match(/^\/api\/wishes\/image\/([A-Za-z0-9-]+)$/);
    if (request.method === "GET" && wishImageMatch) {
      const wish = await env.DB.prepare("SELECT w.user_id, i.image_data FROM participant_wishes w JOIN participant_wish_images i ON i.wish_id=w.id WHERE w.id=? AND w.edition_id=?").bind(wishImageMatch[1],membership.edition_id).first();
      if (!wish) return json({ error: "No encontramos la imagen de este deseo." }, 404);
      let allowed = wish.user_id === user.id;
      if (!allowed) {
        const assignment = await env.DB.prepare("SELECT 1 AS allowed FROM draw_assignments WHERE edition_id=? AND giver_user_id=? AND recipient_user_id=?").bind(membership.edition_id,user.id,wish.user_id).first();
        allowed = !!assignment;
      }
      if (!allowed) return json({ error: "No tienes permiso para ver esta imagen." }, 403);
      return dataUrlResponse(wish.image_data,"image/jpeg");
    }
    if (request.method === "GET" && url.pathname === "/api/wishes") {
      const mine = await env.DB.prepare("SELECT w.id, w.title, w.note, w.url, w.created_at, EXISTS(SELECT 1 FROM participant_wish_images i WHERE i.wish_id=w.id) AS has_image FROM participant_wishes w WHERE w.edition_id=? AND w.user_id=? ORDER BY w.created_at DESC").bind(membership.edition_id, user.id).all();
      const state = await env.DB.prepare("SELECT state FROM edition_draw_state WHERE edition_id=?").bind(membership.edition_id).first();
      let recipientWishes = [], recipientName = null;
      if (state?.state === "drawn") {
        const assigned = await env.DB.prepare("SELECT a.recipient_user_id, COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS display_name FROM draw_assignments a JOIN users u ON u.id=a.recipient_user_id LEFT JOIN participant_profiles p ON p.user_id=u.id WHERE a.edition_id=? AND a.giver_user_id=?").bind(membership.edition_id, user.id).first();
        if (assigned) {
          recipientName = assigned.display_name;
          const wishes = await env.DB.prepare("SELECT w.id, w.title, w.note, w.url, EXISTS(SELECT 1 FROM participant_wish_images i WHERE i.wish_id=w.id) AS has_image FROM participant_wishes w WHERE w.edition_id=? AND w.user_id=? ORDER BY w.created_at DESC").bind(membership.edition_id, assigned.recipient_user_id).all();
          recipientWishes = wishes.results || [];
        }
      }
      await env.DB.prepare("INSERT INTO participant_wish_reads (edition_id,user_id,last_seen_at) VALUES (?,?,datetime('now')) ON CONFLICT(edition_id,user_id) DO UPDATE SET last_seen_at=datetime('now')").bind(membership.edition_id,user.id).run();
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
      await notifyWishOwner(env,membership.edition_id,user.id,title,url.origin);
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
      await notifyWishOwner(env,membership.edition_id,user.id,title,url.origin);
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
    const revealed = await env.DB.prepare("SELECT 1 AS revealed FROM draw_revelations WHERE edition_id=? AND user_id=?").bind(membership.edition_id,participant.id).first();
    return json({ state: "drawn", title: membership.title, hasRevealed: !!revealed, recipient: { displayName: assignment.display_name } });
  }
  if (request.method === "POST" && url.pathname === "/api/secret/reveal") {
    const participant = await currentUser(request, env);
    if (!participant) return json({ error: "Inicia sesión primero." }, 401);
    await ensureDrawSchema(env);
    const membership = await env.DB.prepare("SELECT em.status, em.edition_id FROM edition_members em JOIN editions e ON e.id=em.edition_id WHERE em.user_id=? ORDER BY e.year DESC LIMIT 1").bind(participant.id).first();
    if (!membership || membership.status !== "confirmed") return json({ error: "No tienes una participación activa." }, 403);
    const assignment = await env.DB.prepare("SELECT 1 AS assigned FROM draw_assignments WHERE edition_id=? AND giver_user_id=?").bind(membership.edition_id,participant.id).first();
    if (!assignment) return json({ error: "Tu asignación todavía no está disponible." }, 409);
    await env.DB.prepare("INSERT OR IGNORE INTO draw_revelations (edition_id,user_id) VALUES (?,?)").bind(membership.edition_id,participant.id).run();
    const record = await env.DB.prepare("SELECT revealed_at FROM draw_revelations WHERE edition_id=? AND user_id=?").bind(membership.edition_id,participant.id).first();
    return json({ ok: true, revealedAt: record?.revealed_at || null });
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
    await ensureParticipantProfilesSchema(env);
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
    const existing = await env.DB.prepare("SELECT id, status FROM edition_members WHERE edition_id=? AND user_id=?").bind(invite.edition_id, user.id).first();
    if (existing) {
      if (existing.status !== "confirmed") {
        await env.DB.prepare("UPDATE edition_members SET status='confirmed', joined_at=datetime('now') WHERE id=?").bind(existing.id).run();
      }
    } else {
      const memberId = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO edition_members (id, edition_id, user_id, status) VALUES (?, ?, ?, 'confirmed')").bind(memberId, invite.edition_id, user.id).run();
    }
    return json({ ok: true, message: "Tu participación ha sido confirmada." });
  }
  return json({ error: "Ruta no encontrada." }, 404);
}
export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(processSpiritChallengeClosures(env).catch(error=>console.error("Spirit challenge closure failed",error?.message||String(error)))); },
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