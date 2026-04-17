import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";

// Relative imports use `.js` extensions (TS-ESM idiom) — required by
// `payload generate:importmap` under Node ESM strict resolution.

// Globals
import Home from "./src/payload/globals/Home.js";
import SiteSettings from "./src/payload/globals/SiteSettings.js";
import About from "./src/payload/globals/About.js";
import Contact from "./src/payload/globals/Contact.js";

// Collections
import Users from "./src/payload/collections/Users.js";
import Projects from "./src/payload/collections/Projects.js";
import Media from "./src/payload/collections/Media.js";
import Blog from "./src/payload/collections/Blog.js";
import Comments from "./src/payload/collections/Comments.js";
import Likes from "./src/payload/collections/Likes.js";

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000",
  admin: {
    user: "users",
    components: {
      beforeNavLinks: ["@/src/payload/components/BackToSite#BackToSite"]
    }
  },
  editor: lexicalEditor(),
  globals: [Home, SiteSettings, About, Contact],
  collections: [Users, Media, Blog, Projects, Comments, Likes],
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
