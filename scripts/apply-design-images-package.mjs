import { spawnSync } from "node:child_process";

function runNodeScript(args) {
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runNodeScript(["./node_modules/typescript/bin/tsc", "-p", "tsconfig.json"]);
runNodeScript(["dist/scripts/apply-design-images.js"]);
