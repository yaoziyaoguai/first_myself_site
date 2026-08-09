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
import Comments from "./src/payload/collections/Comments";
import Likes from "./src/payload/collections/Likes";

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
      connectionString: (() => {
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
          throw new Error("DATABASE_URL environment variable is required");
        }
        return databaseUrl;
      })(),
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
