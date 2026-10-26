import { existsSync } from "node:fs";

type ProcessWithEnvFile = NodeJS.Process & {
  loadEnvFile?: (path?: string) => void;
};

const proc = process as ProcessWithEnvFile;

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) {
    proc.loadEnvFile?.(file);
  }
}
