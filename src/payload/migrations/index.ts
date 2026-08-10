import * as migration_20260810_000000_add_configurable_content_columns from "./20260810_000000_add_configurable_content_columns";
import * as migration_20260810_110000_add_page_views from "./20260810_110000_add_page_views";

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
];
