import { buildPushPayload } from "@block65/webcrypto-web-push";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data, status = 200, extra = {}) { return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } }); }
function containsUnsafePayload(value) {
  const text = String(value || "");
  return [
    /(?:^|[;&|\n])\s*(?:mkfifo|nc\s+-|netcat\s+-|ncat\s+-)/i,
    /\/dev\/(?:tcp|udp)\//i,
    /\b(?:bash|sh|zsh)\s+-[ic]/i,
    /\bsqlite3\b[\s\S]{0,120}\.shell\b/i,
    /\b(?:curl|wget)\b[\s\S]{0,100}\|\s*(?:sh|bash)\b/i,
    /\b(?:powershell|pwsh)\b[\s\S]{0,80}(?:-enc(?:odedcommand)?|-e\s)/i,
    /\b(?:rm\s+-rf|chmod\s+\+x)\b/i
  ].some(pattern => pattern.test(text));
}
function rejectUnsafePayload(value) {
  return containsUnsafePayload(value)
    ? json({ error: "El contenido parece incluir instrucciones de terminal o código ejecutable. Comparte tu mensaje como texto normal." }, 400)
    : null;
}
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
async function ensureEditionHomeSettingsSchema(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS edition_home_settings (edition_id TEXT PRIMARY KEY REFERENCES editions(id) ON DELETE CASCADE, config_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
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
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS anonymous_chat_messages (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, run_number INTEGER NOT NULL, sender_user_id TEXT NOT NULL REFERENCES users(id), recipient_user_id TEXT NOT NULL REFERENCES users(id), message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_anonymous_chat_pair ON anonymous_chat_messages(edition_id,run_number,sender_user_id,recipient_user_id,created_at)").run();
  });
}
async function ensureParticipantProfilesSchema(env) {
  return ensureSchemaOnce("participant-profiles", async () => {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS participant_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id), first_name TEXT NOT NULL, last_name TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  });
}
async function ensureParticipantProfileImagesSchema(env) {
  return ensureSchemaOnce("participant-profile-images", async () => {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS participant_profile_images (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, image_data TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  });
}
async function ensurePushSchema(env) {
  return ensureSchemaOnce("push-subscriptions", async () => {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  });
}
function dataUrlResponse(value, fallbackType = "application/octet-stream", request = null) {
  const match = String(value || "").match(/^data:([^,]*);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return json({ error: "Archivo no disponible." }, 404);
  const contentType = (match[1].split(";")[0] || fallbackType).trim();
  const binary = atob(match[2].replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const headers = { "content-type": contentType, "cache-control": "private, max-age=300", "x-content-type-options": "nosniff", "accept-ranges": "bytes" };
  const range = request?.headers.get("range");
  if (range) {
    const rangeMatch = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!rangeMatch || (!rangeMatch[1] && !rangeMatch[2])) return new Response(null, { status: 416, headers: { ...headers, "content-range": "bytes */" + bytes.length } });
    let start, end;
    if (!rangeMatch[1]) {
      const suffix = Number(rangeMatch[2]);
      if (!suffix) return new Response(null, { status: 416, headers: { ...headers, "content-range": "bytes */" + bytes.length } });
      start = Math.max(0, bytes.length - suffix); end = bytes.length - 1;
    } else {
      start = Number(rangeMatch[1]); end = rangeMatch[2] ? Math.min(Number(rangeMatch[2]), bytes.length - 1) : bytes.length - 1;
    }
    if (start >= bytes.length || end < start) return new Response(null, { status: 416, headers: { ...headers, "content-range": "bytes */" + bytes.length } });
    const chunk = bytes.slice(start, end + 1);
    headers["content-range"] = "bytes " + start + "-" + end + "/" + bytes.length;
    headers["content-length"] = String(chunk.length);
    return new Response(chunk, { status: 206, headers });
  }
  headers["content-length"] = String(bytes.length);
  return new Response(bytes, { headers });
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
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_submissions (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, challenge_id TEXT NOT NULL REFERENCES spirit_challenges(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, caption TEXT NOT NULL, image_data TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_activity_settings (edition_id TEXT PRIMARY KEY REFERENCES editions(id) ON DELETE CASCADE, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
    try { await env.DB.prepare("ALTER TABLE spirit_activity_settings ADD COLUMN manual_override INTEGER NOT NULL DEFAULT 0").run(); } catch {}
      try { await env.DB.prepare("ALTER TABLE spirit_challenges ADD COLUMN challenge_type TEXT NOT NULL DEFAULT 'text'").run(); } catch {}
      try { await env.DB.prepare("ALTER TABLE spirit_challenges ADD COLUMN config_json TEXT").run(); } catch {}
      try { await env.DB.prepare("ALTER TABLE spirit_challenges ADD COLUMN challenge_kind TEXT NOT NULL DEFAULT 'daily'").run(); } catch {}
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_extra_proposals (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT NOT NULL, challenge_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', admin_note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), reviewed_at TEXT)").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_spirit_extra_proposals ON spirit_extra_proposals(edition_id,status,created_at)").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_extra_submissions (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, challenge_id TEXT NOT NULL REFERENCES spirit_challenges(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, caption TEXT NOT NULL DEFAULT '', media_data TEXT, media_type TEXT, status TEXT NOT NULL DEFAULT 'pending', reviewed_at TEXT, reviewed_by TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(challenge_id,user_id))").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_spirit_extra_submissions ON spirit_extra_submissions(challenge_id,status)").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_bonus_history (edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, bonus_key TEXT NOT NULL, challenge_id TEXT NOT NULL UNIQUE REFERENCES spirit_challenges(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(edition_id,bonus_key))").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_spirit_bonus_history_edition ON spirit_bonus_history(edition_id,created_at)").run();
      try { await env.DB.prepare("ALTER TABLE spirit_submissions ADD COLUMN media_data TEXT").run(); } catch {}
      try { await env.DB.prepare("ALTER TABLE spirit_submissions ADD COLUMN media_type TEXT").run(); } catch {}
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_spirit_challenges_active ON spirit_challenges(edition_id, starts_at, ends_at)").run();

      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_spirit_submissions_challenge ON spirit_submissions(challenge_id, created_at)").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_votes (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES spirit_submissions(id) ON DELETE CASCADE, voter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(submission_id,voter_user_id))").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_points (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, source_type TEXT NOT NULL, source_id TEXT NOT NULL, points INTEGER NOT NULL, description TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(edition_id,user_id,source_type,source_id))").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_spirit_points_ranking ON spirit_points(edition_id,user_id)").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_leader_streaks (edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, current_streak INTEGER NOT NULL DEFAULT 0, last_first_date TEXT, PRIMARY KEY(edition_id,user_id))").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_challenge_results (challenge_id TEXT PRIMARY KEY REFERENCES spirit_challenges(id) ON DELETE CASCADE, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, processed_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_submission_reads (edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, last_seen_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00', PRIMARY KEY(edition_id,user_id))").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_comments (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES spirit_submissions(id) ON DELETE CASCADE, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, comment TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_spirit_comments_submission ON spirit_comments(submission_id,created_at)").run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
      const multiPostMigration=await env.DB.prepare("SELECT name FROM spirit_schema_migrations WHERE name='multiple_submissions_v1'").first();
      if(!multiPostMigration){
        await env.DB.batch([
          env.DB.prepare("CREATE TABLE spirit_submissions_v2 (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, challenge_id TEXT NOT NULL REFERENCES spirit_challenges(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, caption TEXT NOT NULL, image_data TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), media_data TEXT, media_type TEXT)"),
          env.DB.prepare("INSERT INTO spirit_submissions_v2 SELECT id,edition_id,challenge_id,user_id,caption,image_data,created_at,media_data,media_type FROM spirit_submissions"),
          env.DB.prepare("CREATE TABLE spirit_votes_v2 (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES spirit_submissions_v2(id) ON DELETE CASCADE, voter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(submission_id,voter_user_id))"),
          env.DB.prepare("INSERT INTO spirit_votes_v2 SELECT id,submission_id,voter_user_id,created_at FROM spirit_votes"),
          env.DB.prepare("CREATE TABLE spirit_comments_v2 (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES spirit_submissions_v2(id) ON DELETE CASCADE, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, comment TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))"),
          env.DB.prepare("INSERT INTO spirit_comments_v2 SELECT id,submission_id,edition_id,user_id,comment,created_at FROM spirit_comments"),
          env.DB.prepare("DROP TABLE spirit_votes"),
          env.DB.prepare("DROP TABLE spirit_comments"),
          env.DB.prepare("DROP TABLE spirit_submissions"),
          env.DB.prepare("ALTER TABLE spirit_submissions_v2 RENAME TO spirit_submissions"),
          env.DB.prepare("ALTER TABLE spirit_votes_v2 RENAME TO spirit_votes"),
          env.DB.prepare("ALTER TABLE spirit_comments_v2 RENAME TO spirit_comments"),
          env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_spirit_submissions_challenge ON spirit_submissions(challenge_id,created_at)"),
          env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_spirit_comments_submission ON spirit_comments(submission_id,created_at)"),
          env.DB.prepare("INSERT INTO spirit_schema_migrations (name) VALUES ('multiple_submissions_v1')")
        ]);
      }
  });
}

async function finalizeExpiredSpiritChallenges(env, editionId) {
  const expired = await env.DB.prepare("SELECT id FROM spirit_challenges WHERE edition_id=? AND ends_at<=datetime('now')").bind(editionId).all();
  for (const challenge of expired.results || []) {
    const winners = await env.DB.prepare("WITH participant_votes AS (SELECT s.user_id,COUNT(v.id) AS votes FROM spirit_submissions s LEFT JOIN spirit_votes v ON v.submission_id=s.id WHERE s.challenge_id=? GROUP BY s.user_id), max_votes AS (SELECT MAX(votes) AS votes FROM participant_votes) SELECT pv.user_id,pv.votes FROM participant_votes pv,max_votes mv WHERE pv.votes>0 AND pv.votes=mv.votes").bind(challenge.id).all();
    for (const winner of winners.results || []) {
      await env.DB.prepare("INSERT OR IGNORE INTO spirit_points (id,edition_id,user_id,source_type,source_id,points,description) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),editionId,winner.user_id,"daily_winner",challenge.id,2,"Publicación más votada del día").run();
    }
  }
}


function spiritLimaDay(value) {
  return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Lima",year:"numeric",month:"2-digit",day:"2-digit"}).format(value);
}
async function processSpiritChallengeClosures(env, { runClosures = false, runOpenings = false } = {}) {
  await ensureSpiritSchema(env);
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_challenge_open_notifications (challenge_id TEXT PRIMARY KEY REFERENCES spirit_challenges(id) ON DELETE CASCADE, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, notified_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  const now=new Date().toISOString().slice(0,19).replace("T"," ");
  if(runClosures) {
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
        const yesterdayKey=spiritLimaDay(yesterday);
        // Idempotencia: si Cloudflare reintenta o ejecuta dos veces el cierre del mismo día,
        // conserva la racha ya calculada en lugar de reiniciarla a 1.
        const streak=prev?.last_first_date===day?Number(prev.current_streak):prev?.last_first_date===yesterdayKey?Number(prev.current_streak)+1:1;
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
  }
  if(runOpenings) {
  const opening=await env.DB.prepare("SELECT c.id,c.edition_id FROM spirit_challenges c LEFT JOIN spirit_challenge_open_notifications n ON n.challenge_id=c.id WHERE c.starts_at<=? AND c.ends_at>? AND n.challenge_id IS NULL ORDER BY c.starts_at").bind(now,now).all();
  for(const challenge of opening.results||[]) {
    const recipients=await env.DB.prepare("SELECT user_id FROM edition_members WHERE edition_id=? AND status='confirmed'").bind(challenge.edition_id).all();
    for(const recipient of recipients.results||[]) {
      await sendPushToUser(env,recipient.user_id,{title:"🎄 ¡NUEVO RETO ACTIVO!",body:"¡Ve y demuestra tu espíritu navideño! 🎁",tag:"spirit-open-"+challenge.id,url:"/?tab=spirit"},env.VAPID_SUBJECT||"https://navidad-cliente-360-2026.torresmarcos16.workers.dev");
    }
    await env.DB.prepare("INSERT OR IGNORE INTO spirit_challenge_open_notifications (challenge_id,edition_id) VALUES (?,?)").bind(challenge.id,challenge.edition_id).run();
  }
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


async function getAdminEdition(env, url) {
  const requestedId = url.searchParams.get("editionId");
  if (requestedId) return env.DB.prepare("SELECT * FROM editions WHERE id=?").bind(requestedId).first();
  return env.DB.prepare("SELECT * FROM editions ORDER BY year DESC, created_at DESC LIMIT 1").first();
}

async function getParticipantEdition(env,user,url){
 const requestedId=url.searchParams.get("editionId");
 if(requestedId)return env.DB.prepare("SELECT em.id,em.edition_id,em.status,e.title,e.year,e.event_date,e.budget_amount,e.currency,w.name AS team_name,e.status AS edition_status FROM edition_members em JOIN editions e ON e.id=em.edition_id JOIN workspace w ON w.id=e.workspace_id WHERE em.user_id=? AND em.edition_id=? AND em.status='confirmed'").bind(user.id,requestedId).first();
 return env.DB.prepare("SELECT em.id,em.edition_id,em.status,e.title,e.year,e.event_date,e.budget_amount,e.currency,w.name AS team_name,e.status AS edition_status FROM edition_members em JOIN editions e ON e.id=em.edition_id JOIN workspace w ON w.id=e.workspace_id WHERE em.user_id=? AND em.status='confirmed' ORDER BY em.joined_at DESC LIMIT 1").bind(user.id).first();
}

async function handleApi(request, env, url) {
  if (request.method === "GET" && url.pathname === "/api/health") return json({ ok: true, app: env.APP_NAME, version: "2.0.21" });
  if (request.method === "GET" && url.pathname === "/api/edition/home") {
    const user=await currentUser(request,env); if(!user)return json({error:"Inicia sesión primero."},401);
    const member=await getParticipantEdition(env,user,url); if(!member)return json({error:"No tienes una edición activa."},403);
    await ensureEditionHomeSettingsSchema(env); const row=await env.DB.prepare("SELECT config_json FROM edition_home_settings WHERE edition_id=?").bind(member.edition_id).first();
    let config={}; try{config=JSON.parse(row?.config_json||"{}");}catch{}
    return json({config,edition:{title:member.title,year:member.year,event_date:member.event_date,budget_amount:member.budget_amount,currency:member.currency,team_name:member.team_name}});
  }

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
      const membership=await getParticipantEdition(env,user,url);
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
        await env.DB.prepare("UPDATE users SET email = ?, display_name = ?, avatar_url = CASE WHEN avatar_url LIKE '/api/profile/avatar/%' THEN avatar_url ELSE ? END WHERE id = ?").bind(identity.email, identity.name, identity.picture, user.id).run();
      }
      return json({ ok: true, user: { id: user.id, email: user.email, name: user.display_name } }, 200, { "set-cookie": cookie(await createSession(user, env.SESSION_SECRET)) });
    } catch (error) { return json({ error: error.message || "Error de autenticación." }, 401); }
  }
  if (request.method === "POST" && url.pathname === "/api/auth/logout") return json({ ok: true }, 200, { "set-cookie": cookie("", 0) });
  if (request.method === "GET" && url.pathname === "/api/me") {
    const user = await currentUser(request, env);
    if (!user) return json({ authenticated: false });
    await ensureParticipantProfilesSchema(env);
    const admin=await isPrimaryAdmin(user,env);
    const requestedId=url.searchParams.get("editionId");
    if(admin){
      const targetEdition=requestedId
        ? await env.DB.prepare("SELECT id FROM editions WHERE id=?").bind(requestedId).first()
        : await env.DB.prepare("SELECT id FROM editions ORDER BY year DESC,created_at DESC LIMIT 1").first();
      if(targetEdition){
        const existing=await env.DB.prepare("SELECT id,status FROM edition_members WHERE edition_id=? AND user_id=?").bind(targetEdition.id,user.id).first();
        if(existing){
          if(existing.status!=="confirmed")await env.DB.prepare("UPDATE edition_members SET status='confirmed',joined_at=datetime('now') WHERE id=?").bind(existing.id).run();
        }else{
          await env.DB.prepare("INSERT INTO edition_members (id,edition_id,user_id,status) VALUES (?,?,?,'confirmed')").bind(crypto.randomUUID(),targetEdition.id,user.id).run();
        }
      }
    }
    const membershipsResult=await env.DB.prepare("SELECT em.id,em.edition_id,em.status,e.title,e.year,e.event_date,e.budget_amount,e.currency,w.name AS team_name FROM edition_members em JOIN editions e ON e.id=em.edition_id JOIN workspace w ON w.id=e.workspace_id WHERE em.user_id=? AND em.status='confirmed' ORDER BY em.joined_at ASC").bind(user.id).all();
    const memberships=membershipsResult.results||[];
    const membership=requestedId?memberships.find(x=>x.edition_id===requestedId)||null:memberships[memberships.length-1]||null;
    const profile = await env.DB.prepare("SELECT first_name, last_name FROM participant_profiles WHERE user_id=?").bind(user.id).first();
    return json({ authenticated:true,user,isPrimaryAdmin:admin,membership,memberships,participantProfile:profile||null });
  }
  if (request.method === "GET" && url.pathname === "/api/participants") {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión primero." }, 401);
    const membership=await getParticipantEdition(env,user,url);
    if (!membership) return json({ error: "Necesitas una participación activa para consultar la lista." }, 403);
    await ensureParticipantProfilesSchema(env);
    const result = await env.DB.prepare("SELECT em.user_id, COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS display_name, u.avatar_url FROM edition_members em JOIN users u ON u.id=em.user_id LEFT JOIN participant_profiles p ON p.user_id=em.user_id WHERE em.edition_id=? AND em.status='confirmed' ORDER BY em.joined_at ASC").bind(membership.edition_id).all();
    return json({ participants: result.results || [], total: (result.results || []).length });
  }

  if (url.pathname.startsWith("/api/spirit/")) {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión primero." }, 401);
    const member=await getParticipantEdition(env,user,url);
    if (!member) return json({ error: "Necesitas una participación activa para entrar a Espíritu Navideño." }, 403);
    // La lectura de Espíritu no debe ejecutar migraciones estructurales.
    // Las tablas del módulo se crean desde las rutas administrativas/de configuración.
    // En la navegación normal solo garantizamos el perfil, que usa el ranking.
    try {
      await ensureParticipantProfilesSchema(env);
    } catch (error) {
      console.error("Spirit participant profile schema unavailable", { message:error?.message||String(error) });
      return json({ error:"No se pudo preparar el perfil de participantes. Intenta nuevamente.", code:"SPIRIT_PROFILE_SCHEMA_UNAVAILABLE", retryable:true },503,{"retry-after":"5"});
    }
    if(request.method==="GET"&&url.pathname==="/api/spirit/achievements"){
      await ensureSpiritSchema(env);
      const achievementStart="2026-11-13 05:00:00"; // 00:00, hora Perú.
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_achievement_resets (edition_id TEXT PRIMARY KEY REFERENCES editions(id) ON DELETE CASCADE, reset_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
      const reset=await env.DB.prepare("INSERT OR IGNORE INTO spirit_achievement_resets (edition_id) VALUES (?)").bind(member.edition_id).run();
      if(reset.meta?.changes>0) await env.DB.prepare("DELETE FROM spirit_points WHERE edition_id=? AND source_type='achievement' AND source_id<>'son_webadas'").bind(member.edition_id).run();
      const [activity,likes,commentsGiven,votesGiven,commentTargets,earlyDays,challengeRows,icebreaker]=await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS submissions,COUNT(DISTINCT date(created_at,'-5 hours')) AS active_days,SUM(CASE WHEN lower(COALESCE(media_type,'')) LIKE 'audio/%' THEN 1 ELSE 0 END) AS voice_count,SUM(CASE WHEN lower(COALESCE(media_type,'')) LIKE 'image/%' THEN 1 ELSE 0 END) AS photo_count,COUNT(DISTINCT challenge_id) AS distinct_challenges FROM spirit_submissions WHERE edition_id=? AND user_id=? AND created_at>=?").bind(member.edition_id,user.id,achievementStart).first(),
        env.DB.prepare("SELECT COUNT(*) AS likes FROM spirit_votes v JOIN spirit_submissions s ON s.id=v.submission_id WHERE s.edition_id=? AND s.user_id=? AND v.created_at>=?").bind(member.edition_id,user.id,achievementStart).first(),
        env.DB.prepare("SELECT COUNT(*) AS comments FROM spirit_comments c JOIN spirit_submissions s ON s.id=c.submission_id WHERE c.edition_id=? AND c.user_id=? AND s.user_id<>? AND c.created_at>=?").bind(member.edition_id,user.id,user.id,achievementStart).first(),
        env.DB.prepare("SELECT COUNT(*) AS likes FROM spirit_votes v JOIN spirit_submissions s ON s.id=v.submission_id WHERE s.edition_id=? AND v.voter_user_id=? AND s.user_id<>? AND v.created_at>=?").bind(member.edition_id,user.id,user.id,achievementStart).first(),
        env.DB.prepare("SELECT COUNT(DISTINCT s.user_id) AS people FROM spirit_comments c JOIN spirit_submissions s ON s.id=c.submission_id WHERE c.edition_id=? AND c.user_id=? AND s.user_id<>? AND c.created_at>=?").bind(member.edition_id,user.id,user.id,achievementStart).first(),
        env.DB.prepare("SELECT COUNT(DISTINCT date(created_at,'-5 hours')) AS days FROM spirit_submissions WHERE edition_id=? AND user_id=? AND created_at>=? AND CAST(strftime('%H',created_at,'-5 hours') AS INTEGER)<8").bind(member.edition_id,user.id,achievementStart).first(),
        env.DB.prepare("SELECT c.id,c.starts_at,CASE WHEN EXISTS(SELECT 1 FROM spirit_submissions s WHERE s.challenge_id=c.id AND s.user_id=? AND s.created_at>=?) THEN 1 ELSE 0 END AS participated FROM spirit_challenges c WHERE c.edition_id=? AND c.challenge_kind='daily' AND c.starts_at>=? ORDER BY c.starts_at,c.id").bind(user.id,achievementStart,member.edition_id,achievementStart).all(),
        env.DB.prepare("SELECT COUNT(DISTINCT s.challenge_id) AS count FROM spirit_submissions s WHERE s.edition_id=? AND s.user_id=? AND s.created_at>=? AND s.id=(SELECT s2.id FROM spirit_submissions s2 WHERE s2.challenge_id=s.challenge_id ORDER BY s2.created_at,s2.id LIMIT 1)").bind(member.edition_id,user.id,achievementStart).first()
      ]);
      const rows=challengeRows.results||[];
      let challengeStreak=0,maxChallengeStreak=0;
      for(const row of rows){challengeStreak=Number(row.participated)?challengeStreak+1:0;maxChallengeStreak=Math.max(maxChallengeStreak,challengeStreak);}
      const metrics={submissions:Number(activity?.submissions||0),activeDays:Number(activity?.active_days||0),voiceCount:Number(activity?.voice_count||0),photoCount:Number(activity?.photo_count||0),distinctChallenges:Number(activity?.distinct_challenges||0),likes:Number(likes?.likes||0),commentsGiven:Number(commentsGiven?.comments||0),likesGiven:Number(votesGiven?.likes||0),peopleMotivated:Number(commentTargets?.people||0),earlyDays:Number(earlyDays?.days||0),challengeStreak,maxChallengeStreak,icebreaker:Number(icebreaker?.count||0)};
      const definitions=[
        {id:"first_post",icon:"🎄",title:"¿Qué así va ser?",description:"Publica tu primera participación en Espíritu.",reward:5,progress:metrics.submissions,target:1},
        {id:"son_webadas",icon:"🛌",title:"Son Webadas",description:"Pasa 24 horas sin conectarte a la aplicación ni participar en Espíritu. Vuelve después de ese descanso para reclamar tu logro.",reward:20,progress:0,target:1},
        {id:"three_posts",icon:"🎅",title:"Espíritu navideño",description:"Completa 3 publicaciones en los retos diarios.",reward:10,progress:metrics.submissions,target:3},
        {id:"five_posts",icon:"⭐",title:"Estrella navideña",description:"Completa 5 publicaciones en los retos diarios.",reward:15,progress:metrics.submissions,target:5},
        {id:"community_star",icon:"❤️",title:"Coke de cokes",description:"Consigue 10 Me gusta en tus publicaciones.",reward:20,progress:metrics.likes,target:10},
        {id:"frequent",icon:"🔥",title:"Participante frecuente",description:"Participa en 3 días diferentes.",reward:10,progress:metrics.activeDays,target:3},
        {id:"multimedia",icon:"🎙️",title:"Michi Michi",description:"Publica al menos una foto y un audio en los retos.",reward:15,progress:Math.min(metrics.voiceCount,metrics.photoCount),target:1,detail:metrics.photoCount+" foto(s) · "+metrics.voiceCount+" audio(s)"},
        {id:"kind_companion",icon:"🤝",title:"Buen compañero",description:"Regala 10 Me gusta a publicaciones de otros participantes.",reward:10,progress:metrics.likesGiven,target:10},
        {id:"star_commenter",icon:"💬",title:"Comentarista estrella",description:"Deja 5 comentarios en publicaciones de tus compañeros.",reward:20,progress:metrics.commentsGiven,target:5},
        {id:"early_bird",icon:"🌅",title:"Madrugador navideño",description:"Participa antes de las 8:00 a. m. en 3 días diferentes (hora Perú).",reward:15,progress:metrics.earlyDays,target:3},
        {id:"unstoppable_days",icon:"📅",title:"¡Vamos Rozvi!",description:"Participa en 7 días diferentes.",reward:25,progress:metrics.activeDays,target:7},
        {id:"challenge_marathon",icon:"🏃",title:"Maratón navideña",description:"Participa en 5 retos diarios consecutivos.",reward:30,progress:metrics.maxChallengeStreak,target:5},
        {id:"spirit_unstoppable",icon:"🚀",title:"Espíritu imparable",description:"Participa en 20 retos diarios diferentes.",reward:60,progress:metrics.distinctChallenges,target:20},
        {id:"good_neighbor",icon:"💌",title:"Buen vecino",description:"Deja 10 comentarios en publicaciones de tus compañeros.",reward:25,progress:metrics.commentsGiven,target:10},
        {id:"kindness_giver",icon:"💖",title:"Elegante",description:"Regala 25 Me gusta a publicaciones de otros participantes.",reward:25,progress:metrics.likesGiven,target:25},
        {id:"official_motivator",icon:"👏",title:"Motivador oficial",description:"Comenta publicaciones de 5 compañeros diferentes.",reward:30,progress:metrics.peopleMotivated,target:5},
        {id:"christmas_voice",icon:"🎤",title:"La voz de Navidad",description:"Publica 5 audios en los retos.",reward:30,progress:metrics.voiceCount,target:5},
        {id:"multitalented_artist",icon:"🎨",title:"Artista multifacético",description:"Publica al menos 3 fotos y 3 audios.",reward:40,progress:Math.min(Math.floor(metrics.photoCount/3),Math.floor(metrics.voiceCount/3)),target:1,detail:metrics.photoCount+" foto(s) · "+metrics.voiceCount+" audio(s)"},
        {id:"icebreaker",icon:"🧊",title:"El rompehielo",description:"Sé la primera persona en publicar en 3 retos diferentes.",reward:15,progress:metrics.icebreaker,target:3}
      ];
      const completedCount=definitions.filter(item=>item.progress>=item.target).length;
      definitions.push({id:"christmas_legend",icon:"👑",title:"Leyenda de Navidad",description:"Desbloquea todos los demás logros de esta colección.",reward:100,progress:completedCount,target:definitions.length,detail:completedCount+" de "+definitions.length+" logros"});
      for(const achievement of definitions){
        if(achievement.progress>=achievement.target){
          await env.DB.prepare("INSERT OR IGNORE INTO spirit_points (id,edition_id,user_id,source_type,source_id,points,description) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),member.edition_id,user.id,"achievement",achievement.id,achievement.reward,"Logro desbloqueado: "+achievement.title).run();
        }
      }
      const earned=await env.DB.prepare("SELECT source_id,points,created_at FROM spirit_points WHERE edition_id=? AND user_id=? AND source_type='achievement'").bind(member.edition_id,user.id).all();
      const earnedMap=new Map((earned.results||[]).map(row=>[row.source_id,row]));
      const achievements=definitions.map(item=>{const row=earnedMap.get(item.id);return {...item,progress:Math.min(item.progress,item.target),unlocked:!!row,earnedPoints:Number(row?.points||0),unlockedAt:row?.created_at||null};});
      return json({achievements,unlockedCount:achievements.filter(x=>x.unlocked).length,totalCount:achievements.length,earnedPoints:achievements.reduce((sum,x)=>sum+x.earnedPoints,0)});
    }
    const spiritMediaMatch=url.pathname.match(/^\/api\/spirit\/media\/([A-Za-z0-9-]+)$/);
    if(request.method==="GET"&&spiritMediaMatch){
      let media=await env.DB.prepare("SELECT media_data,image_data,media_type FROM spirit_submissions WHERE id=? AND edition_id=?").bind(spiritMediaMatch[1],member.edition_id).first();
      if(!media)media=await env.DB.prepare("SELECT media_data,NULL AS image_data,media_type FROM spirit_extra_submissions WHERE id=? AND edition_id=? AND (status='approved' OR user_id=?)").bind(spiritMediaMatch[1],member.edition_id,user.id).first();
      if(!media)return json({error:"No encontramos el archivo de esta publicación."},404);
      return dataUrlResponse(media.media_data||media.image_data,media.media_type||"image/jpeg",request);
    }
    if (request.method === "GET" && url.pathname === "/api/spirit/unread") {
      const read = await env.DB.prepare("SELECT last_seen_at FROM spirit_submission_reads WHERE edition_id=? AND user_id=?").bind(member.edition_id,user.id).first();
      const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM spirit_submissions WHERE edition_id=? AND user_id<>? AND created_at>?").bind(member.edition_id,user.id,read?.last_seen_at || "1970-01-01 00:00:00").first();
      return json({ unread: count?.total || 0 });
    }
    let activitySetting=null;
    try { activitySetting=await env.DB.prepare("SELECT manual_override FROM spirit_activity_settings WHERE edition_id=?").bind(member.edition_id).first(); }
    catch(error) { console.error("Spirit activity settings query failed",{message:error?.message||String(error)}); }
    const manualOverride = Number(activitySetting?.manual_override || 0) === 1;
    const challengePromise = manualOverride
      ? env.DB.prepare("SELECT id,title,description,points,bonus_points,challenge_type,config_json,starts_at,ends_at FROM spirit_challenges WHERE edition_id=? AND challenge_kind='daily' ORDER BY CASE WHEN starts_at<=datetime('now') AND ends_at>datetime('now') THEN 0 WHEN starts_at>datetime('now') THEN 1 ELSE 2 END, CASE WHEN starts_at>datetime('now') THEN starts_at END ASC, starts_at DESC LIMIT 1").bind(member.edition_id).first()
      : env.DB.prepare("SELECT id,title,description,points,bonus_points,challenge_type,config_json,starts_at,ends_at FROM spirit_challenges WHERE edition_id=? AND challenge_kind='daily' AND starts_at<=datetime('now') AND ends_at>datetime('now') ORDER BY starts_at DESC LIMIT 1").bind(member.edition_id).first();
    const normalizeChallenge = raw => {
      if (!raw) return { challenge: null, challengeCorrectAnswer: null };
      let config={};try{config=JSON.parse(raw.config_json||"{}");}catch{}
      const challenge={...raw,config:{question:config.question||"",options:Array.isArray(config.options)?config.options:[]}};
      delete challenge.config_json;
      return { challenge, challengeCorrectAnswer:String(config.correctAnswer||"") };
    };


    if(request.method==="GET"&&url.pathname==="/api/spirit/extra"){
      await env.DB.prepare("UPDATE spirit_challenges AS extra SET ends_at=datetime('now') WHERE extra.edition_id=? AND extra.challenge_kind='extra' AND extra.starts_at<=datetime('now') AND extra.ends_at>datetime('now') AND EXISTS (SELECT 1 FROM spirit_challenges daily WHERE daily.edition_id=extra.edition_id AND daily.challenge_kind='daily' AND (lower(trim(daily.title))=lower(trim(extra.title)) OR lower(trim(daily.description))=lower(trim(extra.description))))").bind(member.edition_id).run();
      const rankRow=await env.DB.prepare("WITH scores AS (SELECT em.user_id,COALESCE(SUM(sp.points),0) AS points FROM edition_members em LEFT JOIN spirit_points sp ON sp.edition_id=em.edition_id AND sp.user_id=em.user_id WHERE em.edition_id=? AND em.status='confirmed' GROUP BY em.user_id), ranked AS (SELECT user_id,RANK() OVER (ORDER BY points DESC) AS rank FROM scores) SELECT rank FROM ranked WHERE user_id=?").bind(member.edition_id,user.id).first();
      const eligible=!rankRow||Number(rankRow.rank)>1;
      const challenge=eligible?await env.DB.prepare("SELECT id,title,description,challenge_type,starts_at,ends_at FROM spirit_challenges WHERE edition_id=? AND challenge_kind='extra' AND starts_at<=datetime('now') AND ends_at>datetime('now') ORDER BY starts_at DESC LIMIT 1").bind(member.edition_id).first():null;
      const submission=challenge?await env.DB.prepare("SELECT id,status,caption,created_at FROM spirit_extra_submissions WHERE challenge_id=? AND user_id=?").bind(challenge.id,user.id).first():null;
      return json({challenge:challenge||null,submission:submission||null,eligible,rank:rankRow?.rank||null});
    }
    if(request.method==="POST"&&url.pathname==="/api/spirit/extra/submissions"){
      const rankRow=await env.DB.prepare("WITH scores AS (SELECT em.user_id,COALESCE(SUM(sp.points),0) AS points FROM edition_members em LEFT JOIN spirit_points sp ON sp.edition_id=em.edition_id AND sp.user_id=em.user_id WHERE em.edition_id=? AND em.status='confirmed' GROUP BY em.user_id), ranked AS (SELECT user_id,RANK() OVER (ORDER BY points DESC) AS rank FROM scores) SELECT rank FROM ranked WHERE user_id=?").bind(member.edition_id,user.id).first();
      if(rankRow&&Number(rankRow.rank)===1)return json({error:"El reto bonus está reservado para todos los participantes excepto el primer lugar."},403);
      const challenge=await env.DB.prepare("SELECT id,challenge_type FROM spirit_challenges WHERE edition_id=? AND challenge_kind='extra' AND starts_at<=datetime('now') AND ends_at>datetime('now') ORDER BY starts_at DESC LIMIT 1").bind(member.edition_id).first();
      if(!challenge)return json({error:"No hay un reto bonus activo."},409);
      const body=await request.json(),caption=String(body.caption||"").trim(),mediaData=String(body.mediaData||""),mediaType=String(body.mediaType||"");
      if(caption.length>500||mediaData.length>5500000)return json({error:"La participación supera el límite permitido."},400);
      if(challenge.challenge_type==="photo"&&(!mediaData.startsWith("data:image/")||!/^image\/(jpeg|png|webp)$/.test(mediaType)))return json({error:"Adjunta una foto válida."},400);
      if(challenge.challenge_type==="voice"&&(!mediaData.startsWith("data:audio/")||!mediaType.startsWith("audio/")))return json({error:"Adjunta una grabación válida."},400);
      if(challenge.challenge_type==="text"&&caption.length<2)return json({error:"Escribe tu participación."},400);
      const id=crypto.randomUUID();
      try{await env.DB.prepare("INSERT INTO spirit_extra_submissions (id,edition_id,challenge_id,user_id,caption,media_data,media_type) VALUES (?,?,?,?,?,?,?)").bind(id,member.edition_id,challenge.id,user.id,caption,mediaData||null,mediaType||null).run();}
      catch{return json({error:"Ya enviaste tu participación para este reto bonus."},409);}
      try {
        if (env.ADMIN_EMAIL) {
          const admin = await env.DB.prepare("SELECT id FROM users WHERE lower(email)=lower(?) LIMIT 1").bind(env.ADMIN_EMAIL).first();
          if (admin?.id) {
            const bonusTitle = await env.DB.prepare("SELECT title FROM spirit_challenges WHERE id=?").bind(challenge.id).first();
            await sendPushToUser(env, admin.id, {title:"🔔 Nueva evidencia Bonus por aprobar",body:"Un participante envió evidencia para «"+String(bonusTitle?.title||"Reto bonus").slice(0,90)+"».",tag:"spirit-bonus-review-"+id,url:"/?tab=spirit"},url.origin);
          }
        }
      } catch(error) { console.warn("Admin bonus review push notification failed",{submissionId:id,message:error?.message||String(error)}); }
      return json({ok:true,id,status:"pending",adminNotificationAttempted:true},201);
    }

    if (request.method === "GET" && url.pathname === "/api/spirit/board") {
      let ranking={results:[]},rawChallenge=null;
      const rankingPromise=env.DB.prepare("SELECT u.id AS user_id,COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS display_name,u.avatar_url,COALESCE(pts.points,0) AS points,COALESCE(st.current_streak,0) AS first_place_streak FROM edition_members em JOIN users u ON u.id=em.user_id LEFT JOIN participant_profiles p ON p.user_id=em.user_id LEFT JOIN (SELECT user_id,SUM(points) AS points FROM spirit_points WHERE edition_id=? GROUP BY user_id) pts ON pts.user_id=em.user_id LEFT JOIN spirit_leader_streaks st ON st.edition_id=em.edition_id AND st.user_id=em.user_id WHERE em.edition_id=? AND em.status='confirmed' ORDER BY points DESC,display_name COLLATE NOCASE").bind(member.edition_id,member.edition_id).all().catch(error=>{console.error("Spirit ranking query failed",{message:error?.message||String(error)});return {results:[]};});
      const challengeSafe=challengePromise.catch(error=>{console.error("Spirit challenge query failed",{message:error?.message||String(error)});return null;});
      [ranking,rawChallenge]=await Promise.all([rankingPromise,challengeSafe]);
      const {challenge,challengeCorrectAnswer}=normalizeChallenge(rawChallenge);
      let previousPoints=null,previousRank=0;
      const allRows=(ranking.results||[]).map(person=>{const score=Number(person.points||0),rank=previousPoints===score?previousRank:previousRank+1;previousPoints=score;previousRank=rank;return {...person,rank};});
      const mine=allRows.findIndex(x=>x.user_id===user.id);
      const myRank=mine>=0?allRows[mine].rank:null;
      let submissions=[];
      const feedChallenge=challenge;
      const feedCorrectAnswer=challengeCorrectAnswer;
      const feedPromise=feedChallenge?env.DB.prepare("SELECT s.id,s.user_id,s.caption,s.media_type,CASE WHEN s.media_data IS NOT NULL OR s.image_data IS NOT NULL THEN 1 ELSE 0 END AS has_media,s.created_at,COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),'') ,u.display_name) AS display_name,u.avatar_url,(SELECT COUNT(*) FROM spirit_comments sc WHERE sc.submission_id=s.id) AS comment_count,(SELECT COUNT(*) FROM spirit_votes v WHERE v.submission_id=s.id) AS votes,CASE WHEN EXISTS(SELECT 1 FROM spirit_votes mine JOIN spirit_submissions liked ON liked.id=mine.submission_id WHERE mine.voter_user_id=? AND liked.challenge_id=s.challenge_id AND liked.user_id=s.user_id) THEN 1 ELSE 0 END AS voted,(SELECT liked.id FROM spirit_votes mine JOIN spirit_submissions liked ON liked.id=mine.submission_id WHERE mine.voter_user_id=? AND liked.challenge_id=s.challenge_id AND liked.user_id=s.user_id ORDER BY mine.created_at LIMIT 1) AS my_vote_submission_id FROM spirit_submissions s JOIN users u ON u.id=s.user_id LEFT JOIN participant_profiles p ON p.user_id=s.user_id WHERE s.challenge_id=? ORDER BY s.created_at DESC").bind(user.id,user.id,feedChallenge.id).all().catch(error=>{console.error("Spirit feed query failed",{message:error?.message||String(error)});return {results:[]};}):Promise.resolve({results:[]});
      const bonusFeedPromise=env.DB.prepare("SELECT x.id,x.user_id,x.caption,x.media_type,CASE WHEN x.media_data IS NOT NULL THEN 1 ELSE 0 END AS has_media,x.created_at,COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS display_name,u.avatar_url,c.title AS challenge_title,x.status FROM spirit_extra_submissions x JOIN users u ON u.id=x.user_id JOIN spirit_challenges c ON c.id=x.challenge_id LEFT JOIN participant_profiles p ON p.user_id=x.user_id WHERE x.edition_id=? AND (x.status='approved' OR x.user_id=?) ORDER BY x.created_at DESC LIMIT 50").bind(member.edition_id,user.id).all().catch(error=>{console.error("Spirit bonus feed query failed",{message:error?.message||String(error)});return {results:[]};});
      const readPromise=env.DB.prepare("INSERT INTO spirit_submission_reads (edition_id,user_id,last_seen_at) VALUES (?,?,datetime('now')) ON CONFLICT(edition_id,user_id) DO UPDATE SET last_seen_at=datetime('now')").bind(member.edition_id,user.id).run().catch(error=>console.error("Spirit read marker update failed",{message:error?.message||String(error)}));
      const [feed,bonusFeed]=await Promise.all([feedPromise,bonusFeedPromise,readPromise]).then(([regular,bonus])=>[regular,bonus]);
      submissions=(feed.results||[]).map(item=>({...item,mediaUrl:item.has_media?"/api/spirit/media/"+encodeURIComponent(item.id):null,eligibleForVoting:feedChallenge?.challenge_type!=="trivia"||item.caption===feedCorrectAnswer}));
      const bonusSubmissions=(bonusFeed.results||[]).map(item=>({...item,mediaUrl:item.has_media?"/api/spirit/media/"+encodeURIComponent(item.id):null,isBonus:true}));
      return json({activitiesEnabled:!!challenge,manualOverride,challenge:challenge||null,submissions,bonusSubmissions,ranking:allRows,myPoints:mine>=0?allRows[mine].points:0,myRank,mySubmissionCount:challenge?submissions.filter(x=>x.user_id===user.id).length:0,mySubmission:challenge?submissions.find(x=>x.user_id===user.id)||null:null,partial:!rawChallenge||!ranking.results});
    }
    const commentsMatch=url.pathname.match(/^\/api\/spirit\/submissions\/([A-Za-z0-9-]+)\/comments$/);
    if(commentsMatch&&(request.method==="GET"||request.method==="POST")){
      const submission=await env.DB.prepare("SELECT id,user_id FROM spirit_submissions WHERE id=? AND edition_id=?").bind(commentsMatch[1],member.edition_id).first();
      if(!submission)return json({error:"No encontramos esta publicación."},404);
      if(request.method==="GET"){
        const rows=await env.DB.prepare("SELECT c.id,c.user_id,c.comment,c.created_at,COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS display_name,u.avatar_url FROM spirit_comments c JOIN users u ON u.id=c.user_id LEFT JOIN participant_profiles p ON p.user_id=c.user_id WHERE c.submission_id=? AND c.edition_id=? ORDER BY c.created_at ASC LIMIT 100").bind(submission.id,member.edition_id).all();
        return json({comments:rows.results||[]});
      }
      const body=await request.json(),comment=String(body.comment||"").trim();
      const unsafeComment=rejectUnsafePayload(comment);if(unsafeComment)return unsafeComment;
      if(comment.length<1||comment.length>500)return json({error:"El comentario debe tener entre 1 y 500 caracteres."},400);
      const id=crypto.randomUUID();
      await env.DB.prepare("INSERT INTO spirit_comments (id,submission_id,edition_id,user_id,comment) VALUES (?,?,?,?,?)").bind(id,submission.id,member.edition_id,user.id,comment).run();
      const author=await env.DB.prepare("SELECT COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS name FROM users u LEFT JOIN participant_profiles p ON p.user_id=u.id WHERE u.id=?").bind(user.id).first();
      if(submission.user_id!==user.id)await sendPushToUser(env,submission.user_id,{title:"💬 Nuevo comentario en Espíritu",body:(author?.name||"Un participante")+" ha comentado tu publicación.",tag:"spirit-comment-"+id,url:"/?tab=spirit"},url.origin);
      return json({ok:true,id});
    }
    const shareMatch=url.pathname.match(/^\/api\/spirit\/submissions\/([A-Za-z0-9-]+)\/share$/);
    if(request.method==="POST"&&shareMatch){
      const submission=await env.DB.prepare("SELECT id,user_id FROM spirit_submissions WHERE id=? AND edition_id=?").bind(shareMatch[1],member.edition_id).first();
      if(!submission)return json({error:"No encontramos esta publicación."},404);
      if(submission.user_id!==user.id){
        const sharer=await env.DB.prepare("SELECT COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS name FROM users u LEFT JOIN participant_profiles p ON p.user_id=u.id WHERE u.id=?").bind(user.id).first();
        await sendPushToUser(env,submission.user_id,{title:"📲 ¡Compartieron tu publicación!",body:(sharer?.name||"Un participante")+" ha compartido tu publicación.",tag:"spirit-share-"+crypto.randomUUID(),url:"/?tab=spirit"},url.origin);
      }
      return json({ok:true});
    }
    const commentDeleteMatch=url.pathname.match(/^\/api\/spirit\/comments\/([A-Za-z0-9-]+)$/);
    if(request.method==="DELETE"&&commentDeleteMatch){
      const result=await env.DB.prepare("DELETE FROM spirit_comments WHERE id=? AND edition_id=? AND user_id=?").bind(commentDeleteMatch[1],member.edition_id,user.id).run();
      if(!result.meta?.changes)return json({error:"No puedes eliminar este comentario o ya no existe."},404);
      return json({ok:true});
    }
    let {challenge,challengeCorrectAnswer}=normalizeChallenge(await challengePromise);
    if (request.method === "POST" && url.pathname === "/api/spirit/submissions") {
      if(!challenge)return json({error:"No hay un reto activo en este momento."},409);
      const body=await request.json(),caption=String(body.caption||"").trim(),mediaData=String(body.mediaData||body.imageData||""),mediaType=String(body.mediaType||(body.imageData?"image/jpeg":""));
      const unsafeCaption=rejectUnsafePayload(caption);if(unsafeCaption)return unsafeCaption;
      const challengeType=challenge.challenge_type||"text";
      if(challengeType==="text"&&(caption.length<2||caption.length>500))return json({error:"Tu participación debe tener entre 2 y 500 caracteres."},400);
      if(challengeType==="photo"&&(!mediaData.startsWith("data:image/jpeg;base64,")||mediaData.length>300000))return json({error:"Debes adjuntar una foto JPG válida."},400);
      if(challengeType==="voice"&&(!/^data:audio\/(webm|ogg|mp4)(?:;[^,]*)?;base64,/i.test(mediaData)||mediaData.length>500000))return json({error:"Graba un audio válido de máximo 30 segundos."},400);
      if(challengeType==="trivia"&&(caption.length<1||caption.length>120))return json({error:"Selecciona una respuesta para la trivia."},400);
      if(challengeType==="photo"||challengeType==="voice"){if(caption.length>500)return json({error:"El texto complementario es demasiado largo."},400);}
      const configRaw=await env.DB.prepare("SELECT config_json FROM spirit_challenges WHERE id=?").bind(challenge.id).first();
      let challengeConfig={};try{challengeConfig=JSON.parse(configRaw?.config_json||"{}");}catch{}
      const correct=challengeType!=="trivia"||String(caption)===String(challengeConfig.correctAnswer||"");
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
      const submissionInfo=await env.DB.prepare("SELECT challenge_id,user_id FROM spirit_submissions WHERE id=?").bind(submission.id).first();
      await env.DB.batch([
        env.DB.prepare("DELETE FROM spirit_points WHERE edition_id=? AND ((source_id=? AND source_type IN (?,?)) OR (source_type=? AND source_id IN (SELECT id FROM spirit_votes WHERE submission_id=?)))").bind(member.edition_id,submission.id,"submission","community_bonus","like",submission.id),
        env.DB.prepare("DELETE FROM spirit_submissions WHERE id=? AND edition_id=? AND user_id=?").bind(submission.id,member.edition_id,user.id),
        env.DB.prepare("DELETE FROM spirit_points WHERE edition_id=? AND source_type='like' AND source_id IN (SELECT v.id FROM spirit_votes v JOIN spirit_submissions s ON s.id=v.submission_id WHERE s.challenge_id=? AND s.user_id=?)").bind(member.edition_id,submissionInfo.challenge_id,user.id),
        env.DB.prepare("INSERT OR IGNORE INTO spirit_points (id,edition_id,user_id,source_type,source_id,points,description) SELECT lower(hex(randomblob(16))),s.edition_id,s.user_id,'like',v.id,1,'Me gusta recibido' FROM spirit_votes v JOIN spirit_submissions s ON s.id=v.submission_id WHERE s.challenge_id=? AND s.user_id=? ORDER BY v.created_at,v.id LIMIT 10").bind(submissionInfo.challenge_id,user.id)
      ]);
      return json({ok:true,message:"Tu participación fue eliminada y el puntaje se recalculó correctamente."});
    }
    const likesMatch=url.pathname.match(/^\/api\/spirit\/submissions\/([A-Za-z0-9-]+)\/likes$/);
    if(request.method==="GET"&&likesMatch){
      if(!challenge)return json({error:"Los Me gusta solo se pueden consultar durante un reto activo."},409);
      const submission=await env.DB.prepare("SELECT id FROM spirit_submissions WHERE id=? AND edition_id=? AND challenge_id=?").bind(likesMatch[1],member.edition_id,challenge.id).first();
      if(!submission)return json({error:"La publicación no pertenece al reto activo."},404);
      const rows=await env.DB.prepare("SELECT u.id AS user_id,COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS display_name,u.avatar_url,v.created_at FROM spirit_votes v JOIN users u ON u.id=v.voter_user_id LEFT JOIN participant_profiles p ON p.user_id=u.id WHERE v.submission_id=? ORDER BY v.created_at ASC").bind(submission.id).all();
      return json({likes:rows.results||[]});
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
      const inserted=await env.DB.prepare("INSERT INTO spirit_votes (id,submission_id,voter_user_id) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM spirit_votes v JOIN spirit_submissions liked ON liked.id=v.submission_id WHERE v.voter_user_id=? AND liked.challenge_id=? AND liked.user_id=?)").bind(voteId,submission.id,user.id,user.id,challenge.id,submission.user_id).run();
      if(!(inserted.meta?.changes>0))return json({error:"Ya diste Me gusta a una publicación de este participante en el reto."},409);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM spirit_points WHERE edition_id=? AND source_type='like' AND source_id IN (SELECT v.id FROM spirit_votes v JOIN spirit_submissions s ON s.id=v.submission_id WHERE s.challenge_id=? AND s.user_id=?)").bind(member.edition_id,challenge.id,submission.user_id),
        env.DB.prepare("INSERT OR IGNORE INTO spirit_points (id,edition_id,user_id,source_type,source_id,points,description) SELECT lower(hex(randomblob(16))),s.edition_id,s.user_id,'like',v.id,1,'Me gusta recibido' FROM spirit_votes v JOIN spirit_submissions s ON s.id=v.submission_id WHERE s.challenge_id=? AND s.user_id=? ORDER BY v.created_at,v.id LIMIT 10").bind(challenge.id,submission.user_id)
      ]);
      const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM spirit_votes v JOIN spirit_submissions s ON s.id=v.submission_id WHERE s.challenge_id=? AND s.user_id=?").bind(challenge.id,submission.user_id).first();
      const earned=await env.DB.prepare("SELECT COUNT(*) AS total FROM spirit_points WHERE edition_id=? AND source_type='like' AND source_id IN (SELECT v.id FROM spirit_votes v JOIN spirit_submissions s ON s.id=v.submission_id WHERE s.challenge_id=? AND s.user_id=?)").bind(member.edition_id,challenge.id,submission.user_id).first();
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
      const submissionInfo=await env.DB.prepare("SELECT challenge_id,user_id FROM spirit_submissions WHERE id=?").bind(submission.id).first();
      await env.DB.batch([
        env.DB.prepare("DELETE FROM spirit_points WHERE edition_id=? AND source_type='like' AND source_id IN (SELECT v.id FROM spirit_votes v JOIN spirit_submissions s ON s.id=v.submission_id WHERE s.challenge_id=? AND s.user_id=?)").bind(member.edition_id,submissionInfo.challenge_id,submissionInfo.user_id),
        env.DB.prepare("DELETE FROM spirit_votes WHERE id=?").bind(vote.id),
        env.DB.prepare("INSERT OR IGNORE INTO spirit_points (id,edition_id,user_id,source_type,source_id,points,description) SELECT lower(hex(randomblob(16))),s.edition_id,s.user_id,'like',v.id,1,'Me gusta recibido' FROM spirit_votes v JOIN spirit_submissions s ON s.id=v.submission_id WHERE s.challenge_id=? AND s.user_id=? ORDER BY v.created_at,v.id LIMIT 10").bind(submissionInfo.challenge_id,submissionInfo.user_id)
      ]);
      const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM spirit_votes v JOIN spirit_submissions s ON s.id=v.submission_id WHERE s.challenge_id=? AND s.user_id=?").bind(submissionInfo.challenge_id,submissionInfo.user_id).first();
      return json({ok:true,voted:false,votes:count?.total||0});
    }
    return json({error:"Ruta de Espíritu Navideño no encontrada."},404);
  }

  if (url.pathname === "/api/activity/heartbeat" && request.method === "POST") {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión primero." }, 401);
    const membership=await getParticipantEdition(env,user,url);
    if (!membership) return json({ ok: true, tracked: false });
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS app_activity (edition_id TEXT NOT NULL, user_id TEXT NOT NULL, last_seen_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(edition_id,user_id))").run();
    const previousActivity=await env.DB.prepare("SELECT last_seen_at FROM app_activity WHERE edition_id=? AND user_id=?").bind(membership.edition_id,user.id).first();
    if(previousActivity?.last_seen_at){
      const idle=await env.DB.prepare("SELECT CASE WHEN datetime(?)<=datetime('now','-1 day') THEN 1 ELSE 0 END AS eligible").bind(previousActivity.last_seen_at).first();
      if(Number(idle?.eligible)===1){
        await ensureSpiritSchema(env);
        await env.DB.prepare("INSERT OR IGNORE INTO spirit_points (id,edition_id,user_id,source_type,source_id,points,description) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),membership.edition_id,user.id,"achievement","son_webadas",20,"Logro desbloqueado: Son Webadas").run();
      }
    }
    await env.DB.prepare("INSERT INTO app_activity (edition_id,user_id,last_seen_at) VALUES (?,?,datetime('now')) ON CONFLICT(edition_id,user_id) DO UPDATE SET last_seen_at=datetime('now')").bind(membership.edition_id,user.id).run();
    return json({ ok: true, tracked: true });
  }

  if (url.pathname.startsWith("/api/admin/")) {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión con Google primero." }, 401);
    if (!(await isPrimaryAdmin(user, env))) return json({ error: "Esta cuenta no es el administrador principal." }, 403);

    const adminSpiritDeleteMatch=url.pathname.match(/^\/api\/admin\/spirit\/submissions\/([A-Za-z0-9-]+)$/);
    if(request.method==="DELETE"&&adminSpiritDeleteMatch){
      const edition=await getAdminEdition(env,url);
      if(!edition)return json({error:"No hay una edición configurada."},404);
      await ensureSpiritSchema(env);
      const submission=await env.DB.prepare("SELECT id,challenge_id,user_id FROM spirit_submissions WHERE id=? AND edition_id=?").bind(adminSpiritDeleteMatch[1],edition.id).first();
      if(!submission)return json({error:"La publicación no existe en este intercambio o ya fue eliminada."},404);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM spirit_points WHERE edition_id=? AND source_id=? AND source_type IN ('submission','community_bonus')").bind(edition.id,submission.id),
        env.DB.prepare("DELETE FROM spirit_points WHERE edition_id=? AND source_type='like' AND source_id IN (SELECT id FROM spirit_votes WHERE submission_id=?)").bind(edition.id,submission.id),
        env.DB.prepare("DELETE FROM spirit_comments WHERE submission_id=? AND edition_id=?").bind(submission.id,edition.id),
        env.DB.prepare("DELETE FROM spirit_votes WHERE submission_id=?").bind(submission.id),
        env.DB.prepare("DELETE FROM spirit_submissions WHERE id=? AND edition_id=?").bind(submission.id,edition.id),
        env.DB.prepare("DELETE FROM spirit_points WHERE edition_id=? AND source_type='like' AND source_id IN (SELECT v.id FROM spirit_votes v JOIN spirit_submissions s ON s.id=v.submission_id WHERE s.challenge_id=? AND s.user_id=?)").bind(edition.id,submission.challenge_id,submission.user_id),
        env.DB.prepare("INSERT OR IGNORE INTO spirit_points (id,edition_id,user_id,source_type,source_id,points,description) SELECT lower(hex(randomblob(16))),s.edition_id,s.user_id,'like',v.id,1,'Me gusta recibido' FROM spirit_votes v JOIN spirit_submissions s ON s.id=v.submission_id WHERE s.challenge_id=? AND s.user_id=? ORDER BY v.created_at,v.id LIMIT 10").bind(submission.challenge_id,submission.user_id)
      ]);
      return json({ok:true,message:"Publicación eliminada. Se retiraron sus comentarios, votos y puntos, y se recalculó la puntuación."});
    }


    if(url.pathname==="/api/admin/spirit/bonus"&&request.method==="GET"){
      const edition=await getAdminEdition(env,url);if(!edition)return json({active:null,submissions:[]});
      await ensureSpiritSchema(env);
      await ensureParticipantProfilesSchema(env);
      await env.DB.prepare("UPDATE spirit_challenges AS extra SET ends_at=datetime('now') WHERE extra.edition_id=? AND extra.challenge_kind='extra' AND extra.starts_at<=datetime('now') AND extra.ends_at>datetime('now') AND EXISTS (SELECT 1 FROM spirit_challenges daily WHERE daily.edition_id=extra.edition_id AND daily.challenge_kind='daily' AND (lower(trim(daily.title))=lower(trim(extra.title)) OR lower(trim(daily.description))=lower(trim(extra.description))))").bind(edition.id).run();
      const active=await env.DB.prepare("SELECT id,title,description,challenge_type,starts_at,ends_at FROM spirit_challenges WHERE edition_id=? AND challenge_kind='extra' AND starts_at<=datetime('now') AND ends_at>datetime('now') ORDER BY starts_at DESC LIMIT 1").bind(edition.id).first();
      const submissions=await env.DB.prepare("SELECT x.id,x.user_id,x.caption,x.media_type,x.status,x.created_at,x.challenge_id,c.title AS challenge_title,COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS display_name FROM spirit_extra_submissions x JOIN users u ON u.id=x.user_id JOIN spirit_challenges c ON c.id=x.challenge_id LEFT JOIN participant_profiles p ON p.user_id=x.user_id WHERE x.edition_id=? AND (x.status='pending' OR x.created_at>=datetime('now','-30 days')) ORDER BY CASE x.status WHEN 'pending' THEN 0 ELSE 1 END,x.created_at DESC LIMIT 100").bind(edition.id).all();
      return json({active:active||null,submissions:submissions.results||[]});
    }
    if(url.pathname==="/api/admin/spirit/bonus/activate"&&request.method==="POST"){
      const edition=await getAdminEdition(env,url);if(!edition)return json({error:"No hay una edición configurada."},404);
      await ensureSpiritSchema(env);
      await env.DB.prepare("UPDATE spirit_challenges AS extra SET ends_at=datetime('now') WHERE extra.edition_id=? AND extra.challenge_kind='extra' AND extra.starts_at<=datetime('now') AND extra.ends_at>datetime('now') AND EXISTS (SELECT 1 FROM spirit_challenges daily WHERE daily.edition_id=extra.edition_id AND daily.challenge_kind='daily' AND (lower(trim(daily.title))=lower(trim(extra.title)) OR lower(trim(daily.description))=lower(trim(extra.description))))").bind(edition.id).run();
      const active=await env.DB.prepare("SELECT id FROM spirit_challenges WHERE edition_id=? AND challenge_kind='extra' AND starts_at<=datetime('now') AND ends_at>datetime('now') LIMIT 1").bind(edition.id).first();
      if(active)return json({error:"Ya hay un reto bonus activo."},409);
      const catalog=[["navidad-foto-01","Postal navideña viviente","Recrea una postal navideña con objetos que tengas a mano y comparte una foto.","photo"],["navidad-foto-02","El árbol inesperado","Fotografía un árbol navideño hecho con materiales poco comunes.","photo"],["navidad-foto-03","Un detalle rojo","Comparte una foto donde el color rojo sea el protagonista navideño.","photo"],["navidad-foto-04","Navidad en miniatura","Crea una escena navideña pequeña y fotografíala.","photo"],["navidad-foto-05","El regalo misterioso","Envuelve un objeto cotidiano y comparte una foto sin revelar qué es.","photo"],["navidad-audio-01","Locutor de Navidad","Graba un saludo navideño como locutor de radio, máximo 30 segundos.","voice"],["navidad-audio-02","Risa de duende","Graba tu mejor risa de duende navideño, máximo 15 segundos.","voice"],["navidad-audio-03","Tráiler navideño","Narra el avance de una película navideña inventada, máximo 30 segundos.","voice"],["navidad-audio-04","Reno reportero","Graba un reporte divertido desde el taller de Santa, máximo 30 segundos.","voice"],["navidad-audio-05","Villancico express","Tararea un villancico durante 15 segundos.","voice"],["navidad-texto-01","Titular de última hora","Escribe un titular gracioso sobre la llegada de la Navidad al equipo.","text"],["navidad-texto-02","Manual del duende","Escribe una regla absurda que todo duende debería cumplir.","text"],["navidad-texto-03","Mi deseo en seis palabras","Comparte un deseo navideño usando exactamente seis palabras.","text"],["navidad-texto-04","El regalo imposible","Describe el regalo más absurdo que podría recibir Santa.","text"],["navidad-texto-05","Un superpoder festivo","Inventa un superpoder que solo funcione en Navidad.","text"],["navidad-texto-06","Excusa del reno","Escribe la excusa más creativa de un reno que llegó tarde.","text"],["navidad-trivia-01","Trivia del trineo","¿Cuántos renos tiran tradicionalmente del trineo contando a Rudolph? Responde correctamente.","trivia"],["navidad-trivia-02","Trivia cinematográfica","¿Cómo se llama el niño protagonista de Mi pobre angelito? Responde correctamente.","trivia"],["navidad-trivia-03","Trivia del Grinch","¿Qué quería robar el Grinch? Responde correctamente.","trivia"],["navidad-trivia-04","Trivia de Rudolph","¿De qué color es la nariz de Rudolph? Responde correctamente.","trivia"]];
      const [used,dailyChallenges]=await Promise.all([env.DB.prepare("SELECT bonus_key FROM spirit_bonus_history WHERE edition_id=?").bind(edition.id).all(),env.DB.prepare("SELECT title,description FROM spirit_challenges WHERE edition_id=? AND challenge_kind='daily'").bind(edition.id).all()]);
      const usedKeys=new Set((used.results||[]).map(x=>x.bonus_key)),dailyTitles=new Set((dailyChallenges.results||[]).map(x=>String(x.title||'').trim().toLocaleLowerCase('es'))),dailyDescriptions=new Set((dailyChallenges.results||[]).map(x=>String(x.description||'').trim().toLocaleLowerCase('es'))),available=catalog.filter(x=>!usedKeys.has(x[0])&&!dailyTitles.has(x[1].trim().toLocaleLowerCase('es'))&&!dailyDescriptions.has(x[2].trim().toLocaleLowerCase('es')));
      if(!available.length)return json({error:"Se agotó el catálogo único de retos bonus. Ninguno se repetirá."},409);
      const item=available[Math.floor(Math.random()*available.length)],now=new Date(),end=new Date(now.getTime()+24*60*60*1000),startSql=now.toISOString().slice(0,19).replace("T"," "),endSql=end.toISOString().slice(0,19).replace("T"," "),id=crypto.randomUUID();
      await env.DB.prepare("INSERT INTO spirit_challenges (id,edition_id,title,description,points,bonus_points,challenge_type,starts_at,ends_at,created_by,challenge_kind) VALUES (?,?,?,?,10,0,?,?,?,?, 'extra')").bind(id,edition.id,item[1],item[2],item[3],startSql,endSql,user.id).run();
      const reservation=await env.DB.prepare("INSERT OR IGNORE INTO spirit_bonus_history (edition_id,bonus_key,challenge_id) VALUES (?,?,?)").bind(edition.id,item[0],id).run();
      if(!reservation.meta?.changes){await env.DB.prepare("DELETE FROM spirit_challenges WHERE id=?").bind(id).run();return json({error:"El reto ya fue reservado. Vuelve a intentar."},409);}
      return json({ok:true,title:item[1],points:10,endsAt:endSql});
    }
    const bonusMediaMatch=url.pathname.match(/^\/api\/admin\/spirit\/bonus\/media\/([A-Za-z0-9-]+)$/);
    if(bonusMediaMatch&&request.method==="GET"){
      const edition=await getAdminEdition(env,url);if(!edition)return json({error:"No hay una edición configurada."},404);
      await ensureSpiritSchema(env);
      const media=await env.DB.prepare("SELECT media_data,media_type FROM spirit_extra_submissions WHERE id=? AND edition_id=?").bind(bonusMediaMatch[1],edition.id).first();
      if(!media?.media_data)return json({error:"Esta evidencia no tiene un archivo adjunto."},404);
      return dataUrlResponse(media.media_data,media.media_type||"application/octet-stream",request);
    }
    if(url.pathname.startsWith("/api/admin/spirit/bonus/submissions/")&&request.method==="PATCH"){
      const edition=await getAdminEdition(env,url);if(!edition)return json({error:"No hay una edición configurada."},404);
      await ensureSpiritSchema(env);
      const id=url.pathname.split("/").pop(),body=await request.json(),status=String(body.status||"");
      if(!["approved","rejected"].includes(status))return json({error:"Estado de revisión no válido."},400);
      const submission=await env.DB.prepare("SELECT id,user_id,status FROM spirit_extra_submissions WHERE id=? AND edition_id=?").bind(id,edition.id).first();
      if(!submission)return json({error:"No encontramos esa participación."},404);
      if(submission.status!=="pending")return json({error:"Esta participación ya fue revisada."},409);
      const changed=await env.DB.prepare("UPDATE spirit_extra_submissions SET status=?,reviewed_at=datetime('now'),reviewed_by=? WHERE id=? AND status='pending'").bind(status,user.id,id).run();
      if(!changed.meta?.changes)return json({error:"Esta participación ya fue revisada."},409);
      if(status==="approved")await env.DB.prepare("INSERT OR IGNORE INTO spirit_points (id,edition_id,user_id,source_type,source_id,points,description) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),edition.id,submission.user_id,"bonus_approved",id,10,"Reto bonus aprobado").run();
      try {
        await sendPushToUser(env,submission.user_id,{title:status==="approved"?"🎁 ¡Bonus aprobado!":"Reto bonus revisado",body:status==="approved"?"Tu participación fue aprobada y recibiste 10 puntos extra.":"Tu evidencia fue revisada y no recibió puntos.",tag:"spirit-bonus-"+id,url:"/?tab=spirit"},url.origin);
      } catch(error) {
        console.error("Bonus review push notification failed",{submissionId:id,message:error?.message||String(error)});
      }
      return json({ok:true,status,points:status==="approved"?10:0,notificationAttempted:true});
    }
    if (url.pathname === "/api/admin/spirit/activities") {
      const edition = await getAdminEdition(env, url);
      if (!edition) return json({ error: "No hay una edición configurada." }, 404);
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS spirit_activity_settings (edition_id TEXT PRIMARY KEY REFERENCES editions(id) ON DELETE CASCADE, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
    try { await env.DB.prepare("ALTER TABLE spirit_activity_settings ADD COLUMN manual_override INTEGER NOT NULL DEFAULT 0").run(); } catch {}
      if (request.method === "GET") {
        const row = await env.DB.prepare("SELECT manual_override,updated_at FROM spirit_activity_settings WHERE edition_id=?").bind(edition.id).first();
        return json({ manualOverride: Number(row?.manual_override || 0) === 1, updatedAt: row?.updated_at || null });
      }
      if (request.method === "PATCH") {
        const body = await request.json();
        if (typeof body.manualOverride !== "boolean") return json({ error: "Indica si deseas activar manualmente o volver al horario automático." }, 400);
        await env.DB.prepare("INSERT INTO spirit_activity_settings (edition_id,enabled,manual_override,updated_at) VALUES (?,1,?,datetime('now')) ON CONFLICT(edition_id) DO UPDATE SET manual_override=excluded.manual_override,updated_at=datetime('now')").bind(edition.id, body.manualOverride ? 1 : 0).run();
        return json({ ok: true, manualOverride: body.manualOverride });
      }
      return json({ error: "Método no permitido." }, 405);
    }

    if (request.method === "GET" && url.pathname === "/api/admin/edition/home") {
      const edition=await getAdminEdition(env,url);if(!edition)return json({error:"No hay una edición configurada."},404);
      await ensureEditionHomeSettingsSchema(env);const row=await env.DB.prepare("SELECT config_json FROM edition_home_settings WHERE edition_id=?").bind(edition.id).first();
      let config={};try{config=JSON.parse(row?.config_json||"{}");}catch{}return json({config,edition});
    }
    if (request.method === "PATCH" && url.pathname === "/api/admin/edition/home") {
      const edition=await getAdminEdition(env,url);if(!edition)return json({error:"No hay una edición configurada."},404);
      if(edition.status!=="registration")return json({error:"La información se bloquea después del sorteo."},409);
      const body=await request.json(),keys=["placeName","address","schedule","breakfast","grillFee","extraInfo","mapUrl","shareMessage","welcomeText"],flags=["showDate","showPlace","showAddress","showSchedule","showBreakfast","showGrillFee","showExtraInfo","showMap"],config={};
      for(const key of keys)config[key]=String(body[key]||"").trim().slice(0,key==="extraInfo"||key==="shareMessage"?1500:300);
      for(const key of flags)config[key]=body[key]!==false;
      await ensureEditionHomeSettingsSchema(env);
      await env.DB.prepare("INSERT INTO edition_home_settings (edition_id,config_json) VALUES (?,?) ON CONFLICT(edition_id) DO UPDATE SET config_json=excluded.config_json,updated_at=datetime('now')").bind(edition.id,JSON.stringify(config)).run();
      return json({ok:true,config});
    }
    if (request.method === "GET" && url.pathname === "/api/admin/editions") {
      const result = await env.DB.prepare("SELECT e.id, e.title, e.year, e.budget_amount, e.currency, e.event_date, e.status, w.name AS team_name, (SELECT COUNT(*) FROM edition_members em WHERE em.edition_id=e.id AND em.status='confirmed') AS participants FROM editions e JOIN workspace w ON w.id=e.workspace_id ORDER BY e.created_at ASC").all();
      return json({ editions: result.results || [] });
    }
    if (request.method === "POST" && url.pathname === "/api/admin/editions") {
      const body = await request.json();
      const teamName = String(body.teamName || "").trim();
      if (!["Cliente 360", "Onboarding Digital"].includes(teamName)) return json({ error: "Equipo no válido." }, 400);
      const existing = await env.DB.prepare("SELECT e.id FROM editions e JOIN workspace w ON w.id=e.workspace_id WHERE w.name=? AND e.year=?").bind(teamName, Number(body.year || 2026)).first();
      if (existing) return json({ error: "Este equipo ya tiene un intercambio configurado." }, 409);
      const year = Number(body.year || 2026), budget = body.budgetAmount === "" || body.budgetAmount == null ? null : Number(body.budgetAmount);
      if (!Number.isInteger(year) || year < 2026 || (budget !== null && (!Number.isFinite(budget) || budget < 0))) return json({ error: "Año o presupuesto inválido." }, 400);
      const workspaceId = crypto.randomUUID(), editionId = crypto.randomUUID(), membershipId = crypto.randomUUID();
      const title = String(body.title || ("Navidad " + teamName + " " + year)).slice(0, 100);
      await env.DB.batch([
        env.DB.prepare("INSERT INTO workspace (id,name,owner_user_id) VALUES (?,?,?)").bind(workspaceId,teamName,user.id),
        env.DB.prepare("INSERT INTO memberships (id,workspace_id,user_id,role) VALUES (?,?,?,'owner')").bind(membershipId,workspaceId,user.id),
        env.DB.prepare("INSERT INTO editions (id,workspace_id,title,year,budget_amount,event_date,status) VALUES (?,?,?,?,?,?,'registration')").bind(editionId,workspaceId,title,year,budget,body.eventDate || null)
      ]);
      return json({ ok: true, edition: { id: editionId, title, year, teamName } }, 201);
    }
    if (request.method === "GET" && url.pathname === "/api/admin/secret-messages") {
      const edition=await getAdminEdition(env,url);
      if(!edition)return json({error:"No hay una edición configurada."},404);
      await ensureCommunitySchema(env);
      await ensureParticipantProfilesSchema(env);
      const [chat,clues]=await Promise.all([
        env.DB.prepare("SELECT m.id,m.message,m.created_at,m.run_number,'chat' AS message_type,m.sender_user_id,m.recipient_user_id,COALESCE(NULLIF(TRIM(COALESCE(ps.first_name,'') || ' ' || COALESCE(ps.last_name,'')),''),us.display_name) AS sender_name,COALESCE(NULLIF(TRIM(COALESCE(pr.first_name,'') || ' ' || COALESCE(pr.last_name,'')),''),ur.display_name) AS recipient_name FROM anonymous_chat_messages m JOIN users us ON us.id=m.sender_user_id JOIN users ur ON ur.id=m.recipient_user_id LEFT JOIN participant_profiles ps ON ps.user_id=m.sender_user_id LEFT JOIN participant_profiles pr ON pr.user_id=m.recipient_user_id WHERE m.edition_id=? ORDER BY m.created_at DESC LIMIT 500").bind(edition.id).all(),
        env.DB.prepare("SELECT c.id,c.message,c.created_at,c.run_number,'clue' AS message_type,c.giver_user_id AS sender_user_id,c.recipient_user_id,COALESCE(NULLIF(TRIM(COALESCE(ps.first_name,'') || ' ' || COALESCE(ps.last_name,'')),''),us.display_name) AS sender_name,COALESCE(NULLIF(TRIM(COALESCE(pr.first_name,'') || ' ' || COALESCE(pr.last_name,'')),''),ur.display_name) AS recipient_name FROM anonymous_clues c JOIN users us ON us.id=c.giver_user_id JOIN users ur ON ur.id=c.recipient_user_id LEFT JOIN participant_profiles ps ON ps.user_id=c.giver_user_id LEFT JOIN participant_profiles pr ON pr.user_id=c.recipient_user_id WHERE c.edition_id=? ORDER BY c.created_at DESC LIMIT 500").bind(edition.id).all()
      ]);
      const messages=[...(chat.results||[]),...(clues.results||[])].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,500);
      return json({messages,total:messages.length,edition:{id:edition.id,title:edition.title}});
    }
    if (request.method === "GET" && url.pathname === "/api/admin/activity") {
      const edition = await getAdminEdition(env, url);
      if (!edition) return json({ activeNow: 0, activeToday: 0, activeWeek: 0, participants: 0, recent: [] });
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS app_activity (edition_id TEXT NOT NULL, user_id TEXT NOT NULL, last_seen_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(edition_id,user_id))").run();
      await Promise.all([ensureWishesSchema(env),ensureCommunitySchema(env)]);
      const [activeNow,activeToday,activeWeek,participants,recent] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS total FROM app_activity WHERE edition_id=? AND last_seen_at>=datetime('now','-5 minutes')").bind(edition.id).first(),
        env.DB.prepare("SELECT COUNT(*) AS total FROM app_activity WHERE edition_id=? AND date(last_seen_at)=date('now')").bind(edition.id).first(),
        env.DB.prepare("SELECT COUNT(*) AS total FROM app_activity WHERE edition_id=? AND last_seen_at>=datetime('now','-7 days')").bind(edition.id).first(),
        env.DB.prepare("SELECT COUNT(*) AS total FROM edition_members WHERE edition_id=? AND status='confirmed'").bind(edition.id).first(),
        env.DB.prepare("SELECT a.last_seen_at,u.avatar_url,COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS display_name,CASE WHEN a.last_seen_at>=datetime('now','-5 minutes') THEN 1 ELSE 0 END AS is_active FROM app_activity a JOIN users u ON u.id=a.user_id LEFT JOIN participant_profiles p ON p.user_id=u.id WHERE a.edition_id=? ORDER BY a.last_seen_at DESC LIMIT 20").bind(edition.id).all()
      ]);
      const participation=await env.DB.prepare("SELECT em.user_id,COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')),''),u.display_name) AS display_name,u.avatar_url,COALESCE(w.wish_count,0) AS wish_count,w.last_wish_at,COALESCE(c.message_count,0) AS message_count,c.last_message_at FROM edition_members em JOIN users u ON u.id=em.user_id LEFT JOIN participant_profiles p ON p.user_id=em.user_id LEFT JOIN (SELECT user_id,COUNT(*) AS wish_count,MAX(updated_at) AS last_wish_at FROM participant_wishes WHERE edition_id=? GROUP BY user_id) w ON w.user_id=em.user_id LEFT JOIN (SELECT giver_user_id,COUNT(*) AS message_count,MAX(created_at) AS last_message_at FROM anonymous_clues WHERE edition_id=? GROUP BY giver_user_id) c ON c.giver_user_id=em.user_id WHERE em.edition_id=? AND em.status='confirmed' ORDER BY display_name COLLATE NOCASE").bind(edition.id,edition.id,edition.id).all();
      return json({ activeNow: activeNow?.total||0, activeToday: activeToday?.total||0, activeWeek: activeWeek?.total||0, participants: participants?.total||0, recent: (recent.results||[]).map(row=>({...row,last_seen_label:row.last_seen_at})), participation: participation.results||[] });
    }


    if (url.pathname === "/api/admin/spirit/challenges" && request.method === "GET") {
      await ensureSpiritSchema(env);
      const edition=await getAdminEdition(env, url);
      if(!edition)return json({active:null});
      await env.DB.prepare("DELETE FROM spirit_challenges WHERE edition_id=? AND id LIKE 'seed-%' AND starts_at>datetime('now') AND NOT EXISTS (SELECT 1 FROM spirit_submissions s WHERE s.challenge_id=spirit_challenges.id)").bind(edition.id).run();
      const active=await env.DB.prepare("SELECT id,title,challenge_type,starts_at,ends_at FROM spirit_challenges WHERE edition_id=? AND starts_at<=datetime('now') AND ends_at>datetime('now') ORDER BY starts_at DESC LIMIT 1").bind(edition.id).first();
      const scheduled=await env.DB.prepare("SELECT id,title,challenge_type,starts_at,ends_at FROM spirit_challenges WHERE edition_id=? AND starts_at>datetime('now') ORDER BY starts_at LIMIT 10").bind(edition.id).all();
      return json({active:active||null,scheduled:scheduled.results||[]});
    }
    if (url.pathname === "/api/admin/spirit/challenges" && request.method === "POST") {
      await ensureSpiritSchema(env);
      const edition = await getAdminEdition(env, url);
      if(!edition)return json({error:"No hay una edición configurada."},404);
      const body=await request.json(),title=String(body.title||"").trim(),description=String(body.description||"").trim(),type=String(body.challengeType||"text"),kind=body.challengeKind==="extra"?"extra":"daily";
      const points=Number(body.points||10),bonus=Number(body.bonusPoints||5),config=body.config&&typeof body.config==="object"?body.config:{};
      if(!["text","photo","voice","trivia"].includes(type))return json({error:"Tipo de reto no válido."},400);
      if(title.length<3||title.length>80||description.length<5||description.length>300)return json({error:"Completa un título y una descripción válidos."},400);
      if(!Number.isInteger(points)||points<1||points>100||!Number.isInteger(bonus)||bonus<1||bonus>50)return json({error:"Los puntos deben estar dentro de los límites permitidos."},400);
      if(type==="trivia"&&(!String(config.question||"").trim()||!Array.isArray(config.options)||config.options.length<2||!config.options.includes(config.correctAnswer)))return json({error:"Configura una pregunta, sus opciones y la respuesta correcta."},400);
      const scheduledDate=String(body.scheduledDate||"");
      if(!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate))return json({error:"Selecciona la fecha en que debe abrirse el reto."},400);
      const start=new Date(scheduledDate+"T23:00:00.000Z"),end=new Date(start.getTime()+12*60*60*1000);
      if(!Number.isFinite(start.getTime())||start.getTime()<=Date.now())return json({error:"Elige una fecha futura. Los retos abren a las 6:00 p. m. y cierran a las 6:00 a. m. del día siguiente (hora Perú)."},400);
      const startSql=start.toISOString().slice(0,19).replace("T"," "),endSql=end.toISOString().slice(0,19).replace("T"," ");
      const overlap=await env.DB.prepare("SELECT id FROM spirit_challenges WHERE edition_id=? AND challenge_kind=? AND starts_at<? AND ends_at>? LIMIT 1").bind(edition.id,kind,endSql,startSql).first();
      if(overlap)return json({error:"Ya existe un reto programado para ese día."},409);
      const id=crypto.randomUUID();
      await env.DB.prepare("INSERT INTO spirit_challenges (id,edition_id,title,description,points,bonus_points,challenge_type,config_json,starts_at,ends_at,created_by,challenge_kind) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,edition.id,title,description,kind==="extra"?3:points,kind==="extra"?0:bonus,type,JSON.stringify(config),startSql,endSql,user.id,kind).run();
      return json({ok:true,id,startsAt:startSql,endsAt:endSql});
    }

    if (request.method === "POST" && url.pathname === "/api/admin/spirit/reset-my-points") {
      const member=await getParticipantEdition(env,user,url);
      if(!member)return json({error:"No tienes una edición activa."},403);
      await ensureSpiritSchema(env);
      const result=await env.DB.prepare("DELETE FROM spirit_points WHERE edition_id=? AND user_id=?").bind(member.edition_id,user.id).run();
      return json({ok:true,deleted:result.meta?.changes||0});
    }

    if (request.method === "PATCH" && url.pathname === "/api/admin/edition") {
      const body = await request.json();
      const edition = await getAdminEdition(env, url);
      if (!edition) return json({ error: "No hay una edición configurada." }, 404);
      if (edition.status !== "registration") return json({ error: "Los ajustes están bloqueados porque el sorteo ya fue realizado o la edición terminó." }, 409);
      const title = String(body.title || "").trim();
      const eventDate = body.eventDate ? String(body.eventDate) : null;
      const budget = body.budgetAmount === "" || body.budgetAmount == null ? null : Number(body.budgetAmount);
      if (title.length < 3 || title.length > 100) return json({ error: "El nombre debe tener entre 3 y 100 caracteres." }, 400);
            if (eventDate && (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !Number.isFinite(Date.parse(eventDate+"T00:00:00Z")) || new Date(eventDate+"T00:00:00Z").toISOString().slice(0,10)!==eventDate)) return json({ error: "La fecha del intercambio no es válida. Selecciona una fecha válida." }, 400);
      if (budget !== null && (!Number.isFinite(budget) || budget < 0 || budget > 1000000)) return json({ error: "El presupuesto debe ser un monto válido." }, 400);
      await env.DB.prepare("UPDATE editions SET title=?, event_date=?, budget_amount=? WHERE id=?").bind(title, eventDate, budget, edition.id).run();
      return json({ ok: true });
    }
    if (url.pathname.startsWith("/api/admin/draw/")) {
      await ensureDrawSchema(env);
      const edition = await getAdminEdition(env, url);
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
        await env.DB.prepare("CREATE TABLE IF NOT EXISTS anonymous_chat_messages (id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, run_number INTEGER NOT NULL, sender_user_id TEXT NOT NULL REFERENCES users(id), recipient_user_id TEXT NOT NULL REFERENCES users(id), message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
        await env.DB.batch([
          env.DB.prepare("DELETE FROM anonymous_clues WHERE edition_id=?").bind(edition.id),
          env.DB.prepare("DELETE FROM anonymous_chat_messages WHERE edition_id=?").bind(edition.id),
          env.DB.prepare("DELETE FROM draw_assignments WHERE edition_id=?").bind(edition.id),
          env.DB.prepare("UPDATE draw_runs SET status='superseded' WHERE edition_id=? AND status='completed'").bind(edition.id),
          env.DB.prepare("INSERT INTO edition_draw_state (edition_id, state, ready_at, drawn_at, updated_at) VALUES (?, 'registration', NULL, NULL, datetime('now')) ON CONFLICT(edition_id) DO UPDATE SET state='registration', ready_at=NULL, drawn_at=NULL, updated_at=datetime('now')").bind(edition.id),
          env.DB.prepare("UPDATE editions SET status='registration' WHERE id=?").bind(edition.id)
        ]);
        return json({ ok: true, state: "registration", message: "Asignaciones anteriores eliminadas. Los demás datos e historiales se conservaron." });
      }
    }

    if (request.method === "GET" && url.pathname === "/api/admin/status") {
      const edition = await getAdminEdition(env, url);
      const members = edition ? await env.DB.prepare("SELECT COUNT(*) AS total FROM edition_members WHERE edition_id = ? AND status = 'confirmed'").bind(edition.id).first() : { total: 0 };
      return json({ isPrimaryAdmin: true, email: user.email, initialized: !!edition, edition, participants: members.total || 0 });
    }
    if (request.method === "GET" && url.pathname === "/api/admin/participants") {
      const edition = await getAdminEdition(env, url);
      if (!edition) return json({ participants: [] });
      const result = await env.DB.prepare("SELECT em.user_id, COALESCE(NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''), u.display_name) AS display_name, u.email, u.avatar_url, em.status, em.joined_at FROM edition_members em JOIN users u ON u.id=em.user_id LEFT JOIN participant_profiles p ON p.user_id=em.user_id WHERE em.edition_id=? AND em.status IN ('confirmed','inactive') ORDER BY CASE em.status WHEN 'confirmed' THEN 0 ELSE 1 END, em.joined_at ASC").bind(edition.id).all();
      return json({ participants: result.results || [] });
    }
    if (request.method === "PATCH" && url.pathname.startsWith("/api/admin/participants/")) {
      const userId = decodeURIComponent(url.pathname.split("/").pop());
      const body = await request.json();
      const edition = await getAdminEdition(env, url);
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
      const edition = await getAdminEdition(env, url);
      if (!edition) return json({ exclusions: [] });
      const result = await env.DB.prepare("SELECT x.id, x.user_a_id, x.user_b_id, a.display_name AS user_a_name, b.display_name AS user_b_name FROM edition_exclusions x JOIN users a ON a.id=x.user_a_id JOIN users b ON b.id=x.user_b_id WHERE x.edition_id=? ORDER BY x.created_at DESC").bind(edition.id).all();
      return json({ exclusions: result.results || [] });
    }
    if (request.method === "POST" && url.pathname === "/api/admin/exclusions") {
      const body = await request.json();
      const edition = await getAdminEdition(env, url);
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
      const edition = body.editionId ? await env.DB.prepare("SELECT id FROM editions WHERE id=?").bind(body.editionId).first() : await getAdminEdition(env, url);
      if (!edition) return json({ error: "Selecciona una edición válida." }, 409);
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
    const member=await getParticipantEdition(env,user,url);
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
    if (request.method === "GET" && url.pathname === "/api/community/chats") {
      const draw=await env.DB.prepare("SELECT state FROM edition_draw_state WHERE edition_id=?").bind(member.edition_id).first();
      if(draw?.state!=="drawn")return json({state:draw?.state||"registration",outgoing:null,incoming:null});
      const outgoing=await env.DB.prepare("SELECT recipient_user_id AS partner,run_number FROM draw_assignments WHERE edition_id=? AND giver_user_id=? ORDER BY run_number DESC LIMIT 1").bind(member.edition_id,user.id).first();
      const incoming=await env.DB.prepare("SELECT giver_user_id AS partner,run_number FROM draw_assignments WHERE edition_id=? AND recipient_user_id=? ORDER BY run_number DESC LIMIT 1").bind(member.edition_id,user.id).first();
      const loadThread=async(a)=>{if(!a)return null;const [modern,legacy]=await Promise.all([
        env.DB.prepare("SELECT id,message,created_at,sender_user_id=? AS mine FROM anonymous_chat_messages WHERE edition_id=? AND run_number=? AND ((sender_user_id=? AND recipient_user_id=?) OR (sender_user_id=? AND recipient_user_id=?)) ORDER BY created_at ASC LIMIT 100").bind(user.id,member.edition_id,a.run_number,user.id,a.partner,a.partner,user.id).all(),
        env.DB.prepare("SELECT id,message,created_at,giver_user_id=? AS mine FROM anonymous_clues WHERE edition_id=? AND run_number=? AND ((giver_user_id=? AND recipient_user_id=?) OR (giver_user_id=? AND recipient_user_id=?)) ORDER BY created_at ASC LIMIT 100").bind(user.id,member.edition_id,a.run_number,user.id,a.partner,a.partner,user.id).all()
      ]);return [...(modern.results||[]),...(legacy.results||[]).map(x=>({...x,id:"legacy-"+x.id}))].sort((x,y)=>String(x.created_at).localeCompare(String(y.created_at))).slice(-100);};
      const [outMessages,inMessages]=await Promise.all([loadThread(outgoing),loadThread(incoming)]);
      return json({state:"drawn",outgoing:outgoing?{messages:outMessages||[]}:null,incoming:incoming?{messages:inMessages||[]}:null});
    }
    if (request.method === "POST" && url.pathname === "/api/community/chats") {
      const body=await request.json(),message=String(body.message||"").trim(),thread=String(body.thread||"");
      const unsafeMessage=rejectUnsafePayload(message);if(unsafeMessage)return unsafeMessage;
      if(!message||message.length>500)return json({error:"El mensaje debe tener entre 1 y 500 caracteres."},400);
      if(thread!=="outgoing"&&thread!=="incoming")return json({error:"Conversación no válida."},400);
      const draw=await env.DB.prepare("SELECT state FROM edition_draw_state WHERE edition_id=?").bind(member.edition_id).first();
      if(draw?.state!=="drawn")return json({error:"El chat estará disponible después del sorteo."},409);
      const assignment=thread==="outgoing"
        ? await env.DB.prepare("SELECT recipient_user_id AS partner,run_number FROM draw_assignments WHERE edition_id=? AND giver_user_id=? ORDER BY run_number DESC LIMIT 1").bind(member.edition_id,user.id).first()
        : await env.DB.prepare("SELECT giver_user_id AS partner,run_number FROM draw_assignments WHERE edition_id=? AND recipient_user_id=? ORDER BY run_number DESC LIMIT 1").bind(member.edition_id,user.id).first();
      if(!assignment)return json({error:"No encontramos la asignación de esta conversación."},409);
      const id=crypto.randomUUID();
      await env.DB.prepare("INSERT INTO anonymous_chat_messages (id,edition_id,run_number,sender_user_id,recipient_user_id,message) VALUES (?,?,?,?,?,?)").bind(id,member.edition_id,assignment.run_number,user.id,assignment.partner,message).run();
      await sendPushToUser(env,assignment.partner,{title:"💌 Nuevo mensaje de tu amigo secreto",body:message.slice(0,100),url:"/?tab=community",tag:"secret-chat-"+id},url.origin);
      return json({ok:true,id});
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
      const unsafeClue=rejectUnsafePayload(message);if(unsafeClue)return unsafeClue;
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
    const membership=await getParticipantEdition(env,user,url);
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
    const membership=await getParticipantEdition(env,participant,url);
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
    const membership=await getParticipantEdition(env,participant,url);
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
    const editionMember=await getParticipantEdition(env,user,url);
    const edition=editionMember?await env.DB.prepare("SELECT id,status FROM editions WHERE id=?").bind(editionMember.edition_id).first():null;
    if (!edition) return json({ error: "No hay una edición activa." }, 404);
    if (edition.status === "drawn" || edition.status === "completed") return json({ error: "El sorteo ya se realizó o la edición terminó. Contacta al organizador." }, 409);
    const result = await env.DB.prepare("DELETE FROM edition_members WHERE edition_id=? AND user_id=?").bind(edition.id, user.id).run();
    if (!result.meta.changes) return json({ error: "No tienes una participación activa." }, 409);
    return json({ ok: true, removed: true });
  }
  if (request.method === "POST" && url.pathname === "/api/participation/rejoin") {
    return json({ error: "Para volver a participar necesitas una nueva invitación del organizador." }, 409);
  }
  const profileAvatarPrefix="/api/profile/avatar/";
  const profileAvatarId=url.pathname.startsWith(profileAvatarPrefix)?url.pathname.slice(profileAvatarPrefix.length):"";
  if(request.method==="GET"&&profileAvatarId&&/^[A-Za-z0-9-]+$/.test(profileAvatarId)){
    const viewer=await currentUser(request,env);if(!viewer)return json({error:"Inicia sesión primero."},401);
    await ensureParticipantProfileImagesSchema(env);
    const image=await env.DB.prepare("SELECT image_data FROM participant_profile_images WHERE user_id=?").bind(profileAvatarId).first();
    if(!image?.image_data)return json({error:"Foto de perfil no disponible."},404);
    const response=dataUrlResponse(image.image_data,"image/jpeg",request);
    response.headers.set("cache-control","private, no-store, max-age=0");
    return response;
  }
  if (request.method === "POST" && url.pathname === "/api/profile/participant") {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Inicia sesión con Google primero." }, 401);
    await ensureParticipantProfilesSchema(env);
    const member=await getParticipantEdition(env,user,url);
    if (!member) return json({ error: "Primero confirma tu participación." }, 403);
    const body = await request.json();
    const firstName = String(body.firstName || "").trim().split(" ").filter(Boolean).join(" ");
    const lastName = String(body.lastName || "").trim().split(" ").filter(Boolean).join(" ");
    if (firstName.length < 2 || lastName.length < 2 || firstName.length > 80 || lastName.length > 100) return json({ error: "Ingresa nombres y apellidos válidos." }, 400);
    if(body.avatarData!==undefined){
      const imageData=String(body.avatarData||"");
      if(!new RegExp("^data:image/jpeg;base64,[A-Za-z0-9+/=]+$").test(imageData)||imageData.length>250000)return json({error:"La foto no es válida o supera el tamaño permitido. Selecciona otra imagen."},400);
      await ensureParticipantProfileImagesSchema(env);
      await env.DB.prepare("INSERT INTO participant_profile_images (user_id,image_data,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(user_id) DO UPDATE SET image_data=excluded.image_data,updated_at=datetime('now')").bind(user.id,imageData).run();
      await env.DB.prepare("UPDATE users SET avatar_url=? WHERE id=?").bind("/api/profile/avatar/"+user.id+"?v="+Date.now(),user.id).run();
    }
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
  async scheduled(event, env, ctx) { const cron=event.cron; const runClosures=cron==="0 11 * * *"; const runOpenings=cron==="0 23 * * *"; if(!runClosures&&!runOpenings){console.warn("Unknown scheduled trigger",cron);return;} ctx.waitUntil(Promise.all([processSpiritChallengeClosures(env,{runClosures,runOpenings}).catch(error=>console.error("Spirit scheduled task failed",cron,error?.message||String(error))),env.DB.prepare("DELETE FROM anonymous_chat_messages WHERE created_at<datetime('now','-7 days')").run().catch(error=>console.error("Chat cleanup failed",error?.message||String(error))),env.DB.prepare("DELETE FROM anonymous_clues WHERE created_at<datetime('now','-7 days')").run().catch(error=>console.error("Old clue cleanup failed",error?.message||String(error)))])); },
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