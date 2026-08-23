import * as migration_20260810_000000_add_configurable_content_columns from "./20260810_000000_add_configurable_content_columns";
import * as migration_20260821_000000_add_blog_agent_runtime from "./20260821_000000_add_blog_agent_runtime";
import * as migration_20260823_000000_add_blog_agent_article_packages from "./20260823_000000_add_blog_agent_article_packages";

export const migrations = [
  {
    up: migration_20260810_000000_add_configurable_content_columns.up,
    down: migration_20260810_000000_add_configurable_content_columns.down,
    name: "20260810_000000_add_configurable_content_columns",
  },
  {
    up: migration_20260821_000000_add_blog_agent_runtime.up,
    down: migration_20260821_000000_add_blog_agent_runtime.down,
    name: "20260821_000000_add_blog_agent_runtime",
  },
  {
    up: migration_20260823_000000_add_blog_agent_article_packages.up,
    down: migration_20260823_000000_add_blog_agent_article_packages.down,
    name: "20260823_000000_add_blog_agent_article_packages",
  },
];
