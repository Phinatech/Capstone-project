import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nigerianMobile, smsName } from "./utils/sms.js";

describe("SMS helpers", () => {
  it("accepts Nigerian mobile numbers in their usual forms", () => {
    for (const phone of ["+2348031234567", "2348031234567", "08031234567", "0803 123 4567", "+234 803-123-4567"]) {
      assert.equal(nigerianMobile(phone), "2348031234567", phone);
    }
    assert.equal(nigerianMobile("09151234567"), "2349151234567");
    assert.equal(nigerianMobile("07011234567"), "2347011234567");
  });

  it("rejects numbers that aren't Nigerian mobiles", () => {
    for (const phone of ["+15551234567", "+447911123456", "12345", "06031234567", "080312345678", ""]) {
      assert.equal(nigerianMobile(phone), null, phone);
    }
  });

  it("keeps real names and strips anything that could carry a link", () => {
    assert.equal(smsName("Amina Bello"), "Amina Bello");
    assert.equal(smsName("Hauwa'u Garba-Ali"), "Hauwa'u Garba-Ali");
    assert.equal(smsName("Claim now: http://evil.example/pay!!"), "Claim now httpevilexamplepay");
    assert.equal(smsName("x".repeat(80)).length, 40);
    assert.equal(smsName("!!!"), "a farmer");
    assert.equal(smsName(undefined), "a farmer");
  });
});
