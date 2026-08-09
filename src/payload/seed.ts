import { loadEnvConfig } from "@next/env";
import { getPayload } from "payload";
import config from "../../payload.config";
import { seedDevelopmentContent } from "./seedDevelopmentContent";

loadEnvConfig(process.cwd());

async function seed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development seed is not allowed in production");
  }

  const payload = await getPayload({ config });
  console.log("Seeding reviewed development content...");
  const results = await seedDevelopmentContent(payload);
  results.forEach((result) => console.log(result));
  console.log("✅ Seed complete. Create administrators separately with explicit credentials.");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
