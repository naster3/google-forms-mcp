import { google, type forms_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { GOOGLE_FORMS_API_VERSION } from "../auth/config.js";
import type { GoogleBatchRequest, GoogleForm, GoogleFormResponse } from "../types/google.js";
import { withGoogleRetry } from "./retry.js";

export class GoogleFormsClient {
  private readonly client: forms_v1.Forms;

  public constructor(auth: OAuth2Client) {
    this.client = google.forms({ version: GOOGLE_FORMS_API_VERSION, auth });
  }

  public async getForm(formId: string): Promise<GoogleForm> {
    return withGoogleRetry(async () => {
      const response = await this.client.forms.get({ formId });
      return response.data;
    });
  }

  public async createForm(params: {
    title: string;
    documentTitle?: string;
  }): Promise<GoogleForm> {
    const { title, documentTitle } = params;

    return withGoogleRetry(async () => {
      const response = await this.client.forms.create({
        requestBody: {
          info: {
            title,
            ...(documentTitle !== undefined ? { documentTitle } : {}),
          },
        },
      });

      return response.data;
    });
  }

  public async batchUpdate(
    formId: string,
    requests: GoogleBatchRequest[],
    includeFormInResponse = true,
  ): Promise<forms_v1.Schema$BatchUpdateFormResponse> {
    return withGoogleRetry(async () => {
      const response = await this.client.forms.batchUpdate({
        formId,
        requestBody: {
          includeFormInResponse,
          requests,
        },
      });

      return response.data;
    });
  }

  public async listResponses(
    formId: string,
    pageSize?: number,
    pageToken?: string,
  ): Promise<forms_v1.Schema$ListFormResponsesResponse> {
    return withGoogleRetry(async () => {
      const params: forms_v1.Params$Resource$Forms$Responses$List = { formId };

      if (pageSize !== undefined) {
        params.pageSize = pageSize;
      }

      if (pageToken !== undefined) {
        params.pageToken = pageToken;
      }

      const response = await this.client.forms.responses.list(params);

      return response.data;
    });
  }

  public async getResponse(formId: string, responseId: string): Promise<GoogleFormResponse> {
    return withGoogleRetry(async () => {
      const response = await this.client.forms.responses.get({ formId, responseId });
      return response.data;
    });
  }

  public async setPublishSettings(
    formId: string,
    published: boolean,
  ): Promise<forms_v1.Schema$Form> {
    return withGoogleRetry(async () => {
      const response = await this.client.forms.setPublishSettings({
        formId,
        requestBody: {
          publishSettings: {
            publishState: {
              isPublished: published,
              isAcceptingResponses: published,
            },
          },
        },
      });

      return response.data;
    });
  }
}
