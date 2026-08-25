// Solara API Proxy — ChKSz API Adapter (Cloudflare Pages Function)
// Docs: https://api.chksz.com  (apikey passed via env.API_KEY)
// Front-end /proxy protocol: types=search|url|lyric|pic

function corsHeaders(init) {
  var h = new Headers();
  if (init) {
    for (var kv of init.entries()) {
      var a = ["content", "cache", "accept", "etag", "last", "expires"];
      var k = kv[0].toLowerCase();
      for (var i = 0; i < a.length; i++) {
        if (k.indexOf(a[i]) > -1) { h.set(kv[0], kv[1]); break; }
      }
    }
  }
  if (!h.has("Cache-Control")) h.set("Cache-Control", "no-store");
  h.set("Access-Control-Allow-Origin", "*");
  return h;
}

function handleOptions() {
  return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  }});
}

// Solara quality values -> provider-native quality values
function mapBrToLevel(br) {
  var m = {
    "128": "standard",
    "192": "exhigh",
    "320": "exhigh",
    "640": "lossless",
    "999": "lossless",
    "1999": "hires",
    "9999": "jymaster",
    "standard": "standard",
    "exhigh": "exhigh",
    "lossless": "lossless",
    "hires": "hires",
    "jyeffect": "jyeffect",
    "sky": "sky",
    "jymaster": "jymaster",
    "master": "jymaster"
  };
  return m[String(br || "")] || "exhigh";
}

function mapProviderSize(br) {
  var m = {
    "128": "128k",
    "192": "320k",
    "320": "320k",
    "640": "flac",
    "999": "flac",
    "1999": "hires",
    "9999": "master",
    "standard": "128k",
    "exhigh": "320k",
    "lossless": "flac",
    "hires": "hires",
    "jyeffect": "hires",
    "sky": "hires",
    "jymaster": "master",
    "master": "master"
  };
  return m[String(br || "")] || "flac";
}

function normalizeProvider(source) {
  return source === "qq" || source === "kugou" || source === "bugpk" ? source : "netease";
}

// Build a ChKSz request from Solara's legacy /proxy parameters.
function buildChKSzUrl(params, env) {
  var base = (env && env.API_BASE_URL && String(env.API_BASE_URL).trim())
    ? String(env.API_BASE_URL).trim().replace(/\/+$/, "")
    : "https://api.chksz.com";
  var key = (env && env.API_KEY && String(env.API_KEY).trim()) ? String(env.API_KEY).trim() : (params.get("apikey") || "");
  var types = params.get("types") || "search";
  var source = normalizeProvider(params.get("source") || "netease");
  var id = params.get("id") || "";
  var br = params.get("br") || "320";
  var u;

  if (types === "search") {
    var kw = params.get("name") || params.get("keyword") || "";
    var count = Math.max(1, Math.min(50, parseInt(params.get("count") || "20", 10) || 20));
    var page = Math.max(1, parseInt(params.get("pages") || "1", 10) || 1);
    var offset = (page - 1) * count;
    if (source === "bugpk") {
      u = new URL((env && env.BUGPK_BASE_URL ? String(env.BUGPK_BASE_URL).replace(/\/+$/, "") : "https://api.bugpk.com") + "/api/163_music");
      u.searchParams.set("type", "search");
      u.searchParams.set("s", kw);
      u.searchParams.set("limit", String(count));
    } else if (source === "qq") {
      u = new URL(base + "/api/qq_music");
      u.searchParams.set("msg", kw);
      u.searchParams.set("num", String(count));
    } else if (source === "kugou") {
      u = new URL(base + "/api/kugou_music");
      u.searchParams.set("msg", kw);
      u.searchParams.set("num", String(count));
    } else {
      u = new URL(base + "/api/163_search");
      u.searchParams.set("keyword", kw);
      u.searchParams.set("limit", String(count));
      u.searchParams.set("offset", String(offset));
    }
  } else if (types === "playlist") {
    if (source !== "netease") throw new Error("歌单读取目前仅支持网易云音乐");
    u = new URL(base + "/api/163_playlist");
    u.searchParams.set("id", id);
  } else if (types === "url" || types === "lyric" || types === "pic") {
    if (source === "bugpk") {
      u = new URL((env && env.BUGPK_BASE_URL ? String(env.BUGPK_BASE_URL).replace(/\/+$/, "") : "https://api.bugpk.com") + "/api/163_music");
      u.searchParams.set("id", id);
      u.searchParams.set("type", types === "lyric" ? "lyric" : (types === "pic" ? "song" : "url"));
      if (types === "url") u.searchParams.set("level", mapBrToLevel(br));
    } else
    if (source === "qq") {
      u = new URL(base + "/api/qq_music");
      u.searchParams.set("mid", id);
      u.searchParams.set("size", mapProviderSize(br));
    } else if (source === "kugou") {
      u = new URL(base + "/api/kugou_music");
      u.searchParams.set("id", id);
      u.searchParams.set("size", mapProviderSize(br));
    } else if (types === "lyric") {
      u = new URL(base + "/api/163_lyric");
      u.searchParams.set("id", id || params.get("lyric_id") || "");
    } else {
      u = new URL(base + "/api/163_music");
      u.searchParams.set("id", id);
      u.searchParams.set("level", types === "pic" ? "standard" : mapBrToLevel(br));
      u.searchParams.set("type", "json");
    }
  } else {
    throw new Error("不支持的代理类型: " + types);
  }

  if (key) u.searchParams.set("apikey", key);
  return { url: u.toString(), kind: types, source: source };
}

function artistText(value) {
  if (Array.isArray(value)) {
    return value.map(function (x) { return x && typeof x === "object" ? (x.name || x.singer || "") : String(x || ""); }).filter(Boolean).join(" / ");
  }
  if (value && typeof value === "object") return value.name || value.singer || "";
  return value ? String(value) : "";
}

function albumText(value) {
  if (value && typeof value === "object") return value.name || value.albumName || "";
  return value ? String(value) : "";
}

// Normalize ChKSz JSON into the legacy shape consumed by Solara.
function normalizeJson(text, kind, source) {
  var parsed;
  try { parsed = JSON.parse(text); } catch (e) { return text; }
  if (!parsed || typeof parsed !== "object") return JSON.stringify(parsed);

  var payload = parsed;
  if (typeof parsed.code === "number" && parsed.code !== 200 && parsed.code !== 0) {
    return JSON.stringify({ error: parsed.msg || ("ChKSz error " + parsed.code), code: parsed.code });
  }
  if (parsed.data !== undefined) payload = parsed.data;
  else if (Array.isArray(parsed.list)) payload = parsed.list;

  if (kind === "search") {
    var arr = Array.isArray(payload) ? payload
      : (payload && Array.isArray(payload.songs)) ? payload.songs
      : (payload && Array.isArray(payload.list)) ? payload.list
      : [];
    return JSON.stringify(arr.map(function (it) {
      var obj = (it && typeof it === "object") ? it : {};
      var songId = obj.id || obj.mid || obj.songmid || obj.songId || "";
      var artist = artistText(obj.singer || obj.artist || obj.artists || obj.author) || "未知艺术家";
      return {
        id: String(songId),
        name: obj.name || obj.title || obj.songname || obj.songName || "",
        artist: artist,
        album: albumText(obj.album || obj.albumname || obj.albumName),
        pic_id: String(songId),
        picUrl: obj.cover || obj.pic || obj.picUrl || obj.picimg || obj.album_img || obj.albumImg || obj.albm || "",
        url_id: String(songId),
        lyric_id: String(songId),
        source: source
      };
    }));
  }

  if (kind === "playlist") {
    var playlist = payload && payload.playlist ? payload.playlist : payload;
    var tracks = playlist && (playlist.tracks || playlist.songs || playlist.list);
    if (!Array.isArray(tracks)) tracks = [];
    return JSON.stringify({ playlist: {
      name: playlist && playlist.name || "",
      coverImgUrl: playlist && (playlist.coverImgUrl || playlist.cover || playlist.picUrl) || "",
      trackCount: playlist && (playlist.trackCount || playlist.total) || tracks.length,
      tracks: tracks.map(function (track) {
        var obj = track && typeof track === "object" ? track : {};
        var sid = obj.id || obj.mid || "";
        var artists = obj.ar || obj.artists || obj.singer || obj.artist || [];
        var names = artistText(artists);
        return {
          id: sid,
          name: obj.name || obj.title || "",
          ar: names ? names.split(" / ").map(function (name) { return { name: name }; }) : [],
          al: { name: albumText(obj.al || obj.album), picUrl: obj.cover || obj.picUrl || (obj.al && obj.al.picUrl) || "" }
        };
      })
    }});
  }

  if (kind === "pic") {
    var album = payload && payload.album;
    var cover = payload && (payload.cover || payload.pic || payload.picUrl || payload.picimg || payload.album_img || payload.albumImg || payload.albumPicUrl) || (album && (album.albumpic || album.album_img || album.albumImg || album.picUrl)) || "";
    return JSON.stringify({ url: cover });
  }

  if (kind === "url") {
    if (Array.isArray(payload)) payload = payload[0] || {};
    if (typeof payload === "string") return JSON.stringify({ url: payload });
    payload = payload || {};
    return JSON.stringify({
      url: payload.url || payload.playUrl || payload.play_url || payload.src || payload.url320 || payload.url128 || "",
      cover: payload.cover || payload.pic || payload.picUrl || "",
      name: payload.name || "",
      artist: artistText(payload.singer || payload.artist || payload.artists),
      lyric: payload.lrc || payload.lyric || ""
    });
  }

  if (kind === "lyric") {
    payload = payload || {};
    var lrc = payload.lrc || payload.lyric || payload.lrcLyric || payload.lrclist || payload.lrcList || (typeof payload === "string" ? payload : "") || "";
    if (Array.isArray(lrc)) lrc = lrc.map(function (x) { return x && (x.lyric || x.lrc) || ""; }).join("\n");
    if (lrc && typeof lrc === "object") lrc = lrc.lyric || lrc.lrc || "";
    var translated = payload.trans || payload.tlyric || payload.translated || "";
    if (translated && typeof translated === "object") translated = translated.lyric || "";
    return JSON.stringify({ lyric: lrc, translated: translated });
  }

  return JSON.stringify(payload);
}

function comparableText(value) {
  return String(value || "").toLowerCase().replace(/[\s\-_/,.()\[\]]/g, "");
}

function pickArtworkMatch(songs, name, artist, album) {
  var targetName = comparableText(name);
  var targetArtist = comparableText(artist);
  var targetAlbum = comparableText(album);
  var candidates = (Array.isArray(songs) ? songs : []).filter(function (song) {
    return song && typeof song.picUrl === "string" && /^https?:\/\//i.test(song.picUrl);
  });
  candidates.sort(function (a, b) {
    function score(song) {
      var songName = comparableText(song.name);
      var songArtist = comparableText(song.artist);
      var songAlbum = comparableText(song.album);
      var value = 0;
      if (targetName && songName === targetName) value += 100;
      else if (targetName && (songName.includes(targetName) || targetName.includes(songName))) value += 45;
      if (targetArtist && (songArtist.includes(targetArtist) || targetArtist.includes(songArtist))) value += 35;
      if (targetAlbum && songAlbum === targetAlbum) value += 20;
      return value;
    }
    return score(b) - score(a);
  });
  return candidates[0] || null;
}

async function findNeteaseArtwork(params, env, request) {
  var name = params.get("name") || "";
  var artist = params.get("artist") || "";
  var album = params.get("album") || "";
  if (!name) return "";
  var searchParams = new URLSearchParams();
  searchParams.set("types", "search");
  searchParams.set("source", "netease");
  searchParams.set("name", [name, artist].filter(Boolean).join(" "));
  searchParams.set("count", "8");
  searchParams.set("pages", "1");
  var built = buildChKSzUrl(searchParams, env);
  var response = await fetch(built.url, { headers: {
    "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0",
    "Accept": "application/json"
  }});
  if (!response.ok) return "";
  var normalized = normalizeJson(await response.text(), "search", "netease");
  var songs;
  try { songs = JSON.parse(normalized); } catch (_) { songs = []; }
  var match = pickArtworkMatch(songs, name, artist, album);
  return match ? match.picUrl : "";
}

async function proxyApiRequest(url, request, waitUntil, env) {
  var key = (env && env.API_KEY && String(env.API_KEY).trim()) ? String(env.API_KEY).trim() : (url.searchParams.get("apikey") || "");
  var imageMode = url.searchParams.get("format") === "image" && url.searchParams.get("types") === "pic";
  if (!key) {
    return new Response(JSON.stringify({ error: "API_KEY 未配置：请在 Cloudflare 环境变量中设置 ChKSz API Key" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  var built = buildChKSzUrl(url.searchParams, env);
  var czUrl = built.url;
  var cache = caches.default;
  // Cache by the public proxy request, not only by the upstream URL. QQ/Kugou
  // use one detail endpoint for URL, lyric and cover, but each proxy type has a
  // different normalized response shape.
  var ck = new URL(url.toString());
  ck.searchParams.delete("apikey");
  ck.searchParams.delete("s");
  ck.searchParams.delete("nocache");
  var cacheKey = new Request(ck.toString(), { method: "GET" });
  var bypass = url.searchParams.get("nocache") === "true";

  if (!bypass) {
    var cached = await cache.match(cacheKey);
    if (cached) {
      return new Response(cached.body, { status: 200, headers: corsHeaders(new Headers({
        "Content-Type": imageMode ? (cached.headers.get("Content-Type") || "image/jpeg") : "application/json",
        "Cache-Control": "public, max-age=300",
        "X-Cache-Status": "HIT"
      })) });
    }
  }

  var upstream;
  try {
    upstream = await fetch(czUrl, { headers: {
      "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0",
      "Accept": "application/json"
    }});
  } catch (e) {
    return new Response(JSON.stringify({ error: "upstream error: " + (e && e.message || e) }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  var raw = await upstream.text();
  var kind = built.kind;
  var unwrapped = normalizeJson(raw, kind, built.source);
  if (imageMode) {
    var imageData;
    try { imageData = JSON.parse(unwrapped); } catch (_) { imageData = {}; }
    var imageUrl = imageData && typeof imageData.url === "string" ? imageData.url : "";
    if (!/^https?:\/\//i.test(imageUrl)) {
      try { imageUrl = await findNeteaseArtwork(url.searchParams, env, request); }
      catch (error) { try { console.warn("Netease artwork fallback failed", error); } catch (_) {} }
    }
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
      return new Response(JSON.stringify({ error: "封面地址为空", code: 404 }), { status: 404, headers: corsHeaders(new Headers({ "Content-Type": "application/json" })) });
    }
    var imageResponse;
    try { imageResponse = await fetch(imageUrl, { headers: { "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0", "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" } }); }
    catch (error) { return new Response(JSON.stringify({ error: "封面上游请求失败", detail: String(error && error.message || error) }), { status: 502, headers: corsHeaders(new Headers({ "Content-Type": "application/json" })) }); }
    if (!imageResponse.ok) return new Response(JSON.stringify({ error: "封面上游返回错误", code: imageResponse.status }), { status: imageResponse.status, headers: corsHeaders(new Headers({ "Content-Type": "application/json" })) });
    var imageHeaders = corsHeaders(new Headers({ "Content-Type": imageResponse.headers.get("Content-Type") || "image/jpeg", "Cache-Control": "public, max-age=86400", "X-Cache-Status": "MISS" }));
    if (!bypass && waitUntil) waitUntil(cache.put(cacheKey, new Response(imageResponse.clone().body, { headers: imageHeaders })));
    return new Response(imageResponse.body, { status: 200, headers: imageHeaders });
  }
  var status = upstream.status >= 200 && upstream.status < 500 ? upstream.status : 200;
  var outH = corsHeaders(new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": (upstream.status === 200 && !bypass) ? "public, max-age=300" : "no-store",
    "X-Cache-Status": "MISS"
  }));

  if (upstream.status === 200 && !bypass && waitUntil) {
    waitUntil(cache.put(cacheKey, new Response(unwrapped, { headers: { "Content-Type": "application/json" } })));
  }
  return new Response(unwrapped, { status: status, headers: outH });
}

// Entry point
async function proxyOnRequest({ request, waitUntil, env }) {
  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }
  var url = new URL(request.url);
  return proxyApiRequest(url, request, waitUntil, env);
}

// ================= login =================
const MAX_AGE_SECONDS = 48 * 60 * 60;
function getConfiguredPassword(env) {
  if (!env) return null;
  const lower = env.password;
  if (typeof lower === "string" && lower.length > 0) return lower;
  const value = env.PASSWORD;
  return typeof value === "string" && value.length > 0 ? value : null;
}
async function loginOnRequestPost(context) {
  const { request, env } = context;
  const passwordEnv = getConfiguredPassword(env);
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const providedPassword = typeof body.password === "string" ? body.password : "";
  if (typeof passwordEnv !== "string" || passwordEnv.length === 0) {
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (providedPassword === passwordEnv) {
    const cookieSegments = ["auth=" + btoa(passwordEnv), "Max-Age=" + MAX_AGE_SECONDS, "Path=/", "SameSite=Lax", "HttpOnly"];
    if (url.protocol === "https:") cookieSegments.push("Secure");
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json", "Set-Cookie": cookieSegments.join("; ") } });
  }
  return new Response(JSON.stringify({ success: false }), { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
}

// ================= storage (D1) =================
const FAVORITE_KEYS = new Set(["favoriteSongs", "currentFavoriteIndex", "favoritePlayMode", "favoritePlaybackTime"]);
function storageTableForKey(key) {
  return FAVORITE_KEYS.has(key) ? "favorites_store" : "playback_store";
}
function storageJson(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
}
function storageHasDb(env) {
  return Boolean(env && env.DB && typeof env.DB.prepare === "function");
}
async function storageEnsureTables(env) {
  if (!storageHasDb(env)) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS playback_store (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS favorites_store (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)")
  ]);
}
async function storageGet(request, env) {
  if (!storageHasDb(env)) return storageJson({ d1Available: false, data: {} });
  const url = new URL(request.url);
  if (url.searchParams.get("status")) return storageJson({ d1Available: true });
  await storageEnsureTables(env);
  const keys = (url.searchParams.get("keys") || "").split(",").map(k => k.trim()).filter(Boolean);
  const data = {};
  keys.forEach(k => { data[k] = null; });
  let rows = [];
  if (keys.length > 0) {
    const grouped = {};
    keys.forEach(k => { const t = storageTableForKey(k); (grouped[t] = grouped[t] || []).push(k); });
    for (const t of Object.keys(grouped)) {
      const ks = grouped[t];
      const placeholders = ks.map(() => "?").join(",");
      const res = await env.DB.prepare("SELECT key, value FROM " + t + " WHERE key IN (" + placeholders + ")").bind(...ks).all();
      rows = rows.concat((res && (res.results || [])) || []);
    }
  } else {
    const r1 = await env.DB.prepare("SELECT key, value FROM playback_store").all();
    const r2 = await env.DB.prepare("SELECT key, value FROM favorites_store").all();
    rows = rows.concat(r1.results || [], r2.results || []);
  }
  rows.forEach(row => { if (row && typeof row.key === "string") data[row.key] = row.value; });
  return storageJson({ d1Available: true, data });
}
async function storagePost(request, env) {
  if (!storageHasDb(env)) return storageJson({ d1Available: false, data: {} });
  const body = await request.json().catch(() => ({}));
  const payload = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data : null;
  if (!payload) return storageJson({ error: "Invalid payload" }, 400);
  const entries = Object.entries(payload).filter(([k]) => Boolean(k));
  if (entries.length === 0) return storageJson({ d1Available: true, updated: 0 });
  await storageEnsureTables(env);
  const grouped = {};
  for (const [k, v] of entries) {
    const t = storageTableForKey(k);
    (grouped[t] = grouped[t] || []).push(env.DB.prepare("INSERT INTO " + t + " (key, value, updated_at) VALUES (?1, ?2, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(k, v == null ? "" : String(v)));
  }
  const batches = [];
  for (const t of Object.keys(grouped)) batches.push(env.DB.batch(grouped[t]));
  await Promise.all(batches);
  return storageJson({ d1Available: true, updated: entries.length });
}
async function storageDel(request, env) {
  if (!storageHasDb(env)) return storageJson({ d1Available: false });
  const body = await request.json().catch(() => ({}));
  const keys = Array.isArray(body.keys) ? body.keys.filter(k => typeof k === "string" && Boolean(k)) : [];
  if (keys.length === 0) return storageJson({ d1Available: true, deleted: 0 });
  await storageEnsureTables(env);
  const grouped = {};
  keys.forEach(k => { const t = storageTableForKey(k); (grouped[t] = grouped[t] || []).push(env.DB.prepare("DELETE FROM " + t + " WHERE key = ?1").bind(k)); });
  const batches = [];
  for (const t of Object.keys(grouped)) batches.push(env.DB.batch(grouped[t]));
  await Promise.all(batches);
  return storageJson({ d1Available: true, deleted: keys.length });
}
async function storageOnRequest(context) {
  const { request, env } = context;
  const m = (request.method || "GET").toUpperCase();
  if (m === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  if (m === "GET") return storageGet(request, env);
  if (m === "POST") return storagePost(request, env);
  if (m === "DELETE") return storageDel(request, env);
  return storageJson({ error: "Method not allowed" }, 405);
}

// ================= auth =================
const PUBLIC_PATH_PATTERNS = [/^\/login(?:\/|$)/, /^\/api\/login(?:\/|$)/];
const PUBLIC_FILE_EXTENSIONS = new Set([".css",".js",".png",".svg",".jpg",".jpeg",".gif",".webp",".ico",".txt",".map",".json",".woff",".woff2"]);
function hasPublicExt(pathname) {
  const i = pathname.lastIndexOf(".");
  if (i === -1) return false;
  return PUBLIC_FILE_EXTENSIONS.has(pathname.slice(i).toLowerCase());
}
function isPublicPath(pathname) { return PUBLIC_PATH_PATTERNS.some(p => p.test(pathname)) || hasPublicExt(pathname); }
function authResponse(request, env, url) {
  const password = getConfiguredPassword(env);
  if (typeof password !== "string" || password.length === 0) return null;
  const pathname = url.pathname;
  if (isPublicPath(pathname)) return null;
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = {};
  cookieHeader.split(";").forEach(part => { const idx = part.indexOf("="); if (idx === -1) return; const k = part.slice(0, idx).trim(); const v = part.slice(idx + 1).trim(); if (k) cookies[k] = v; });
  if (cookies.auth && cookies.auth === btoa(password)) return null;
  return Response.redirect(new URL("/login", url).toString(), 302);
}

// ================= entry =================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (request.method === "OPTIONS") {
      return handleOptions();
    }
    if (pathname === "/api/login" && request.method === "POST") {
      return loginOnRequestPost({ request, env });
    }
    const authRes = authResponse(request, env, url);
    if (authRes) return authRes;
    if (pathname === "/proxy" || pathname.startsWith("/proxy")) {
      try {
        return await proxyOnRequest({ request, waitUntil: (promise) => ctx.waitUntil(promise), env });
      } catch (e) {
        const msg = "PROXY_ERR " + (e && e.stack ? e.stack : String(e));
        try { console.error(msg); } catch (_) {}
        return new Response(msg, { status: 500, headers: { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" } });
      }
    }
    if (pathname === "/api/storage" || pathname.startsWith("/api/storage")) {
      return storageOnRequest({ request, env });
    }
    if (pathname === "/palette" || pathname.startsWith("/palette")) {
      return new Response(JSON.stringify({ error: "palette endpoint not bundled in worker" }), { status: 501, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }
    return new Response("Not found", { status: 404 });
  }
};
