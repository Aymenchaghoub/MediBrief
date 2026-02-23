import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { isHttpsRequest, shouldRejectInsecureRequest, validateCorsOrigin } from "./security.middleware";

function makeReq(input: Partial<Request>) {
  return input as Request;
}

describe("security middleware helpers", () => {
  it("detects https via secure flag", () => {
    const req = makeReq({ secure: true, headers: {} });
    expect(isHttpsRequest(req)).toBe(true);
  });

  it("detects https via x-forwarded-proto header", () => {
    const req = makeReq({ secure: false, headers: { "x-forwarded-proto": "https" } });
    expect(isHttpsRequest(req)).toBe(true);
  });

  it("rejects only when https is required in production and request is insecure", () => {
    expect(
      shouldRejectInsecureRequest({
        requireHttps: true,
        nodeEnv: "production",
        isHttps: false,
      }),
    ).toBe(true);

    expect(
      shouldRejectInsecureRequest({
        requireHttps: false,
        nodeEnv: "production",
        isHttps: false,
      }),
    ).toBe(false);

    expect(
      shouldRejectInsecureRequest({
        requireHttps: true,
        nodeEnv: "development",
        isHttps: false,
      }),
    ).toBe(false);
  });
});

describe("validateCorsOrigin", () => {
  it("allows any origin in development", () => {
    expect(validateCorsOrigin("http://localhost:3000", "development")).toBe(true);
    expect(validateCorsOrigin("http://127.0.0.1:3000", "development")).toBe(true);
  });

  it("rejects localhost origins in production", () => {
    expect(validateCorsOrigin("http://localhost:3000", "production")).toBe(false);
    expect(validateCorsOrigin("http://127.0.0.1:3000", "production")).toBe(false);
    expect(validateCorsOrigin("http://0.0.0.0:3000", "production")).toBe(false);
  });

  it("allows non-localhost origins in production", () => {
    expect(validateCorsOrigin("https://app.medibrief.com", "production")).toBe(true);
    expect(validateCorsOrigin("https://clinic.example.org", "production")).toBe(true);
  });
});
