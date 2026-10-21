import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readCookie, sessionClearCookie, sessionSetCookie } from "./utils/cookies.js";

describe("reading the Cookie header", () => {
  it("reads one cookie", () => {
    assert.equal(readCookie("sokoto_cover_session=abc123", "sokoto_cover_session"), "abc123");
  });

  it("reads the right one out of several", () => {
    const header = "theme=dark; sokoto_cover_session=abc123; other=zzz";
    assert.equal(readCookie(header, "sokoto_cover_session"), "abc123");
    assert.equal(readCookie(header, "theme"), "dark");
  });

  it("answers undefined rather than throwing for anything absent or malformed", () => {
    assert.equal(readCookie(undefined, "sokoto_cover_session"), undefined);
    assert.equal(readCookie("", "sokoto_cover_session"), undefined);
    assert.equal(readCookie("sokoto_cover_session", "sokoto_cover_session"), undefined, "no = means no value");
    assert.equal(readCookie("other=1", "sokoto_cover_session"), undefined);
    assert.equal(readCookie("sokoto_cover_session=", "sokoto_cover_session"), undefined);
  });

  it("strips the quoted-string form", () => {
    assert.equal(readCookie('a="quoted"', "a"), "quoted");
  });

  it("does not match a cookie whose name merely starts with the wanted one", () => {
    assert.equal(readCookie("sokoto_cover_session_extra=1", "sokoto_cover_session"), undefined);
  });
});

describe("building the session cookie", () => {
  it("is httpOnly and same-site, so page JavaScript cannot read the session id", () => {
    const cookie = sessionSetCookie("sokoto_cover_session", "abc123", { secure: false });
    assert.ok(cookie);
    assert.ok(cookie.includes("HttpOnly"));
    assert.ok(cookie.includes("SameSite=Lax"));
    assert.ok(cookie.includes("Path=/"));
    assert.equal(cookie.split(";")[0], "sokoto_cover_session=abc123");
  });

  it("adds Secure only when asked, since plain-http development cannot set it", () => {
    assert.ok(!sessionSetCookie("s", "abc", { secure: false })!.includes("Secure"));
    assert.ok(sessionSetCookie("s", "abc", { secure: true })!.includes("Secure"));
  });

  it("sets Max-Age for a remembered session and omits it otherwise", () => {
    assert.ok(sessionSetCookie("s", "abc", { secure: false, maxAgeSeconds: 3600 })!.includes("Max-Age=3600"));
    assert.ok(!sessionSetCookie("s", "abc", { secure: false })!.includes("Max-Age"));
  });

  it("refuses a value that could break out of the header", () => {
    assert.equal(sessionSetCookie("s", "abc\r\nSet-Cookie: admin=true", { secure: false }), undefined);
    assert.equal(sessionSetCookie("s", "a b", { secure: false }), undefined);
    assert.equal(sessionSetCookie("s", "a;b", { secure: false }), undefined);
    assert.equal(sessionSetCookie("s", "", { secure: false }), undefined);
  });

  it("refuses a nonsense max age", () => {
    assert.equal(sessionSetCookie("s", "abc", { secure: false, maxAgeSeconds: 0 }), undefined);
    assert.equal(sessionSetCookie("s", "abc", { secure: false, maxAgeSeconds: -1 }), undefined);
  });

  it("clears with an expired age", () => {
    const cookie = sessionClearCookie("sokoto_cover_session", false);
    assert.ok(cookie.includes("Max-Age=0"));
    assert.ok(cookie.includes("HttpOnly"));
  });
});
