import { describe, expect, it } from "vitest";

import payloadConfig from "../../payload.config";

describe("Payload admin avatar", () => {
  it("uses the local account icon instead of requesting Gravatar", async () => {
    const config = await payloadConfig;

    expect(config.admin.avatar).toBe("default");
  });
});
