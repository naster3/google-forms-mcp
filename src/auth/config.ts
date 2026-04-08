export const GOOGLE_FORMS_API_VERSION = "v1";
export const GOOGLE_DRIVE_API_VERSION = "v3";

export const GOOGLE_SCOPES = {
  formsBody: "https://www.googleapis.com/auth/forms.body",
  formsResponsesReadonly: "https://www.googleapis.com/auth/forms.responses.readonly",
  drive: "https://www.googleapis.com/auth/drive",
} as const;

export function buildOAuthScopes(includeDriveScope: boolean): string[] {
  const scopes: string[] = [GOOGLE_SCOPES.formsBody, GOOGLE_SCOPES.formsResponsesReadonly];

  if (includeDriveScope) {
    scopes.push(GOOGLE_SCOPES.drive);
  }

  return scopes;
}
