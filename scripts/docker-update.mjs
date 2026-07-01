import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const inputArgs = process.argv.slice(2);

function mapPowerShellArgs(args) {
  const mapped = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--service") {
      mapped.push("-Service", args[index + 1] ?? "all");
      index += 1;
      continue;
    }
    if (arg.startsWith("--service=")) {
      mapped.push("-Service", arg.slice("--service=".length));
      continue;
    }
    if (arg === "--no-cache") {
      mapped.push("-NoCache");
      continue;
    }
    if (arg === "--pull") {
      mapped.push("-Pull");
      continue;
    }
    if (arg === "--skip-build") {
      mapped.push("-SkipBuild");
      continue;
    }
    if (arg === "--skip-health-check") {
      mapped.push("-SkipHealthCheck");
      continue;
    }
    if (arg === "--health-timeout") {
      mapped.push("-HealthTimeoutSeconds", args[index + 1] ?? "120");
      index += 1;
      continue;
    }
    if (arg.startsWith("--health-timeout=")) {
      mapped.push("-HealthTimeoutSeconds", arg.slice("--health-timeout=".length));
      continue;
    }

    mapped.push(arg);
  }

  return mapped;
}

const command =
  process.platform === "win32"
    ? {
        file: "powershell",
        args: [
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          join(scriptDir, "docker-update.ps1"),
          ...mapPowerShellArgs(inputArgs),
        ],
      }
    : {
        file: "sh",
        args: [join(scriptDir, "docker-update.sh"), ...inputArgs],
      };

const result = spawnSync(command.file, command.args, { stdio: "inherit" });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
