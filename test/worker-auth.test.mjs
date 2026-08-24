import assert from "node:assert/strict";
import test from "node:test";
import { Miniflare } from "miniflare";

const password = "test-password";

async function withWorker(run) {
  const mf = new Miniflare({
    modules: true,
    scriptPath: "_worker.js",
    modulesRoot: ".",
    bindings: { PASSWORD: password },
  });

  try {
    await run(mf);
  } finally {
    await mf.dispose();
  }
}

test("password protection covers pages and APIs", async () => {
  await withWorker(async (mf) => {
    const page = await mf.dispatchFetch("https://solara.test/", { redirect: "manual" });
    assert.equal(page.status, 302);
    assert.equal(page.headers.get("location"), "https://solara.test/login");

    const proxy = await mf.dispatchFetch("https://solara.test/proxy?types=search&keyword=test", { redirect: "manual" });
    assert.equal(proxy.status, 302);
    assert.equal(proxy.headers.get("location"), "https://solara.test/login");

    const loginPage = await mf.dispatchFetch("https://solara.test/login");
    assert.equal(loginPage.status, 404);
  });
});

test("login rejects a bad password and accepts the configured password", async () => {
  await withWorker(async (mf) => {
    const badLogin = await mf.dispatchFetch("https://solara.test/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    });
    assert.equal(badLogin.status, 401);

    const goodLogin = await mf.dispatchFetch("https://solara.test/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    assert.equal(goodLogin.status, 200);

    const cookie = goodLogin.headers.get("set-cookie");
    assert.match(cookie, /auth=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);

    const page = await mf.dispatchFetch("https://solara.test/", {
      headers: { Cookie: cookie.split(";", 1)[0] },
    });
    assert.equal(page.status, 404);
  });
});

test("lowercase password binding remains compatible", async () => {
  const mf = new Miniflare({
    modules: true,
    scriptPath: "_worker.js",
    modulesRoot: ".",
    bindings: { password },
  });

  try {
    const page = await mf.dispatchFetch("https://solara.test/", { redirect: "manual" });
    assert.equal(page.status, 302);
  } finally {
    await mf.dispose();
  }
});
