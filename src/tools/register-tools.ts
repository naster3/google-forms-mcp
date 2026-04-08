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
  server.tool(
    "get_form",
    "Get a Google Form by formId.",
    {
      formId: z.string().min(1),
    },
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

  server.tool(
    "update_form_info",
    "Update the title and/or description of a Google Form using forms.batchUpdate.",
    {
      formId: z.string().min(1),
      title: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
    },
    async (input) =>
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
    "List normalized Google Form items.",
    {
      formId: z.string().min(1),
    },
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
    "Add an image block to a Google Form using forms.batchUpdate.",
    {
      formId: z.string().min(1),
      title: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      imageUrl: z.string().url(),
      altText: z.string().min(1).optional(),
      width: z.number().int().min(1).max(740).optional(),
      alignment: z.enum(["LEFT", "CENTER", "RIGHT"]).optional(),
      index: z.number().int().min(0).optional(),
    },
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
    "Add a short text question to a Google Form using forms.batchUpdate.",
    {
      formId: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1).optional(),
      required: z.boolean(),
      index: z.number().int().min(0).optional(),
    },
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
    "Add a paragraph question to a Google Form using forms.batchUpdate.",
    {
      formId: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1).optional(),
      required: z.boolean(),
      index: z.number().int().min(0).optional(),
    },
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
    "Add a multiple-choice question to a Google Form using forms.batchUpdate.",
    {
      formId: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1).optional(),
      options: z.array(z.string().min(1)).min(1),
      includeOther: z.boolean().optional(),
      required: z.boolean(),
      index: z.number().int().min(0).optional(),
    },
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
    "Add a checkbox question to a Google Form using forms.batchUpdate.",
    {
      formId: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1).optional(),
      options: z.array(z.string().min(1)).min(1),
      includeOther: z.boolean().optional(),
      required: z.boolean(),
      index: z.number().int().min(0).optional(),
    },
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
    "Add a dropdown question to a Google Form using forms.batchUpdate.",
    {
      formId: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1).optional(),
      options: z.array(z.string().min(1)).min(1),
      required: z.boolean(),
      index: z.number().int().min(0).optional(),
    },
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
    "Add a section header (page break) to a Google Form using forms.batchUpdate.",
    {
      formId: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1).optional(),
      index: z.number().int().min(0).optional(),
    },
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

  server.tool(
    "update_section",
    "Update a Google Form section header by itemId or currentIndex using forms.batchUpdate.",
    {
      formId: z.string().min(1),
      itemId: z.string().min(1).optional(),
      currentIndex: z.number().int().min(0).optional(),
      title: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
    },
    async (input) =>
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

  server.tool(
    "update_image_item",
    "Update an image block in a Google Form by itemId or currentIndex using forms.batchUpdate.",
    {
      formId: z.string().min(1),
      itemId: z.string().min(1).optional(),
      currentIndex: z.number().int().min(0).optional(),
      title: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      imageUrl: z.string().url().optional(),
      altText: z.string().min(1).optional(),
      width: z.number().int().min(1).max(740).optional(),
      alignment: z.enum(["LEFT", "CENTER", "RIGHT"]).optional(),
    },
    async (input) =>
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

  server.tool(
    "set_question_image",
    "Attach an image to an existing Google Form question by itemId or currentIndex using forms.batchUpdate.",
    {
      formId: z.string().min(1),
      itemId: z.string().min(1).optional(),
      currentIndex: z.number().int().min(0).optional(),
      imageUrl: z.string().url(),
      altText: z.string().min(1).optional(),
      width: z.number().int().min(1).max(740).optional(),
      alignment: z.enum(["LEFT", "CENTER", "RIGHT"]).optional(),
    },
    async (input) =>
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

  server.tool(
    "update_question",
    "Update an existing Google Form question by itemId or currentIndex using forms.batchUpdate.",
    {
      formId: z.string().min(1),
      itemId: z.string().min(1).optional(),
      currentIndex: z.number().int().min(0).optional(),
      title: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      required: z.boolean().optional(),
      options: z.array(z.string().min(1)).min(1).optional(),
      choiceType: z.enum(["RADIO", "CHECKBOX", "DROP_DOWN"]).optional(),
      paragraph: z.boolean().optional(),
      includeOther: z.boolean().optional(),
      optionNavigation: z
        .array(
          z.object({
            optionValue: z.string().min(1),
            goToSectionId: z.string().min(1).optional(),
            goToAction: z.enum(["NEXT_SECTION", "RESTART_FORM", "SUBMIT_FORM"]).optional(),
          }),
        )
        .optional(),
    },
    async (input) =>
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

  server.tool(
    "move_item",
    "Move a Google Form item by itemId or currentIndex using forms.batchUpdate.",
    {
      formId: z.string().min(1),
      itemId: z.string().min(1).optional(),
      currentIndex: z.number().int().min(0).optional(),
      newIndex: z.number().int().min(0),
    },
    async (input) =>
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

  server.tool(
    "delete_item",
    "Delete a Google Form item by itemId or currentIndex using forms.batchUpdate.",
    {
      formId: z.string().min(1),
      itemId: z.string().min(1).optional(),
      currentIndex: z.number().int().min(0).optional(),
    },
    async (input) =>
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
    "List Google Form responses with pagination support.",
    {
      formId: z.string().min(1),
      pageSize: z.number().int().min(1).max(5000).optional(),
      pageToken: z.string().min(1).optional(),
    },
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
    "Get a single Google Form response by responseId.",
    {
      formId: z.string().min(1),
      responseId: z.string().min(1),
    },
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
    "Publish or unpublish a Google Form. Optional responderAccess uses Drive permissions and requires Drive scope.",
    {
      formId: z.string().min(1),
      published: z.boolean(),
      responderAccess: z.enum(["ANYONE_WITH_LINK", "RESTRICTED"]).optional(),
    },
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
