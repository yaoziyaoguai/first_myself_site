import * as migration_20260810_000000_add_configurable_content_columns from "./20260810_000000_add_configurable_content_columns";

export const migrations = [
  {
    up: migration_20260810_000000_add_configurable_content_columns.up,
    down: migration_20260810_000000_add_configurable_content_columns.down,
    name: "20260810_000000_add_configurable_content_columns",
  },
];
