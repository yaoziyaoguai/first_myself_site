import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { validateRequiredEnvVars } from "@/lib/env";

// Globals
import Home from "./src/payload/globals/Home";
import SiteSettings from "./src/payload/globals/SiteSettings";
import About from "./src/payload/globals/About";
import Contact from "./src/payload/globals/Contact";
import { backfillConfigurableContent } from "./src/payload/migrations/backfillConfigurableContent";
import { migrations as prodMigrations } from "./src/payload/migrations";

// Collections
import Users from "./src/payload/collections/Users";
import Projects from "./src/payload/collections/Projects";
import Media from "./src/payload/collections/Media";
import Blog from "./src/payload/collections/Blog";
import Comments from "./src/payload/collections/Comments";
import Likes from "./src/payload/collections/Likes";

validateRequiredEnvVars();

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000",
  admin: {
    user: "users",
    components: {
      beforeNavLinks: ["@/payload/components/BackToSite#BackToSite"]
    }
  },
  editor: lexicalEditor(),
  globals: [Home, SiteSettings, About, Contact],
  collections: [Users, Media, Blog, Projects, Comments, Likes],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL!,
    },
    prodMigrations,
  }),
  secret: process.env.PAYLOAD_SECRET!,
  onInit: async (payload) => {
    const changed = await backfillConfigurableContent(payload);
    if (changed) {
      payload.logger.info("Configurable site content initialized");
    }
  },
});
