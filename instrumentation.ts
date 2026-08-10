export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getPayload } = await import("payload");
    const { default: config } = await import("./payload.config");
    const payload = await getPayload({ config });

    if (process.env.NODE_ENV !== "production") {
      // production 由 bundled migrations 管理；dev push 会写入不兼容 production migration 的标记。
      const { pushDevSchema } = await import("@payloadcms/drizzle");
      await pushDevSchema(
        payload.db as unknown as Parameters<typeof pushDevSchema>[0],
      );
      payload.logger.info("Database schema pushed successfully");
    }
  }
}
