import { GoogleDriveClient } from "../google/drive-client.js";
import { GoogleFormsClient } from "../google/forms-client.js";
import type { AppEnv } from "../utils/env.js";
import type { Logger } from "../utils/logger.js";

export type AppContext = {
  env: AppEnv;
  logger: Logger;
  formsClient: GoogleFormsClient;
  driveClient: GoogleDriveClient | null;
};
