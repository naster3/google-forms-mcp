import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { loadAuthorizedClient } from "../auth/oauth.js";
import { AppError, mapGoogleApiError } from "../google/errors.js";
import { GoogleDriveClient } from "../google/drive-client.js";
import { GoogleFormsClient } from "../google/forms-client.js";
import {
  buildCreateChoiceQuestionRequest,
  buildCreateTextQuestionRequest,
  buildUpdateFormInfoRequests,
  buildUpdateQuestionRequest,
  normalizeFormItems,
  resolveItemIndex,
} from "../tools/helpers.js";
import {
  addCheckboxQuestionInputSchema,
  addMultipleChoiceQuestionInputSchema,
  addTextQuestionInputSchema,
  deleteItemInputSchema,
  setPublishSettingsInputSchema,
  updateFormInfoInputSchema,
  updateQuestionInputSchema,
} from "../tools/schemas.js";
import { loadEnv } from "../utils/env.js";
import { Logger } from "../utils/logger.js";
import { buildHtml } from "./page.js";

const UI_PORT = Number.parseInt(process.env.UI_PORT ?? "3210", 10);

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function getSelectorIndex(form: Awaited<ReturnType<GoogleFormsClient["getForm"]>>, payload: { itemId?: string; currentIndex?: number }): number {
  if (payload.itemId === undefined && payload.currentIndex === undefined) {
    throw new AppError("validation_error", "Provide itemId or currentIndex.");
  }
  const selector =
    payload.itemId !== undefined
      ? { itemId: payload.itemId }
      : { currentIndex: payload.currentIndex as number };
  return resolveItemIndex(form, selector);
}

function buildState(form: Awaited<ReturnType<GoogleFormsClient["getForm"]>>, responses: Awaited<ReturnType<GoogleFormsClient["listResponses"]>>) {
  return {
    formId: form.formId ?? null,
    info: form.info ?? null,
    revisionId: form.revisionId ?? null,
    responderUri: form.responderUri ?? null,
    publishSettings: form.publishSettings ?? null,
    linkedSheetId: form.linkedSheetId ?? null,
    itemCount: form.items?.length ?? 0,
    items: normalizeFormItems(form),
    responses: responses.responses ?? [],
    responseCount: responses.responses?.length ?? 0,
    nextPageToken: responses.nextPageToken ?? null,
  };
}

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = new Logger(env.logLevel);
  const authClient = await loadAuthorizedClient(env, logger);
  const formsClient = new GoogleFormsClient(authClient);
  const driveClient = env.includeDriveScope ? new GoogleDriveClient(authClient) : null;

  const server = createServer(async (request, response) => {
    try {
      const method = request.method ?? "GET";
      const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${UI_PORT}`);

      if (method === "GET" && requestUrl.pathname === "/") {
        response.statusCode = 200;
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(buildHtml());
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/api/form") {
        const formId = requestUrl.searchParams.get("formId")?.trim();
        if (!formId) {
          throw new AppError("validation_error", "formId is required.");
        }
        const [form, responses] = await Promise.all([formsClient.getForm(formId), formsClient.listResponses(formId, 20)]);
        sendJson(response, 200, { ok: true, data: buildState(form, responses) });
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/api/action") {
        const action = await readJsonBody(request) as { type?: string; payload?: unknown };
        if (!action.type) {
          throw new AppError("validation_error", "Action type is required.");
        }
        const formId = ((action.payload as { formId?: string } | undefined)?.formId ?? "").trim();
        switch (action.type) {
          case "update_form_info": {
            const payload = updateFormInfoInputSchema.parse(action.payload);
            await formsClient.batchUpdate(payload.formId, buildUpdateFormInfoRequests(payload.title, payload.description));
            break;
          }
          case "add_text_question": {
            const payload = addTextQuestionInputSchema.parse(action.payload);
            const form = await formsClient.getForm(payload.formId);
            const targetIndex = payload.index ?? (form.items?.length ?? 0);
            await formsClient.batchUpdate(payload.formId, [buildCreateTextQuestionRequest(payload.title, payload.required, targetIndex)]);
            break;
          }
          case "add_multiple_choice_question": {
            const payload = addMultipleChoiceQuestionInputSchema.parse(action.payload);
            const form = await formsClient.getForm(payload.formId);
            const targetIndex = payload.index ?? (form.items?.length ?? 0);
            await formsClient.batchUpdate(payload.formId, [buildCreateChoiceQuestionRequest(payload.title, payload.options, payload.required, targetIndex, "RADIO")]);
            break;
          }
          case "add_checkbox_question": {
            const payload = addCheckboxQuestionInputSchema.parse(action.payload);
            const form = await formsClient.getForm(payload.formId);
            const targetIndex = payload.index ?? (form.items?.length ?? 0);
            await formsClient.batchUpdate(payload.formId, [buildCreateChoiceQuestionRequest(payload.title, payload.options, payload.required, targetIndex, "CHECKBOX")]);
            break;
          }
          case "update_question": {
            const payload = updateQuestionInputSchema.parse(action.payload);
            const form = await formsClient.getForm(payload.formId);
            const targetIndex = getSelectorIndex(form, {
              ...(payload.itemId !== undefined ? { itemId: payload.itemId } : {}),
              ...(payload.currentIndex !== undefined ? { currentIndex: payload.currentIndex } : {}),
            });
            const updates = {
              ...(payload.title !== undefined ? { title: payload.title } : {}),
              ...(payload.description !== undefined ? { description: payload.description } : {}),
              ...(payload.required !== undefined ? { required: payload.required } : {}),
              ...(payload.options !== undefined ? { options: payload.options } : {}),
            };
            await formsClient.batchUpdate(payload.formId, [buildUpdateQuestionRequest(form, targetIndex, updates)]);
            break;
          }
          case "delete_item": {
            const payload = deleteItemInputSchema.parse(action.payload);
            const form = await formsClient.getForm(payload.formId);
            const targetIndex = getSelectorIndex(form, {
              ...(payload.itemId !== undefined ? { itemId: payload.itemId } : {}),
              ...(payload.currentIndex !== undefined ? { currentIndex: payload.currentIndex } : {}),
            });
            await formsClient.batchUpdate(payload.formId, [{ deleteItem: { location: { index: targetIndex } } }]);
            break;
          }
          case "move_item": {
            const payload = action.payload as { formId: string; itemId?: string; currentIndex?: number; newIndex: number };
            const form = await formsClient.getForm(payload.formId);
            const originalIndex = getSelectorIndex(form, {
              ...(payload.itemId !== undefined ? { itemId: payload.itemId } : {}),
              ...(payload.currentIndex !== undefined ? { currentIndex: payload.currentIndex } : {}),
            });
            const itemCount = form.items?.length ?? 0;
            if (payload.newIndex < 0 || payload.newIndex >= itemCount) {
              throw new AppError("invalid_item_index", "The target index is out of range.", { newIndex: payload.newIndex, itemCount });
            }
            await formsClient.batchUpdate(payload.formId, [{ moveItem: { originalLocation: { index: originalIndex }, newLocation: { index: payload.newIndex } } }]);
            break;
          }
          case "set_publish_settings": {
            const payload = setPublishSettingsInputSchema.parse(action.payload);
            await formsClient.setPublishSettings(payload.formId, payload.published);
            if (payload.responderAccess) {
              if (!driveClient) {
                throw new AppError("drive_scope_required", "Responder access requires GOOGLE_INCLUDE_DRIVE_SCOPE=true and re-authorization.");
              }
              await driveClient.setResponderAccess(payload.formId, payload.responderAccess);
            }
            break;
          }
          default:
            throw new AppError("validation_error", "Unsupported action type.");
        }
        if (!formId) {
          throw new AppError("validation_error", "formId is required in payload.");
        }
        const [form, responses] = await Promise.all([formsClient.getForm(formId), formsClient.listResponses(formId, 20)]);
        sendJson(response, 200, { ok: true, data: buildState(form, responses) });
        return;
      }

      response.statusCode = 404;
      response.end("Not found");
    } catch (error) {
      const appError = error instanceof AppError ? error : mapGoogleApiError(error);
      logger.warn("UI request failed.", { code: appError.code, message: appError.message });
      sendJson(response, 400, { ok: false, error: { code: appError.code, message: appError.message, details: appError.details ?? null } });
    }
  });

  server.listen(UI_PORT, "127.0.0.1", () => {
    logger.info("Google Forms UI started.", { url: `http://127.0.0.1:${UI_PORT}`, includeDriveScope: env.includeDriveScope });
    process.stderr.write(`Open http://127.0.0.1:${UI_PORT}\n`);
  });
}

main().catch((error) => {
  const logger = new Logger("error");
  logger.error("Failed to start Google Forms UI.", { error: error instanceof Error ? { name: error.name, message: error.message } : { error } });
  process.exitCode = 1;
});
