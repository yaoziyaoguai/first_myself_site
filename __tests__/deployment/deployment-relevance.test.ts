import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const classifier = resolve(
  process.cwd(),
  "scripts/deployment/should-deploy.sh",
);
const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/ci-cd.yml"),
  "utf8",
);

function shouldDeploy(...paths: string[]) {
  const result = spawnSync("bash", [classifier, ...paths], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  return result.stdout.trim();
}

describe("production deployment relevance", () => {
  it("fails closed when the changed path list is unavailable", () => {
    expect(shouldDeploy()).toBe("true");
  });

  it("skips repository-only documentation and measurement evidence", () => {
    expect(
      shouldDeploy(
        ".claude/user-harness/STATUS.md",
        "docs/blog-agent-operations.md",
        "perf/bench/perf-v2/prod-home.json",
        "README.md",
        "DESIGN.md",
        "TESTING_GUIDE.md",
      ),
    ).toBe("false");
  });

  it("deploys nested markdown outside explicit documentation directories", () => {
    expect(shouldDeploy("src/content/runtime-copy.md")).toBe("true");
  });

  it.each([
    "app/(main)/page.tsx",
    "docker/Dockerfile",
    ".github/workflows/ci-cd.yml",
    "package-lock.json",
    "public/robots.txt",
    "scripts/blog-agent-canary.ts",
  ])("deploys when %s changes", (path) => {
    expect(shouldDeploy("README.md", path)).toBe("true");
  });

  it("classifies the complete delta from the running production revision", () => {
    const mergeIndex = workflow.indexOf("git merge --ff-only FETCH_HEAD");
    const revisionIndex = workflow.indexOf('deployed_revision="$(docker inspect');
    const diffIndex = workflow.indexOf(
      'git diff --name-only "$deployed_revision" "${{ github.sha }}"',
    );
    const classifierIndex = workflow.indexOf(
      'should_deploy="$(bash scripts/deployment/should-deploy.sh "${changed_paths[@]}")"',
    );
    const skipIndex = workflow.indexOf(
      "Skipping production deploy: all changes since $deployed_revision",
    );
    const rollbackTagIndex = workflow.indexOf(
      'docker tag "$previous_image" first_myself_site:rollback',
    );
    const buildIndex = workflow.indexOf("DOCKER_BUILDKIT=1 docker build");

    expect(revisionIndex).toBeGreaterThan(mergeIndex);
    expect(diffIndex).toBeGreaterThan(revisionIndex);
    expect(classifierIndex).toBeGreaterThan(diffIndex);
    expect(skipIndex).toBeGreaterThan(classifierIndex);
    expect(rollbackTagIndex).toBeGreaterThan(skipIndex);
    expect(buildIndex).toBeGreaterThan(skipIndex);
    expect(workflow).toContain("git merge-base --is-ancestor");
  });
});
