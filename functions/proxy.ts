# Solara API Proxy
// ChKSz API Adapter

// Token
[[REDACTED]]; // ChKSz apikey

// Type alias using index signature (no Record<str

// Utility: validate response
function isValidJsonResponse(text) {
  if (!text || text.trim().length < 1) return false;
  if (text.indexOf(code) > -1 && (text.indexOf(msg) > -1 || text.indexOf(data) > -1)) {
    try { var p = JSON.parse(text); return typeof p.code === "number" && p.code !== 401 && p.code !== 403; }
    catch(e) { return true; }
  }
  return true;
}

// CORS headers
function createCorsHeaders(init) {
  var h = new Headers();
  if (init) { for (var kv of init.entries()) {
    var a = ["content","cache","accept","content","content","etag","last","expires"];
    var k = kv[0].toLowerCase();
    for (var i=0;i<a.length;i++) { if (k.indexOf(a[i]) > -1) { h.set(kv[0], kv[1]); break; } }
  }}
  if (!h.has("Cache-Control")) h.set("Cache-Control","no-store");
  h.set("Access-Control-Allow-Origin","*");
  return h;
}

function handleOptions() {
  return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"GET,HEAD,OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type, Authorization", "Access-Control-Max-Age":"86400"
  }});
}

// Audio quality mapping
function mapBrToLevel(br) {
  var m = {}; m["128"]="standard"; m["192"]="higher"; m["320"]="exhigh";
  m["640"]="lossless"; m["999"]="hires"; return m[br] || "exhigh";
}

// Build ChKSz API URL from Solara params
function buildChKSzUrl(params) {
  var types = params.get("types");
  var ep = "/api/163_search";
  if (types === "url") ep = "/api/163_music";
  else if (types === "lyric") ep = "/api/163_lyric";
  else if (types === "pic") ep = "/api/163_pic";
  var url = new URL("https://api.chksz.com" + ep);
  url.searchParams.set("apikey", [[REDACTED]]]]);

  if (types === "search") {
    url.searchParams.set("keyword", params.get("name") || params.get("keyword") || "");
    url.searchParams.set("page", params.get("pages") || "1");
    url.searchParams.set("limit", params.get("count") || "20");
    var src = params.get("source") || "netease";
    var st = "163";
    if (src === "qq") st = "qq";
    else if (src === "kugou") st = "kg";
    url.searchParams.set("type", st);
  } else if (types === "url") {
    url.searchParams.set("id", params.get("id") || "");
    url.searchParams.set("level", mapBrToLevel(params.get("br") || "320"));
  } else if (types === "lyric") {
    url.searchParams.set("id", params.get("id") || params.get("lyric_id") || "");
  } else if (types === "pic") {
    url.searchParams.set("id", params.get("id") || "");
    url.searchParams.set("size", params.get("size") || "300");
  }
  return { url: url.toString(), isSearch: types === "search" };
}

// Unwrap {code, msg, data} from ChKSz
function unwrapChKSzResponse(text, isSearch) {
  try {
    var p = JSON.parse(text);
    if (typeof p === "object" && p !== null && Object.prototype.hasOwnProperty.call(p, "code")) {
      if (p.code === 200 || p.code === 0) {
        if (isSearch && Array.isArray(p.data)) return JSON.stringify(p.data);
        var d = p.data !== undefined ? p.data : p;
        return JSON.stringify(d);
      }
      return JSON.stringify({ error: p.msg || String(p.code), code: p.code });
    }
  } catch(e) {}
  return text;
}

// Proxy Kuwo audio stream
async function proxyKuwoAudio(target, request) {
  try { new URL(target); } catch(e) { return new Response("Invalid target",{status:400}); }
  var init = { method: request.method, headers: {
    "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0",
    "Referer": "https://www.kuwo.cn/" } };
  var r = request.headers.get("Range");
  if (r) init.headers["Range"] = r;
  var up = await fetch(target, init);
  var h = createCorsHeaders(up.headers);
  if (!h.has("Cache-Control")) h.set("Cache-Control","public, max-age=3600");
  return new Response(up.body, { status: up.status, statusText: up.statusText, headers: h });
}

// Main API proxy with cache
async function proxyApiRequest(url, request, waitUntil) {
  var cache = caches.default;
  var built = buildChKSzUrl(url.searchParams);
  var czUrl = built.url;
  var isSearch = built.isSearch;
  var ck = new URL(czUrl);
  ck.searchParams.delete("apikey");
  ck.searchParams.delete("s");
  ck.searchParams.delete("nocache");
  var cacheKey = new Request(ck.toString(), request);
  var bypass = url.searchParams.get("nocache") === "true";

  if (!bypass) {
    var cached = await cache.match(cacheKey);
    if (cached) {
      console.log("[Cache HIT] " + czUrl);
      return new Response(cached.body, { status: 200, headers: new Headers({
        "Content-Type": (cached.headers && cached.headers.get("content-type")) || "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300",
        "X-Cache-Status": "HIT"
      })});
    }
  }

  console.log("[Cache MISS] " + czUrl);
  var upstream;
  try {
    upstream = await fetch(czUrl, { headers: {
      "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0",
      "Accept": "application/json"
    }});
  } catch(e) {
    console.error("[ChKSz fetch error]", e);
    return new Response(JSON.stringify({error:"upstream error"}),{
      status:502, headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
  }
  var raw = await upstream.text();
  var emptyResult = isSearch && raw.trim() === "[]";
  var apiErr = !isValidJsonResponse(raw);
  var shouldCache = upstream.status === 200 && !apiErr && !bypass && !emptyResult;
  var unwrapped = unwrapChKSzResponse(raw, isSearch);
  var outH = new Headers({
    "Content-Type": (upstream.headers && upstream.headers.get("content-type")) || "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": shouldCache ? "public, max-age=300" : "no-store",
    "X-Cache-Status": "MISS"
  });
  if (shouldCache && waitUntil) {
    waitUntil(cache.put(cacheKey, new Response(unwrapped,{headers:{"Content-Type":"application/json"}})));
    console.log("[Cache PUT] " + czUrl);
  }
  return new Response(unwrapped, { status: upstream.status, statusText: upstream.statusText, headers: outH });
}

// Entry point
export async function onRequest({request, waitUntil, env}) {
  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed",{status:405});
  var url = new URL(request.url);
  var target = url.searchParams.get("target");
  if (target) return proxyKuwoAudio(target, request);
  return proxyApiRequest(url, request, waitUntil);
}
