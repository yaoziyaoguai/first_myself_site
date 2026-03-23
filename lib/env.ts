/**
 * Environment variable validation
 * Ensures all required environment variables are set at runtime
 */

export function validateRequiredEnvVars() {
  const required = ["PAYLOAD_SECRET"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

export function validateDevEnvVars() {
  if (process.env.NODE_ENV !== "production") {
    const required = ["ADMIN_SECRET_TOKEN"];
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      console.warn(`⚠️  Development environment missing: ${missing.join(", ")}`);
      console.warn("Development endpoints (/api/seed, /api/create-admin) will not be accessible");
    }
  }
}

export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

export function getOptionalEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}
