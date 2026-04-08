import { createReadStream } from "node:fs";
import { basename } from "node:path";
import { google, type drive_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { GOOGLE_DRIVE_API_VERSION } from "../auth/config.js";
import { AppError } from "./errors.js";
import { withGoogleRetry } from "./retry.js";

export type ResponderAccessMode = "ANYONE_WITH_LINK" | "RESTRICTED";

export class GoogleDriveClient {
  private readonly client: drive_v3.Drive;

  public constructor(auth: OAuth2Client) {
    this.client = google.drive({ version: GOOGLE_DRIVE_API_VERSION, auth });
  }

  public async getFileMetadata(fileId: string): Promise<drive_v3.Schema$File> {
    return withGoogleRetry(async () => {
      const response = await this.client.files.get({
        fileId,
        fields:
          "id,name,mimeType,owners(emailAddress),permissions(id,emailAddress,role,type,view),resourceKey,webContentLink,webViewLink",
      });

      return response.data;
    });
  }

  public async uploadFile(params: {
    filePath: string;
    mimeType: string;
    name?: string;
  }): Promise<drive_v3.Schema$File> {
    const { filePath, mimeType, name } = params;

    return withGoogleRetry(async () => {
      const response = await this.client.files.create({
        requestBody: {
          name: name ?? basename(filePath),
          mimeType,
        },
        media: {
          mimeType,
          body: createReadStream(filePath),
        },
        fields: "id,name,mimeType,resourceKey,webContentLink,webViewLink",
      });

      return response.data;
    });
  }

  public async ensureAnyoneReader(fileId: string): Promise<void> {
    const response = await withGoogleRetry(async () =>
      this.client.permissions.list({
        fileId,
        fields: "permissions(id,role,type)",
      }),
    );
    const permissions = response.data.permissions ?? [];
    const hasAnyoneReader = permissions.some(
      (permission) => permission.type === "anyone" && permission.role === "reader",
    );

    if (hasAnyoneReader) {
      return;
    }

    await withGoogleRetry(async () => {
      await this.client.permissions.create({
        fileId,
        requestBody: {
          type: "anyone",
          role: "reader",
        },
      });
    });
  }

  public buildPublicDownloadUrl(file: Pick<drive_v3.Schema$File, "id" | "resourceKey">): string {
    if (!file.id) {
      throw new AppError("invalid_drive_file", "Drive file is missing an id.");
    }

    const url = new URL("https://drive.google.com/uc");
    url.searchParams.set("export", "download");
    url.searchParams.set("id", file.id);

    if (file.resourceKey) {
      url.searchParams.set("resourcekey", file.resourceKey);
    }

    return url.toString();
  }

  public async listPublishedPermissions(fileId: string): Promise<drive_v3.Schema$Permission[]> {
    return withGoogleRetry(async () => {
      const response = await this.client.permissions.list({
        fileId,
        fields: "permissions(id,emailAddress,role,type,view)",
        includePermissionsForView: "published",
      });

      return response.data.permissions ?? [];
    });
  }

  public async setResponderAccess(
    fileId: string,
    mode: ResponderAccessMode,
  ): Promise<drive_v3.Schema$Permission[]> {
    const permissions = await this.listPublishedPermissions(fileId);

    if (mode === "ANYONE_WITH_LINK") {
      const hasAnyonePermission = permissions.some(
        (permission) =>
          permission.type === "anyone" &&
          permission.role === "reader" &&
          permission.view === "published",
      );

      if (!hasAnyonePermission) {
        await withGoogleRetry(async () => {
          await this.client.permissions.create({
            fileId,
            requestBody: {
              type: "anyone",
              role: "reader",
              view: "published",
            },
          });
        });
      }
    }

    if (mode === "RESTRICTED") {
      const anyonePermissions = permissions.filter(
        (permission) =>
          permission.id &&
          permission.type === "anyone" &&
          permission.role === "reader" &&
          permission.view === "published",
      );

      await Promise.all(
        anyonePermissions.map((permission) =>
          withGoogleRetry(async () => {
            await this.client.permissions.delete({
              fileId,
              permissionId: permission.id!,
            });
          }),
        ),
      );
    }

    return this.listPublishedPermissions(fileId);
  }
}

export function ensureDriveClient(
  client: GoogleDriveClient | null,
  responderAccess: ResponderAccessMode | undefined,
): GoogleDriveClient | null {
  if (!responderAccess) {
    return client;
  }

  if (!client) {
    throw new AppError(
      "drive_scope_required",
      "Responder access requires Google Drive API scope. Set GOOGLE_INCLUDE_DRIVE_SCOPE=true and re-authorize.",
    );
  }

  return client;
}
