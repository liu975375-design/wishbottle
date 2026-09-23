import { beforeEach, describe, expect, it } from "vitest";

import {
  createReturnSessionValue,
  generateReturnToken,
  hashReturnToken,
  verifyReturnSessionValue,
} from "../lib/return-session";

describe("Return token and session security", () => {
  beforeEach(() => {
    process.env.RETURN_SESSION_SECRET = "test-return-session-secret";
  });

  it("generates unpredictable tokens and hashes them deterministically", () => {
    const firstToken = generateReturnToken();
    const secondToken = generateReturnToken();

    expect(firstToken).not.toBe(secondToken);
    expect(hashReturnToken(firstToken)).toBe(hashReturnToken(firstToken));
    expect(hashReturnToken(firstToken)).not.toBe(firstToken);
  });

  it("creates a verifiable signed return session", () => {
    const value = createReturnSessionValue("wish-id", "reminder-id");

    expect(verifyReturnSessionValue(value)).toMatchObject({
      wishId: "wish-id",
      reminderId: "reminder-id",
    });
  });

  it("rejects a tampered return session", () => {
    const value = createReturnSessionValue("wish-id", null);
    const tampered = `${value.slice(0, -1)}x`;

    expect(verifyReturnSessionValue(tampered)).toBeNull();
  });
});
