import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/inscription/route";

const payload = { name: "Jo", email: "jo@example.com", city: "Lyon", role: "both", consent: true, website: "", requestId: "e6384c52-87fa-43fc-803a-3253717c712a" };
const request = (body: unknown, origin = "http://localhost:3001") => new Request("http://localhost:3001/api/inscription", {
  method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body),
});

test("registration validates input and reports mail transport outcomes without sending real mail", async (t) => {
  const previous = { key: process.env.RESEND_API_KEY, to: process.env.REGISTRATION_TO, from: process.env.MAIL_FROM };
  delete process.env.RESEND_API_KEY;
  delete process.env.REGISTRATION_TO;
  delete process.env.MAIL_FROM;
  try {
    await t.test("missing mail configuration is not reported as a successful signup", async () => {
      assert.equal((await POST(request(payload))).status, 503);
      const proxied = new Request("http://localhost:3001/api/inscription", {
        method: "POST", headers: { "Content-Type": "application/json", host: "127.0.0.1:3001", origin: "http://127.0.0.1:3001" },
        body: JSON.stringify(payload),
      });
      assert.equal((await POST(proxied)).status, 503);
    });
    await t.test("rejects invalid email, consent, role and malformed bodies", async () => {
      for (const invalid of [null, [], { ...payload, email: "wrong" }, { ...payload, consent: false }, { ...payload, role: "toString" }, { ...payload, name: "Jo\nInjected" }]) {
        assert.equal((await POST(request(invalid))).status, 400);
      }
    });
    await t.test("rejects cross-origin requests and oversized streams", async () => {
      assert.equal((await POST(request(payload, "https://unrelated.example"))).status, 403);
      assert.equal((await POST(request({ ...payload, city: "x".repeat(9000) }))).status, 413);
      assert.equal((await POST(request({ ...payload, website: "https://bot.example" }))).status, 400);
    });
    process.env.RESEND_API_KEY = "test-only-key";
    process.env.REGISTRATION_TO = "owner@example.com";
    process.env.MAIL_FROM = "Voyaj <test@example.com>";
    const calls: { headers: Headers; body: Record<string, unknown> }[] = [];
    const transport = t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
      calls.push({ headers: new Headers(init.headers), body: JSON.parse(init.body as string) });
      return Response.json({ id: "test-provider-id" });
    });
    await t.test("sends only to the configured recipient and safely sets reply-to", async () => {
      assert.equal((await POST(request({ ...payload, to: "attacker@example.com" }))).status, 200);
      assert.deepEqual(calls[0].body.to, ["owner@example.com"]);
      assert.equal(calls[0].body.reply_to, payload.email);
      assert.match(calls[0].body.text as string, /Conducteur et passager/);
      assert.equal((await POST(request(payload))).status, 200);
      assert.equal(calls[0].headers.get("Idempotency-Key"), calls[1].headers.get("Idempotency-Key"));
    });
    await t.test("provider errors never produce a success response", async () => {
      transport.mock.mockImplementation(async () => Response.json({ error: "rejected" }, { status: 429 }));
      assert.equal((await POST(request(payload))).status, 502);
      transport.mock.mockImplementation(async () => Response.json({}));
      assert.equal((await POST(request(payload))).status, 502);
      transport.mock.mockImplementation(async () => { throw new Error("network"); });
      assert.equal((await POST(request(payload))).status, 502);
    });
  } finally {
    for (const [name, value] of Object.entries({ RESEND_API_KEY: previous.key, REGISTRATION_TO: previous.to, MAIL_FROM: previous.from })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
