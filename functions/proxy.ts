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

// Solara br -> ChKSz level (163_music)
function mapBrToLevel(br) {
  var m = {};
  m["128"] = "standard";
  m["192"] = "exhigh";
  m["320"] = "exhigh";
  m["640"] = "lossless";
  m["999"] = "hires";
  return m[br] || "exhigh";
}

// Build ChKSz request from Solara /proxy params (per chksz docs)
function buildChKSzUrl(params, env) {
  var base = (env && env.API_BASE_URL && String(env.API_BASE_URL).trim())
    ? String(env.API_BASE_URL).trim().replace(/\/+$/, "")
    : "https://api.chksz.com";
  var key = (env && env.API_KEY && String(env.API_KEY).trim()) ? String(env.API_KEY).trim() : "";
  var types = params.get("types") || "search";
  var source = params.get("source") || "netease";
  var u;

  if (types === "search") {
    var kw = params.get("name") || params.get("keyword") || "";
    var count = params.get("count") || "20";
    var page = parseInt(params.get("pages") || "1", 10) || 1;
    var offset = Math.max(0, (page - 1) * parseInt(count, 10));
    if (source === "qq") {
      u = new URL(base + "/api/qq_music");
      u.searchParams.set("msg", kw);
      u.searchParams.set("num", count);
    } else if (source === "kugou") {
      u = new URL(base + "/api/kugou_music");
      u.searchParams.set("msg", kw);
      u.searchParams.set("n", count);
    } else {
      u = new URL(base + "/api/163_search");
      u.searchParams.set("keyword", kw);
      u.searchParams.set("limit", count);
      u.searchParams.set("offset", String(offset));
    }
  } else if (types === "url") {
    var id = params.get("id") || "";
    var level = mapBrToLevel(params.get("br") || "320");
    if (source === "qq") {
      // QQ resolves by mid directly as fallback; docs also allow msg+n
      u = new URL(base + "/api/qq_music");
      u.searchParams.set("mid", id);
      u.searchParams.set("size", level);
    } else if (source === "kugou") {
      u = new URL(base + "/api/kugou_music");
      u.searchParams.set("id", id);
      u.searchParams.set("size", mapKugouSize(params.get("br") || "320"));
    } else {
      u = new URL(base + "/api/163_music");
      u.searchParams.set("id", id);
      u.searchParams.set("level", level);
      u.searchParams.set("type", "json");
    }
  } else if (types === "lyric") {
    u = new URL(base + "/api/163_lyric");
    u.searchParams.set("id", params.get("id") || params.get("lyric_id") || "");
  } else if (types === "pic") {
    u = new URL(base + "/api/163_music");
    u.searchParams.set("id", params.get("id") || "");
    u.searchParams.set("level", "standard");
    u.searchParams.set("type", "json");
  }

  if (key) u.searchParams.set("apikey", key);
  return { url: u.toString(), isSearch: types === "search", pix: types === "pic" };
}

function mapKugouSize(br) {
  var m = {};
  m["128"] = "128k";
  m["192"] = "320k";
  m["320"] = "320k";
  m["640"] = "flac";
  m["999"] = "hires";
  return m[br] || "flac";
}

// Normalize ChKSz JSON into what Solara front-end expects
function normalizeJson(text, kind) {
  var parsed;
  try { parsed = JSON.parse(text); } catch (e) { return text; }
  if (!parsed || typeof parsed !== "object") return JSON.stringify(parsed);

  // ChKSz envelopes: {code,msg,data} or {code,msg,list}
  var payload = parsed;
  if (typeof parsed.code === "number" && parsed.code !== 200 && parsed.code !== 0) {
    return JSON.stringify({ error: parsed.msg || ("ChKSz error " + parsed.code), code: parsed.code });
  }
  if (parsed.data !== undefined) payload = parsed.data;
  else if (Array.isArray(parsed.list)) payload = parsed.list;

  if (kind === "search") {
    // search expects an array of songs
    var arr = Array.isArray(payload) ? payload
      : (payload && Array.isArray(payload.songs)) ? payload.songs
      : (payload && Array.isArray(payload.list)) ? payload.list
      : [];
    var out = arr.map(function (it) {
      var obj = (it && typeof it === "object") ? it : {};
      var mid = obj.mid || obj.id || "";
      return {
        id: String(obj.id || obj.mid || obj.songmid || ""),
        name: obj.name || obj.title || obj.songname || obj.songName || "",
        artist: obj.singer || obj.artist || obj.artists || obj.author || (obj.artists && obj.artists[0] && obj.artists[0].name) || "未知艺术家",
        album: obj.album || obj.albumname || obj.albumName || "",
        pic_id: String(obj.id || mid),
        picUrl: obj.cover || obj.pic || obj.picUrl || obj.albm || "",
        url_id: String(obj.id || mid),
        lyric_id: String(obj.id || mid)
      };
    });
    return JSON.stringify(out);
  }

  if (kind === "pic") {
    var cover = payload.cover || payload.pic || payload.picUrl || payload.albumPicUrl || payload.album.albumpic || "";
    return JSON.stringify({ url: cover });
  }

  // url / lyric: pass through resolved payload
  if (kind === "url") {
    if (typeof payload === "string") return JSON.stringify({ url: payload });
    var u = payload.url || payload.playUrl || payload.play_url || payload.src || "";
    var cover = payload.cover || payload.pic || "";
    return JSON.stringify({ url: u, cover: cover, name: payload.name || "", artist: payload.singer || payload.artist || "" });
  }

  if (kind === "lyric") {
    var lrc = payload.lrc || payload.lyric || payload.lrcLyric || payload.lrclist || payload.lrcList || "";
    if (Array.isArray(lrc)) {
      lrc = lrc.map(function (x) { return x.lyric || x.lrc || ""; }).join("\n");
    }
    if (lrc && typeof lrc === "object" && lrc.lyric) lrc = lrc.lyric;
    return JSON.stringify({ lyric: lrc, translated: payload.trans || payload.tlyric || "" });
  }

  return JSON.stringify(payload);
}

async function proxyApiRequest(url, request, waitUntil, env) {
  var key = (env && env.API_KEY && String(env.API_KEY).trim()) ? String(env.API_KEY).trim() : "";
  if (!key) {
    return new Response(JSON.stringify({ error: "API_KEY 未配置：请在 Cloudflare 环境变量中设置 ChKSz API Key" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  var built = buildChKSzUrl(url.searchParams, env);
  var czUrl = built.url;
  var cache = caches.default;
  var ck = new URL(czUrl);
  ck.searchParams.delete("apikey");
  ck.searchParams.delete("s");
  ck.searchParams.delete("nocache");
  var cacheKey = new Request(ck.toString(), request);
  var bypass = url.searchParams.get("nocache") === "true";

  if (!bypass) {
    var cached = await cache.match(cacheKey);
    if (cached) {
      return new Response(cached.body, { status: 200, headers: corsHeaders(new Headers({
        "Content-Type": "application/json",
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
  var kind = built.isSearch ? "search" : (built.pix ? "pic" : (url.searchParams.get("types") === "lyric" ? "lyric" : "url"));
  var unwrapped = normalizeJson(raw, kind);
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
export async function onRequest({ request, waitUntil, env }) {
  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }
  var url = new URL(request.url);
  return proxyApiRequest(url, request, waitUntil, env);
}
