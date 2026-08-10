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
  "scripts/configure-nginx-upload-limit.sh",
);

const temporaryDirectories: string[] = [];

interface Harness {
  activeLimitMarker: string;
  commandLog: string;
  configDirectory: string;
  nginxFailureMarker: string;
  probeAlwaysRejectMarker: string;
  reloadFailureMarker: string;
  target: string;
  run: () => void;
}

function writeExecutable(path: string, contents: string) {
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
}

function createHarness(): Harness {
  const root = mkdtempSync(resolve(tmpdir(), "nginx-upload-limit-"));
  const binDirectory = resolve(root, "bin");
  const configDirectory = resolve(root, "conf.d");
  const commandLog = resolve(root, "commands.log");
  const activeLimitMarker = resolve(root, "limit-active");
  const probeAlwaysRejectMarker = resolve(root, "probe-always-rejects");
  const reloadFailureMarker = resolve(root, "reload-fails-once");
  const nginxFailureMarker = resolve(root, "nginx-fails-once");
  const target = resolve(configDirectory, "first_myself_site_uploads.conf");

  temporaryDirectories.push(root);
  mkdirSync(binDirectory);
  mkdirSync(configDirectory);

  writeExecutable(
    resolve(binDirectory, "sudo"),
    `#!/usr/bin/env bash
set -euo pipefail
[[ \${1:-} == "-n" ]] && shift
exec "$@"
`,
  );
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
[[ $(wc -c <"\${body_file}") -eq 22020096 ]]
echo "curl probe" >>"\${COMMAND_LOG}"
if [[ -f \${ACTIVE_LIMIT_MARKER} && ! -f \${PROBE_ALWAYS_REJECT_MARKER} ]]; then
  printf '200'
else
  printf '413'
fi
`,
  );
  writeExecutable(
    resolve(binDirectory, "nginx"),
    `#!/usr/bin/env bash
set -euo pipefail
echo "nginx $*" >>"\${COMMAND_LOG}"
if [[ -n \${NGINX_FAILURE_MARKER:-} && -f \${NGINX_FAILURE_MARKER} ]]; then
  rm -f "\${NGINX_FAILURE_MARKER}"
  exit 1
fi
`,
  );
  writeExecutable(
    resolve(binDirectory, "systemctl"),
    `#!/usr/bin/env bash
set -euo pipefail
echo "systemctl $*" >>"\${COMMAND_LOG}"
if [[ -n \${RELOAD_FAILURE_MARKER:-} && -f \${RELOAD_FAILURE_MARKER} ]]; then
  rm -f "\${RELOAD_FAILURE_MARKER}"
  exit 1
fi
if [[ -f \${MANAGED_TARGET} ]] && grep -qx 'client_max_body_size 25m;' "\${MANAGED_TARGET}"; then
  touch "\${ACTIVE_LIMIT_MARKER}"
else
  rm -f "\${ACTIVE_LIMIT_MARKER}"
fi
`,
  );

  return {
    activeLimitMarker,
    commandLog,
    configDirectory,
    nginxFailureMarker,
    probeAlwaysRejectMarker,
    reloadFailureMarker,
    target,
    run: () =>
      execFileSync("bash", [scriptPath], {
        env: {
          ...process.env,
          ACTIVE_LIMIT_MARKER: activeLimitMarker,
          COMMAND_LOG: commandLog,
          MANAGED_TARGET: target,
          NGINX_CONF_DIR: configDirectory,
          NGINX_FAILURE_MARKER: nginxFailureMarker,
          PATH: `${binDirectory}:${process.env.PATH ?? ""}`,
          PROBE_ALWAYS_REJECT_MARKER: probeAlwaysRejectMarker,
          RELOAD_FAILURE_MARKER: reloadFailureMarker,
        },
        stdio: "pipe",
      }),
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function shellTest(name: string, test: () => void) {
  it(name, test, 15_000);
}

describe("production Nginx upload limit", () => {
  it("builds after updating the checkout and then configures Nginx", () => {
    const commands = workflow.split("\n").map((line) => line.trim());
    const pullIndex = commands.indexOf("git pull --ff-only origin main");
    const nginxIndex = commands.indexOf(
      "bash scripts/configure-nginx-upload-limit.sh",
    );
    const buildIndex = commands.indexOf('"${compose[@]}" build app');

    expect(pullIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeGreaterThan(pullIndex);
    expect(nginxIndex).toBeGreaterThan(buildIndex);
  });

  shellTest("installs a 25 MiB limit and verifies the effective HTTPS path", () => {
    const harness = createHarness();

    harness.run();

    expect(readFileSync(harness.target, "utf8")).toBe(
      "client_max_body_size 25m;\n",
    );
    expect(readFileSync(harness.commandLog, "utf8")).toBe(
      "curl probe\nnginx -t\nsystemctl reload nginx\ncurl probe\n",
    );
  });

  shellTest("skips privileged host changes when the upload path already works", () => {
    const harness = createHarness();
    writeFileSync(harness.activeLimitMarker, "active");

    harness.run();

    expect(() => readFileSync(harness.target, "utf8")).toThrow();
    expect(readFileSync(harness.commandLog, "utf8")).toBe("curl probe\n");
  });

  shellTest("rolls back a failed reload and allows the deployment to retry", () => {
    const harness = createHarness();
    writeFileSync(harness.reloadFailureMarker, "fail once");

    expect(harness.run).toThrow();
    expect(() => readFileSync(harness.target, "utf8")).toThrow();

    harness.run();

    expect(readFileSync(harness.commandLog, "utf8")).toBe(
      "curl probe\nnginx -t\nsystemctl reload nginx\nnginx -t\n" +
        "systemctl reload nginx\n" +
        "curl probe\nnginx -t\nsystemctl reload nginx\ncurl probe\n",
    );
  });

  shellTest("removes a new config when the effective HTTPS path still rejects it", () => {
    const harness = createHarness();
    writeFileSync(harness.probeAlwaysRejectMarker, "reject");

    expect(harness.run).toThrow();

    expect(() => readFileSync(harness.target, "utf8")).toThrow();
    expect(readFileSync(harness.commandLog, "utf8")).toBe(
      "curl probe\nnginx -t\nsystemctl reload nginx\ncurl probe\n" +
        "nginx -t\nsystemctl reload nginx\n",
    );
  });

  shellTest("restores the previous config when its effective probe fails", () => {
    const harness = createHarness();
    const oldConfig = "client_max_body_size 5m;\n";
    writeFileSync(harness.target, oldConfig);
    writeFileSync(harness.probeAlwaysRejectMarker, "reject");

    expect(harness.run).toThrow();

    expect(readFileSync(harness.target, "utf8")).toBe(oldConfig);
    expect(readFileSync(harness.commandLog, "utf8")).toBe(
      "curl probe\nnginx -t\nsystemctl reload nginx\ncurl probe\n" +
        "nginx -t\nsystemctl reload nginx\n",
    );
  });

  shellTest("restores the previous config when Nginx validation fails", () => {
    const harness = createHarness();
    const oldConfig = "client_max_body_size 5m;\n";
    writeFileSync(harness.target, oldConfig);
    writeFileSync(harness.nginxFailureMarker, "fail once");

    expect(harness.run).toThrow();

    expect(readFileSync(harness.target, "utf8")).toBe(oldConfig);
    expect(readFileSync(harness.commandLog, "utf8")).toBe(
      "curl probe\nnginx -t\nnginx -t\n",
    );
  });

  shellTest("removes a new config when its first validation fails", () => {
    const harness = createHarness();
    writeFileSync(harness.nginxFailureMarker, "fail once");

    expect(harness.run).toThrow();

    expect(() => readFileSync(harness.target, "utf8")).toThrow();
    expect(readFileSync(harness.commandLog, "utf8")).toBe(
      "curl probe\nnginx -t\nnginx -t\n",
    );
  });
});
