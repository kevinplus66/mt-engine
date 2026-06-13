#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontendRoot = join(repoRoot, "frontend");
const schemaPath = join(repoRoot, "openapi.json");
const expectedPath = join(frontendRoot, "lib/api/generated.ts");
const binName = process.platform === "win32" ? "openapi-typescript.cmd" : "openapi-typescript";
const openApiTypescriptBin = join(frontendRoot, "node_modules/.bin", binName);

function firstDifference(expected, actual) {
  const expectedLines = expected.split("\n");
  const actualLines = actual.split("\n");
  const maxLines = Math.max(expectedLines.length, actualLines.length);

  for (let index = 0; index < maxLines; index += 1) {
    if (expectedLines[index] !== actualLines[index]) {
      return index + 1;
    }
  }

  return 0;
}

if (!existsSync(openApiTypescriptBin)) {
  console.error("openapi-typescript is not installed; run npm ci --prefix frontend first.");
  process.exit(1);
}

const tempDir = await mkdtemp(join(tmpdir(), "mt-engine-openapi-types-"));
const actualPath = join(tempDir, "generated.ts");
let exitCode = 0;


try {
  execFileSync(openApiTypescriptBin, [schemaPath, "-o", actualPath], {
    cwd: frontendRoot,
    stdio: "inherit",
  });

  const [expected, actual] = await Promise.all([
    readFile(expectedPath, "utf8"),
    readFile(actualPath, "utf8"),
  ]);

  if (expected === actual) {
    console.log("frontend/lib/api/generated.ts is up to date");
  } else {
    const line = firstDifference(expected, actual);
    console.error(
      `frontend/lib/api/generated.ts is stale at line ${line}; run npm run generate:api --prefix frontend to regenerate it.`
    );
    exitCode = 1;
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

process.exitCode = exitCode;
