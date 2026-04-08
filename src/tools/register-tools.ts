import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureDriveClient } from "../google/drive-client.js";
import { AppError, mapGoogleApiError } from "../google/errors.js";
import type { AppContext } from "../mcp/context.js";
import { errorResult, successResult } from "../mcp/response.js";
import {
  buildCreateImageItemRequest,
  buildCreateChoiceQuestionRequest,
  buildCreateParagraphQuestionRequest,
  buildCreateSectionRequest,
  buildCreateTextQuestionRequest,
  buildUpdateFormInfoRequests,
  buildUpdateImageItemRequest,
  buildUpdateQuestionRequest,
  buildUpdateQuestionImageRequest,
  buildUpdateSectionRequest,
  normalizeFormItems,
  resolveItemIndex,
  type ChoiceOptionInput,
} from "./helpers.js";
import {
  addImageItemInputSchema,
  addCheckboxQuestionInputSchema,
  addDropdownQuestionInputSchema,
  addMultipleChoiceQuestionInputSchema,
  addParagraphQuestionInputSchema,
  addSectionInputSchema,
  addTextQuestionInputSchema,
  createFormInputSchema,
  deleteItemInputSchema,
  getFormInputSchema,
  getResponseInputSchema,
  listItemsInputSchema,
  listResponsesInputSchema,
  moveItemInputSchema,
  setPublishSettingsInputSchema,
  setQuestionImageInputSchema,
  updateFormInfoInputSchema,
  updateImageItemInputSchema,
  updateQuestionInputSchema,
  updateSectionInputSchema,
} from "./schemas.js";

async function executeTool<TInput, TOutput>(
  rawInput: unknown,
  schema: z.ZodType<TInput>,
  handler: (input: TInput) => Promise<TOutput>,
) {
  try {
    const input = schema.parse(rawInput);
    const result = await handler(input);
    return successResult(result);
  } catch (error) {
    const appError =
      error instanceof AppError
        ? error
        : error instanceof z.ZodError
          ? new AppError("validation_error", "Tool input validation failed.", {
              issues: error.issues,
            })
          : mapGoogleApiError(error);

    return errorResult(appError);
  }
}

function toChoiceOptionInputs(
  options: string[],
  includeOther: boolean | undefined,
  optionNavigation:
    | Array<{
        optionValue: string;
        goToSectionId?: string | undefined;
        goToAction?: "NEXT_SECTION" | "RESTART_FORM" | "SUBMIT_FORM" | undefined;
      }>
    | undefined,
): ChoiceOptionInput[] {
  const navigationMap = new Map(
    (optionNavigation ?? []).map((navigation) => [navigation.optionValue, navigation]),
  );
  const resolvedOptions: ChoiceOptionInput[] = options.map((value) => {
    const navigation = navigationMap.get(value);
    return {
      value,
      ...(navigation?.goToSectionId !== undefined
        ? { goToSectionId: navigation.goToSectionId }
        : {}),
      ...(navigation?.goToAction !== undefined ? { goToAction: navigation.goToAction } : {}),
    };
  });

  if (includeOther) {
    resolvedOptions.push({ isOther: true });
  }

  return resolvedOptions;
}

export function registerTools(server: McpServer, context: AppContext): void {
  const readOnlyAnnotations = { readOnlyHint: true, openWorldHint: true };
  const writeAnnotations = { readOnlyHint: false, openWorldHint: true };
  const destructiveAnnotations = {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
  };

  server.tool(
    "create_form",
    "Create a new empty Google Form. Optionally set the Drive document title and form description during setup.",
    createFormInputSchema.shape,
    writeAnnotations,
    async (input) =>
      executeTool(input, createFormInputSchema, async ({ title, documentTitle, description }) => {
        const createdForm = await context.formsClient.createForm({
          title,
          ...(documentTitle !== undefined ? { documentTitle } : {}),
        });

        const createdFormId = createdForm.formId;

        if (!createdFormId) {
          throw new AppError(
            "google_api_error",
            "Google Forms API did not return a formId for the created form.",
          );
        }

        const finalForm =
          description !== undefined
            ? (
                await context.formsClient.batchUpdate(
                  createdFormId,
                  buildUpdateFormInfoRequests(undefined, description),
                )
              ).form ?? (await context.formsClient.getForm(createdFormId))
            : createdForm;

        return {
          formId: finalForm.formId ?? createdFormId,
          info: finalForm.info ?? null,
          responderUri: finalForm.responderUri ?? null,
          revisionId: finalForm.revisionId ?? null,
          publishSettings: finalForm.publishSettings ?? null,
          itemCount: finalForm.items?.length ?? 0,
          items: normalizeFormItems(finalForm),
        };
      }),
  );

  server.tool(
    "get_form",
    "Fetch form metadata, publish settings, responder URL, and normalized items for a Google Form.",
    getFormInputSchema.shape,
    readOnlyAnnotations,
    async (input) =>
      executeTool(input, getFormInputSchema, async ({ formId }) => {
        const form = await context.formsClient.getForm(formId);

        return {
          formId: form.formId ?? formId,
          info: form.info ?? null,
          revisionId: form.revisionId ?? null,
          responderUri: form.responderUri ?? null,
          linkedSheetId: form.linkedSheetId ?? null,
          publishSettings: form.publishSettings ?? null,
          itemCount: form.items?.length ?? 0,
          items: normalizeFormItems(form),
        };
      }),
  );

  server.registerTool(
    "update_form_info",
    {
      title: "Update Form Info",
      description:
        "Update the form title and/or description. Use this when changing top-level form metadata, not individual questions.",
      inputSchema: updateFormInfoInputSchema,
      annotations: writeAnnotations,
    },
    async (input: unknown) =>
      executeTool(input, updateFormInfoInputSchema, async ({ formId, title, description }) => {
        const response = await context.formsClient.batchUpdate(
          formId,
          buildUpdateFormInfoRequests(title, description),
        );
        const form = response.form;

        return {
          formId,
          updated: {
            title: form?.info?.title ?? title ?? null,
            description: form?.info?.description ?? description ?? null,
          },
          revisionId: form?.revisionId ?? null,
        };
      }),
  );

  server.tool(
    "list_items",
    "List all form items in a normalized, agent-friendly structure with indexes, itemIds, question types, and options.",
    listItemsInputSchema.shape,
    readOnlyAnnotations,
    async (input) =>
      executeTool(input, listItemsInputSchema, async ({ formId }) => {
        const form = await context.formsClient.getForm(formId);

        return {
          formId,
          itemCount: form.items?.length ?? 0,
          items: normalizeFormItems(form),
        };
      }),
  );

  server.tool(
    "add_image_item",
    "Insert a standalone image block into the form. Use this for banners, separators, references, or visual examples between questions.",
    addImageItemInputSchema.shape,
    writeAnnotations,
    async (input) =>
      executeTool(
        input,
        addImageItemInputSchema,
        async ({ formId, title, description, imageUrl, altText, width, alignment, index }) => {
          const form = await context.formsClient.getForm(formId);
          const targetIndex = index ?? (form.items?.length ?? 0);
          const response = await context.formsClient.batchUpdate(formId, [
            buildCreateImageItemRequest(
              {
                sourceUri: imageUrl,
                ...(altText !== undefined ? { altText } : {}),
                ...(width !== undefined ? { width } : {}),
                ...(alignment !== undefined ? { alignment } : {}),
              },
              targetIndex,
              title,
              description,
            ),
          ]);

          return {
            formId,
            insertedIndex: targetIndex,
            itemCount: response.form?.items?.length ?? null,
            items: response.form ? normalizeFormItems(response.form) : null,
          };
        },
      ),
  );

  server.tool(
    "add_text_question",
    "Add a short-answer text question to the form.",
    addTextQuestionInputSchema.shape,
    writeAnnotations,
    async (input) =>
      executeTool(
        input,
        addTextQuestionInputSchema,
        async ({ formId, title, description, required, index }) => {
          const form = await context.formsClient.getForm(formId);
          const targetIndex = index ?? (form.items?.length ?? 0);
          const response = await context.formsClient.batchUpdate(formId, [
            buildCreateTextQuestionRequest(title, required, targetIndex, description),
          ]);

          return {
            formId,
            insertedIndex: targetIndex,
            itemCount: response.form?.items?.length ?? null,
            items: response.form ? normalizeFormItems(response.form) : null,
          };
        },
      ),
  );

  server.tool(
    "add_paragraph_question",
    "Add a long-answer paragraph question to the form.",
    addParagraphQuestionInputSchema.shape,
    writeAnnotations,
    async (input) =>
      executeTool(
        input,
        addParagraphQuestionInputSchema,
        async ({ formId, title, description, required, index }) => {
          const form = await context.formsClient.getForm(formId);
          const targetIndex = index ?? (form.items?.length ?? 0);
          const response = await context.formsClient.batchUpdate(formId, [
            buildCreateParagraphQuestionRequest(title, required, targetIndex, description),
          ]);

          return {
            formId,
            insertedIndex: targetIndex,
            itemCount: response.form?.items?.length ?? null,
            items: response.form ? normalizeFormItems(response.form) : null,
          };
        },
      ),
  );

  server.tool(
    "add_multiple_choice_question",
    "Add a single-select multiple-choice question. Supports optional native 'Other' choice.",
    addMultipleChoiceQuestionInputSchema.shape,
    writeAnnotations,
    async (input) =>
      executeTool(
        input,
        addMultipleChoiceQuestionInputSchema,
        async ({ formId, title, description, options, includeOther, required, index }) => {
          const form = await context.formsClient.getForm(formId);
          const targetIndex = index ?? (form.items?.length ?? 0);
          const response = await context.formsClient.batchUpdate(formId, [
            buildCreateChoiceQuestionRequest(
              title,
              toChoiceOptionInputs(options, includeOther, undefined),
              required,
              targetIndex,
              "RADIO",
              description,
            ),
          ]);

          return {
            formId,
            insertedIndex: targetIndex,
            itemCount: response.form?.items?.length ?? null,
            items: response.form ? normalizeFormItems(response.form) : null,
          };
        },
      ),
  );

  server.tool(
    "add_checkbox_question",
    "Add a multi-select checkbox question. Supports optional native 'Other' choice.",
    addCheckboxQuestionInputSchema.shape,
    writeAnnotations,
    async (input) =>
      executeTool(
        input,
        addCheckboxQuestionInputSchema,
        async ({ formId, title, description, options, includeOther, required, index }) => {
          const form = await context.formsClient.getForm(formId);
          const targetIndex = index ?? (form.items?.length ?? 0);
          const response = await context.formsClient.batchUpdate(formId, [
            buildCreateChoiceQuestionRequest(
              title,
              toChoiceOptionInputs(options, includeOther, undefined),
              required,
              targetIndex,
              "CHECKBOX",
              description,
            ),
          ]);

          return {
            formId,
            insertedIndex: targetIndex,
            itemCount: response.form?.items?.length ?? null,
            items: response.form ? normalizeFormItems(response.form) : null,
          };
        },
      ),
  );

  server.tool(
    "add_dropdown_question",
    "Add a dropdown question for compact single-select choices.",
    addDropdownQuestionInputSchema.shape,
    writeAnnotations,
    async (input) =>
      executeTool(
        input,
        addDropdownQuestionInputSchema,
        async ({ formId, title, description, options, required, index }) => {
          const form = await context.formsClient.getForm(formId);
          const targetIndex = index ?? (form.items?.length ?? 0);
          const response = await context.formsClient.batchUpdate(formId, [
            buildCreateChoiceQuestionRequest(
              title,
              toChoiceOptionInputs(options, false, undefined),
              required,
              targetIndex,
              "DROP_DOWN",
              description,
            ),
          ]);

          return {
            formId,
            insertedIndex: targetIndex,
            itemCount: response.form?.items?.length ?? null,
            items: response.form ? normalizeFormItems(response.form) : null,
          };
        },
      ),
  );

  server.tool(
    "add_section",
    "Add a new section header (page break) to split the form into multiple sections.",
    addSectionInputSchema.shape,
    writeAnnotations,
    async (input) =>
      executeTool(input, addSectionInputSchema, async ({ formId, title, description, index }) => {
        const form = await context.formsClient.getForm(formId);
        const targetIndex = index ?? (form.items?.length ?? 0);
        const response = await context.formsClient.batchUpdate(formId, [
          buildCreateSectionRequest(title, description, targetIndex),
        ]);

        return {
          formId,
          insertedIndex: targetIndex,
          itemCount: response.form?.items?.length ?? null,
          items: response.form ? normalizeFormItems(response.form) : null,
        };
      }),
  );

  server.registerTool(
    "update_section",
    {
      title: "Update Section",
      description: "Update an existing section header by itemId or item index.",
      inputSchema: updateSectionInputSchema,
      annotations: writeAnnotations,
    },
    async (input: unknown) =>
      executeTool(
        input,
        updateSectionInputSchema,
        async ({ formId, itemId, currentIndex, title, description }) => {
          const form = await context.formsClient.getForm(formId);
          const targetIndex =
            itemId !== undefined
              ? resolveItemIndex(form, { itemId })
              : resolveItemIndex(form, { currentIndex: currentIndex as number });
          const updates = {
            ...(title !== undefined ? { title } : {}),
            ...(description !== undefined ? { description } : {}),
          };
          const response = await context.formsClient.batchUpdate(formId, [
            buildUpdateSectionRequest(form, targetIndex, updates),
          ]);

          return {
            formId,
            updatedIndex: targetIndex,
            items: response.form ? normalizeFormItems(response.form) : null,
          };
        },
      ),
  );

  server.registerTool(
    "update_image_item",
    {
      title: "Update Image Item",
      description: "Update a standalone image block by itemId or item index.",
      inputSchema: updateImageItemInputSchema,
      annotations: writeAnnotations,
    },
    async (input: unknown) =>
      executeTool(
        input,
        updateImageItemInputSchema,
        async ({
          formId,
          itemId,
          currentIndex,
          title,
          description,
          imageUrl,
          altText,
          width,
          alignment,
        }) => {
          const form = await context.formsClient.getForm(formId);
          const targetIndex =
            itemId !== undefined
              ? resolveItemIndex(form, { itemId })
              : resolveItemIndex(form, { currentIndex: currentIndex as number });
          const updates = {
            ...(title !== undefined ? { title } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(imageUrl !== undefined
              ? {
                  image: {
                    sourceUri: imageUrl,
                    ...(altText !== undefined ? { altText } : {}),
                    ...(width !== undefined ? { width } : {}),
                    ...(alignment !== undefined ? { alignment } : {}),
                  },
                }
              : {}),
          };
          const response = await context.formsClient.batchUpdate(formId, [
            buildUpdateImageItemRequest(form, targetIndex, updates),
          ]);

          return {
            formId,
            updatedIndex: targetIndex,
            items: response.form ? normalizeFormItems(response.form) : null,
          };
        },
      ),
  );

  server.registerTool(
    "set_question_image",
    {
      title: "Set Question Image",
      description: "Attach or replace the image shown above an existing question.",
      inputSchema: setQuestionImageInputSchema,
      annotations: writeAnnotations,
    },
    async (input: unknown) =>
      executeTool(
        input,
        setQuestionImageInputSchema,
        async ({ formId, itemId, currentIndex, imageUrl, altText, width, alignment }) => {
          const form = await context.formsClient.getForm(formId);
          const targetIndex =
            itemId !== undefined
              ? resolveItemIndex(form, { itemId })
              : resolveItemIndex(form, { currentIndex: currentIndex as number });
          const response = await context.formsClient.batchUpdate(formId, [
            buildUpdateQuestionImageRequest(form, targetIndex, {
              sourceUri: imageUrl,
              ...(altText !== undefined ? { altText } : {}),
              ...(width !== undefined ? { width } : {}),
              ...(alignment !== undefined ? { alignment } : {}),
            }),
          ]);

          return {
            formId,
            updatedIndex: targetIndex,
            items: response.form ? normalizeFormItems(response.form) : null,
          };
        },
      ),
  );

  server.registerTool(
    "update_question",
    {
      title: "Update Question",
      description:
        "Update an existing question by itemId or item index. Supports title, description, required, options, question type, long-answer mode, and section navigation for single-select options.",
      inputSchema: updateQuestionInputSchema,
      annotations: writeAnnotations,
    },
    async (input: unknown) =>
      executeTool(
        input,
        updateQuestionInputSchema,
        async ({
          formId,
          itemId,
          currentIndex,
          title,
          description,
          required,
          options,
          choiceType,
          paragraph,
          includeOther,
          optionNavigation,
        }) => {
          const form = await context.formsClient.getForm(formId);
          const targetIndex =
            itemId !== undefined
              ? resolveItemIndex(form, { itemId })
              : resolveItemIndex(form, { currentIndex: currentIndex as number });
          const updates = {
            ...(title !== undefined ? { title } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(required !== undefined ? { required } : {}),
            ...(choiceType !== undefined ? { choiceType } : {}),
            ...(paragraph !== undefined ? { paragraph } : {}),
            ...(options !== undefined || includeOther !== undefined || optionNavigation !== undefined
              ? {
                  options: toChoiceOptionInputs(
                    options ?? [],
                    includeOther,
                    optionNavigation,
                  ),
                }
              : {}),
          };
          const response = await context.formsClient.batchUpdate(formId, [
            buildUpdateQuestionRequest(form, targetIndex, updates),
          ]);
          const updatedItem = response.form?.items?.[targetIndex];

          return {
            formId,
            updatedIndex: targetIndex,
            item:
              updatedItem !== undefined ? normalizeFormItems({ items: [updatedItem] })[0] ?? null : null,
            items: response.form ? normalizeFormItems(response.form) : null,
          };
        },
      ),
  );

  server.registerTool(
    "move_item",
    {
      title: "Move Item",
      description: "Move any form item to a new zero-based index.",
      inputSchema: moveItemInputSchema,
      annotations: writeAnnotations,
    },
    async (input: unknown) =>
      executeTool(input, moveItemInputSchema, async ({ formId, itemId, currentIndex, newIndex }) => {
        const form = await context.formsClient.getForm(formId);
        if (itemId === undefined && currentIndex === undefined) {
          throw new AppError("validation_error", "Provide itemId or currentIndex.");
        }

        const originalIndex =
          itemId !== undefined
            ? resolveItemIndex(form, { itemId })
            : resolveItemIndex(form, { currentIndex: currentIndex as number });
        const itemCount = form.items?.length ?? 0;

        if (newIndex < 0 || newIndex >= itemCount) {
          throw new AppError("invalid_item_index", "The target index is out of range.", {
            newIndex,
            itemCount,
          });
        }

        const response = await context.formsClient.batchUpdate(formId, [
          {
            moveItem: {
              originalLocation: { index: originalIndex },
              newLocation: { index: newIndex },
            },
          },
        ]);

        return {
          formId,
          movedFromIndex: originalIndex,
          movedToIndex: newIndex,
          items: response.form ? normalizeFormItems(response.form) : null,
        };
      }),
  );

  server.registerTool(
    "delete_item",
    {
      title: "Delete Item",
      description:
        "Delete a form item by itemId or item index. This permanently removes the item from the form.",
      inputSchema: deleteItemInputSchema,
      annotations: destructiveAnnotations,
    },
    async (input: unknown) =>
      executeTool(input, deleteItemInputSchema, async ({ formId, itemId, currentIndex }) => {
        const form = await context.formsClient.getForm(formId);
        if (itemId === undefined && currentIndex === undefined) {
          throw new AppError("validation_error", "Provide itemId or currentIndex.");
        }

        const targetIndex =
          itemId !== undefined
            ? resolveItemIndex(form, { itemId })
            : resolveItemIndex(form, { currentIndex: currentIndex as number });
        const response = await context.formsClient.batchUpdate(formId, [
          {
            deleteItem: {
              location: { index: targetIndex },
            },
          },
        ]);

        return {
          formId,
          deletedIndex: targetIndex,
          items: response.form ? normalizeFormItems(response.form) : null,
        };
      }),
  );

  server.tool(
    "list_responses",
    "List form responses with pagination support.",
    listResponsesInputSchema.shape,
    readOnlyAnnotations,
    async (input) =>
      executeTool(input, listResponsesInputSchema, async ({ formId, pageSize, pageToken }) => {
        const response = await context.formsClient.listResponses(formId, pageSize, pageToken);

        return {
          formId,
          nextPageToken: response.nextPageToken ?? null,
          responses: response.responses ?? [],
          responseCount: response.responses?.length ?? 0,
        };
      }),
  );

  server.tool(
    "get_response",
    "Fetch one form response by responseId.",
    getResponseInputSchema.shape,
    readOnlyAnnotations,
    async (input) =>
      executeTool(input, getResponseInputSchema, async ({ formId, responseId }) => {
        const response = await context.formsClient.getResponse(formId, responseId);

        return {
          formId,
          responseId,
          response,
        };
      }),
  );

  server.tool(
    "set_publish_settings",
    "Publish or unpublish a form. Optionally apply responder access using Google Drive permissions when Drive scope is enabled.",
    setPublishSettingsInputSchema.shape,
    writeAnnotations,
    async (input) =>
      executeTool(
        input,
        setPublishSettingsInputSchema,
        async ({ formId, published, responderAccess }) => {
          const form = await context.formsClient.setPublishSettings(formId, published);
          const driveClient = ensureDriveClient(context.driveClient, responderAccess);
          const publishedPermissions =
            responderAccess && driveClient
              ? await driveClient.setResponderAccess(formId, responderAccess)
              : null;

          return {
            formId,
            publishSettings: form.publishSettings ?? null,
            responderAccessApplied: responderAccess ?? null,
            publishedPermissions,
          };
        },
      ),
  );
}
