export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getPayload } = await import("payload");
    const { default: config } = await import("./payload.config");
    const payload = await getPayload({ config });

    // Directly push schema to database (bypasses NODE_ENV=production check)
    const { pushDevSchema } = await import("@payloadcms/drizzle");
    await pushDevSchema(payload.db as unknown as Parameters<typeof pushDevSchema>[0]);
    payload.logger.info("Database schema pushed successfully");
  }
}
