import { afterEach, describe, expect, it, vi } from "vitest";

const { getPayload, pushDevSchema } = vi.hoisted(() => ({
  getPayload: vi.fn(),
  pushDevSchema: vi.fn(),
}));

vi.mock("payload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("payload")>()),
  getPayload,
}));

vi.mock("@payloadcms/drizzle", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@payloadcms/drizzle")>()),
  pushDevSchema,
}));

import { register } from "../../instrumentation";

describe("Payload instrumentation schema initialization", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("leaves production schema changes to bundled migrations", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "production");
    getPayload.mockResolvedValue({
      db: {},
      logger: { info: vi.fn() },
    });

    await register();

    expect(getPayload).toHaveBeenCalledOnce();
    expect(pushDevSchema).not.toHaveBeenCalled();
  });

  it("preserves the explicit schema push outside production", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "development");
    const payload = {
      db: {},
      logger: { info: vi.fn() },
    };
    getPayload.mockResolvedValue(payload);

    await register();

    expect(pushDevSchema).toHaveBeenCalledWith(payload.db);
    expect(payload.logger.info).toHaveBeenCalledWith(
      "Database schema pushed successfully",
    );
  });
});
