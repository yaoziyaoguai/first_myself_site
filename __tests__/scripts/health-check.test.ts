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

const scriptPath = resolve(process.cwd(), "scripts/health-check.sh");
const script = readFileSync(scriptPath, "utf8");
const temporaryDirectories: string[] = [];

function writeExecutable(path: string, contents: string) {
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
}

function runHealthCheck() {
  const root = mkdtempSync(resolve(tmpdir(), "production-health-check-"));
  const projectDirectory = resolve(root, "project");
  const binDirectory = resolve(root, "bin");
  const commandLog = resolve(root, "commands.log");
  temporaryDirectories.push(root);
  mkdirSync(resolve(projectDirectory, "docker"), { recursive: true });
  mkdirSync(binDirectory);
  writeFileSync(resolve(projectDirectory, ".env.docker.prod"), "POSTGRES_DB=test\n");
  writeFileSync(resolve(projectDirectory, "docker/docker-compose.prod.yml"), "services: {}\n");

  writeExecutable(
    resolve(binDirectory, "curl"),
    `#!/usr/bin/env bash
set -euo pipefail
resolved=""
noproxy=""
url=""
while (( $# > 0 )); do
  case "$1" in
    --resolve)
      resolved="\${2:-}"
      shift 2
      ;;
    --noproxy)
      noproxy="\${2:-}"
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
printf 'resolve=%s noproxy=%s url=%s\n' "$resolved" "$noproxy" "$url" >>"$COMMAND_LOG"
[[ "$resolved" == "wangjinkun333.me:443:127.0.0.1" ]]
[[ "$noproxy" == "*" ]]
[[ "$url" == "https://wangjinkun333.me/api/health" ]]
printf '{"status":"ok"}'
`,
  );
  writeExecutable(
    resolve(binDirectory, "docker"),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == *"ps --status unhealthy --quiet"* ]]; then
  exit 0
fi
printf 'NAME STATUS\napp running\n'
`,
  );
  writeExecutable(
    resolve(binDirectory, "openssl"),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "s_client" ]]; then
  printf 'openssl=%s\n' "$*" >>"$COMMAND_LOG"
  [[ "$*" == "s_client -servername wangjinkun333.me -connect 127.0.0.1:443" ]]
  cat >/dev/null
  printf 'fake certificate\n'
elif [[ "$*" == *"-enddate"* ]]; then
  printf 'notAfter=Oct 30 00:00:00 2026 GMT\n'
elif [[ "$*" == *"-checkend"* ]]; then
  exit 0
else
  exit 1
fi
`,
  );
  writeExecutable(resolve(binDirectory, "df"), "#!/usr/bin/env bash\nprintf 'disk ok\\n'\n");

  const run = () =>
    execFileSync("bash", [scriptPath], {
      env: {
        ...process.env,
        COMMAND_LOG: commandLog,
        PATH: `${binDirectory}:${process.env.PATH ?? ""}`,
        PROJECT_DIR: projectDirectory,
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

describe("production TLS health check", () => {
  it("checks the effective local Nginx TLS route without traversing the public security layer", () => {
    const harness = runHealthCheck();

    expect(() => harness.run()).not.toThrow();
    expect(readFileSync(harness.commandLog, "utf8")).toBe(
      "resolve=wangjinkun333.me:443:127.0.0.1 noproxy=* url=https://wangjinkun333.me/api/health\n" +
        "openssl=s_client -servername wangjinkun333.me -connect 127.0.0.1:443\n",
    );
  });

  it("uses a validated configurable 21-day renewal window", () => {
    expect(script).toContain(
      'TLS_MIN_VALID_DAYS="${TLS_MIN_VALID_DAYS:-21}"',
    );
    expect(script).toContain(
      '[[ ! "$TLS_MIN_VALID_DAYS" =~ ^[1-9][0-9]*$ ]]',
    );
    expect(script).toContain(
      "tls_check_seconds=$((TLS_MIN_VALID_DAYS * 86400))",
    );
    expect(script).toContain(
      "openssl x509 -checkend \"$tls_check_seconds\" -noout",
    );
    expect(script).toContain("expires within $TLS_MIN_VALID_DAYS days");
  });
});
