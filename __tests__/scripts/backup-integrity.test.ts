import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = readFileSync(
  resolve(process.cwd(), "scripts/backup.sh"),
  "utf8",
);

describe("production backup integrity", () => {
  it("validates every archive before atomically publishing the backup", () => {
    const dump = script.indexOf("pg_dump --format=custom");
    const dumpCheck = script.indexOf("pg_restore --list");
    const mediaArchive = script.indexOf("tar -C /app/media -czf - .");
    const mediaCheck = script.indexOf(
      'tar -tzf "$scratch_dir/media.tar.gz"',
    );
    const outerArchive = script.indexOf(
      'tar -C "$scratch_dir" -czf "$temporary_file" .',
    );
    const outerCheck = script.indexOf('tar -tzf "$temporary_file"');
    const publish = script.indexOf('mv -- "$temporary_file" "$backup_file"');

    expect(dump).toBeGreaterThan(-1);
    expect(dumpCheck).toBeGreaterThan(dump);
    expect(mediaArchive).toBeGreaterThan(dumpCheck);
    expect(mediaCheck).toBeGreaterThan(mediaArchive);
    expect(outerArchive).toBeGreaterThan(mediaCheck);
    expect(outerCheck).toBeGreaterThan(outerArchive);
    expect(publish).toBeGreaterThan(outerCheck);
  });
});
