import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Credentials } from "google-auth-library";

export class TokenStore {
  public constructor(private readonly tokenPath: string) {}

  public get absolutePath(): string {
    return resolve(this.tokenPath);
  }

  public async load(): Promise<Credentials | null> {
    try {
      const raw = await readFile(this.absolutePath, "utf8");
      return JSON.parse(raw) as Credentials;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  public async save(credentials: Credentials): Promise<void> {
    await mkdir(dirname(this.absolutePath), { recursive: true });
    await writeFile(this.absolutePath, JSON.stringify(credentials, null, 2), "utf8");

    try {
      await chmod(this.absolutePath, 0o600);
    } catch {
      // Windows may not support POSIX chmod semantics. Best effort only.
    }
  }
}
