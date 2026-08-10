import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/ci-cd.yml"),
  "utf8",
);
const scriptPath = resolve(
  process.cwd(),
  "scripts/verify-nginx-media-upload.sh",
);

const temporaryDirectories: string[] = [];

function writeExecutable(path: string, contents: string) {
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
}

function runProbe(status: string) {
  const root = mkdtempSync(resolve(tmpdir(), "nginx-media-upload-"));
  const binDirectory = resolve(root, "bin");
  const commandLog = resolve(root, "commands.log");
  temporaryDirectories.push(root);
  mkdirSync(binDirectory);

  writeExecutable(
    resolve(binDirectory, "curl"),
    `#!/usr/bin/env bash
set -euo pipefail
resolved=""
body_file=""
noproxy=""
method=""
url=""
while (( $# > 0 )); do
  case "$1" in
    --resolve)
      resolved="\${2:-}"
      shift 2
      ;;
    --data-binary)
      body_file="\${2#@}"
      shift 2
      ;;
    --noproxy)
      noproxy="\${2:-}"
      shift 2
      ;;
    --request)
      method="\${2:-}"
      shift 2
      ;;
    https://*)
      url="$1"
      shift
      ;;
    *)
      shift
      ;;
  esac
done
[[ \${resolved} == "wangjinkun333.me:443:127.0.0.1" ]]
[[ \${noproxy} == "*" ]]
[[ \${method} == "OPTIONS" ]]
[[ \${url} == "https://wangjinkun333.me/api/media" ]]
[[ -f \${body_file} ]]
[[ $(wc -c <"\${body_file}") -eq 409600 ]]
echo "curl probe" >>"\${COMMAND_LOG}"
printf '%s' "\${PROBE_STATUS}"
`,
  );

  const run = () =>
    execFileSync("bash", [scriptPath], {
      env: {
        ...process.env,
        COMMAND_LOG: commandLog,
        PATH: `${binDirectory}:${process.env.PATH ?? ""}`,
        PROBE_STATUS: status,
      },
      stdio: "pipe",
    });

  return { commandLog, run };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("production Nginx media upload probe", () => {
  it("builds after updating the checkout and probes before switching containers", () => {
    const commands = workflow.split("\n").map((line) => line.trim());
    const pullIndex = commands.indexOf("git pull --ff-only origin main");
    const buildIndex = commands.indexOf('"${compose[@]}" build app');
    const probeIndex = commands.indexOf(
      "bash scripts/verify-nginx-media-upload.sh",
    );
    const switchIndex = commands.indexOf('if ! "${compose[@]}" up -d; then');

    expect(pullIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeGreaterThan(pullIndex);
    expect(probeIndex).toBeGreaterThan(buildIndex);
    expect(switchIndex).toBeGreaterThan(probeIndex);
  });

  it("accepts the exact 400 KiB HTTPS media probe", () => {
    const harness = runProbe("200");

    expect(() => harness.run()).not.toThrow();
    expect(readFileSync(harness.commandLog, "utf8")).toBe("curl probe\n");
  });

  it("fails the deployment when the effective media path rejects the probe", () => {
    const harness = runProbe("413");

    expect(harness.run).toThrow();
    expect(readFileSync(harness.commandLog, "utf8")).toBe("curl probe\n");
  });
});
