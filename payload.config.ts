import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";

// Globals
import Home from "./src/payload/globals/Home";
import SiteSettings from "./src/payload/globals/SiteSettings";
import About from "./src/payload/globals/About";
import Contact from "./src/payload/globals/Contact";

// Collections
import Users from "./src/payload/collections/Users";
import Projects from "./src/payload/collections/Projects";
import Media from "./src/payload/collections/Media";
import Blog from "./src/payload/collections/Blog";

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000",
  admin: {
    user: "users",
  },
  editor: lexicalEditor(),
  globals: [Home, SiteSettings, About, Contact],
  collections: [Users, Media, Blog, Projects],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || "postgresql://payload:payload_secret_2026@localhost:5432/first_myself_site",
    },
  }),
  secret: (() => {
    const secret = process.env.PAYLOAD_SECRET;
    if (!secret) {
      throw new Error(
        'PAYLOAD_SECRET environment variable is required. ' +
        'Generate a random string with: openssl rand -base64 32'
      );
    }
    return secret;
  })(),
});
