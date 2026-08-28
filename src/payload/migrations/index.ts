import * as migration_20260810_000000_add_configurable_content_columns from "./20260810_000000_add_configurable_content_columns";
import * as migration_20260810_110000_add_page_views from "./20260810_110000_add_page_views";
import * as migration_20260821_000000_add_blog_agent_runtime from "./20260821_000000_add_blog_agent_runtime";
import * as migration_20260823_000000_add_blog_agent_article_packages from "./20260823_000000_add_blog_agent_article_packages";
import * as migration_20260824_000000_add_blog_agent_github_sources from "./20260824_000000_add_blog_agent_github_sources";
import * as migration_20260826_000000_add_unanswered_agent_questions from "./20260826_000000_add_unanswered_agent_questions";
import * as migration_20260826_010000_add_owner_analytics_fields from "./20260826_010000_add_owner_analytics_fields";
import * as migration_20260827_000000_add_agent_question_log from "./20260827_000000_add_agent_question_log";
import * as migration_20260828_000000_propagate_owner_analytics from "./20260828_000000_propagate_owner_analytics";

export const migrations = [
  {
    up: migration_20260810_000000_add_configurable_content_columns.up,
    down: migration_20260810_000000_add_configurable_content_columns.down,
    name: "20260810_000000_add_configurable_content_columns",
  },
  {
    up: migration_20260810_110000_add_page_views.up,
    down: migration_20260810_110000_add_page_views.down,
    name: "20260810_110000_add_page_views",
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
  {
    up: migration_20260824_000000_add_blog_agent_github_sources.up,
    down: migration_20260824_000000_add_blog_agent_github_sources.down,
    name: "20260824_000000_add_blog_agent_github_sources",
  },
  {
    up: migration_20260826_000000_add_unanswered_agent_questions.up,
    down: migration_20260826_000000_add_unanswered_agent_questions.down,
    name: "20260826_000000_add_unanswered_agent_questions",
  },
  {
    up: migration_20260826_010000_add_owner_analytics_fields.up,
    down: migration_20260826_010000_add_owner_analytics_fields.down,
    name: "20260826_010000_add_owner_analytics_fields",
  },
  {
    up: migration_20260827_000000_add_agent_question_log.up,
    down: migration_20260827_000000_add_agent_question_log.down,
    name: "20260827_000000_add_agent_question_log",
  },
  {
    up: migration_20260828_000000_propagate_owner_analytics.up,
    down: migration_20260828_000000_propagate_owner_analytics.down,
    name: "20260828_000000_propagate_owner_analytics",
  },
];
