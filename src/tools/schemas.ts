import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);
const optionalNonEmptyString = nonEmptyString.optional();
const choiceTypeSchema = z.enum(["RADIO", "CHECKBOX", "DROP_DOWN"]);
const sectionNavigationActionSchema = z.enum([
  "NEXT_SECTION",
  "RESTART_FORM",
  "SUBMIT_FORM",
]);
const mediaAlignmentSchema = z.enum(["LEFT", "CENTER", "RIGHT"]);

const optionNavigationSchema = z
  .object({
    optionValue: nonEmptyString,
    goToSectionId: optionalNonEmptyString,
    goToAction: sectionNavigationActionSchema.optional(),
  })
  .strict()
  .refine((value) => value.goToSectionId !== undefined || value.goToAction !== undefined, {
    message: "Provide goToSectionId or goToAction.",
    path: ["goToSectionId"],
  })
  .refine((value) => !(value.goToSectionId && value.goToAction), {
    message: "Provide only one navigation target per option.",
    path: ["goToSectionId"],
  });

const optionsSchema = z.array(nonEmptyString).min(1, "options must contain at least one value.");
const imageConfigSchema = z
  .object({
    imageUrl: z.string().url(),
    altText: optionalNonEmptyString,
    width: z.number().int().min(1).max(740).optional(),
    alignment: mediaAlignmentSchema.optional(),
  })
  .strict();

const formIdField = nonEmptyString.describe(
  "Google Form ID. This is the long ID segment from the Google Forms URL.",
);
const responseIdField = nonEmptyString.describe("Google Form response ID.");
const itemIdField = nonEmptyString.describe("Google Forms itemId for an existing form item.");
const currentIndexField = z
  .number()
  .int()
  .min(0)
  .describe("Zero-based index of the target form item.");
const targetIndexField = z
  .number()
  .int()
  .min(0)
  .describe("Zero-based index where the new item should be inserted.");
const titleField = nonEmptyString.describe("Visible title shown to respondents.");
const descriptionField = nonEmptyString.describe("Optional help text or description.");
const requiredField = z.boolean().describe("Whether respondents must answer this question.");
const optionsField = optionsSchema.describe("Visible choice values in display order.");
const includeOtherField = z
  .boolean()
  .describe("Add Google Forms native 'Other' option when supported.");
const imageUrlField = z
  .string()
  .url()
  .describe("Publicly reachable image URL that Google Forms can fetch.");
const altTextField = nonEmptyString.describe("Alternative text for accessibility.");
const widthField = z
  .number()
  .int()
  .min(1)
  .max(740)
  .describe("Image width in pixels. Google Forms supports up to 740.");
const alignmentField = mediaAlignmentSchema.describe("Image alignment inside the form.");
const pageSizeField = z
  .number()
  .int()
  .min(1)
  .max(5000)
  .describe("Maximum number of responses to return.");
const pageTokenField = nonEmptyString.describe("Pagination token from a previous list_responses call.");
const publishedField = z
  .boolean()
  .describe("Whether the form should be published and accept responses.");
const responderAccessField = z
  .enum(["ANYONE_WITH_LINK", "RESTRICTED"])
  .describe("Responder access mode for published forms. Requires Drive scope.");
const paragraphField = z
  .boolean()
  .describe("For text questions only: true for long answer, false for short answer.");
const choiceTypeField = choiceTypeSchema.describe(
  "Choice question type. Only valid for choice-based questions.",
);

export const getFormInputSchema = z.object({
  formId: formIdField,
});

export const createFormInputSchema = z
  .object({
    title: titleField.describe("Visible form title for the new Google Form."),
    documentTitle: nonEmptyString
      .describe("Optional Google Drive document title for the new form file.")
      .optional(),
    description: descriptionField.optional(),
  })
  .strict();

export const updateFormInfoInputSchema = z
  .object({
    formId: formIdField,
    title: titleField.optional(),
    description: descriptionField.optional(),
  })
  .strict()
  .refine((value) => value.title !== undefined || value.description !== undefined, {
    message: "At least one of title or description must be provided.",
    path: ["title"],
  });

export const listItemsInputSchema = z.object({
  formId: formIdField,
});

export const addTextQuestionInputSchema = z
  .object({
    formId: formIdField,
    title: titleField,
    description: descriptionField.optional(),
    required: requiredField,
    index: targetIndexField.optional(),
  })
  .strict();

export const addParagraphQuestionInputSchema = z
  .object({
    formId: formIdField,
    title: titleField,
    description: descriptionField.optional(),
    required: requiredField,
    index: targetIndexField.optional(),
  })
  .strict();

export const addMultipleChoiceQuestionInputSchema = z
  .object({
    formId: formIdField,
    title: titleField,
    description: descriptionField.optional(),
    options: optionsField,
    includeOther: includeOtherField.optional(),
    required: requiredField,
    index: targetIndexField.optional(),
  })
  .strict();

export const addCheckboxQuestionInputSchema = z
  .object({
    formId: formIdField,
    title: titleField,
    description: descriptionField.optional(),
    options: optionsField,
    includeOther: includeOtherField.optional(),
    required: requiredField,
    index: targetIndexField.optional(),
  })
  .strict();

export const addDropdownQuestionInputSchema = z
  .object({
    formId: formIdField,
    title: titleField,
    description: descriptionField.optional(),
    options: optionsField,
    required: requiredField,
    index: targetIndexField.optional(),
  })
  .strict();

export const addSectionInputSchema = z
  .object({
    formId: formIdField,
    title: titleField,
    description: descriptionField.optional(),
    index: targetIndexField.optional(),
  })
  .strict();

export const addImageItemInputSchema = z
  .object({
    formId: formIdField,
    title: titleField.optional(),
    description: descriptionField.optional(),
    imageUrl: imageUrlField,
    altText: altTextField.optional(),
    width: widthField.optional(),
    alignment: alignmentField.optional(),
    index: targetIndexField.optional(),
  })
  .strict();

export const updateSectionInputSchema = z
  .object({
    formId: formIdField,
    itemId: itemIdField.optional(),
    currentIndex: currentIndexField.optional(),
    title: titleField.optional(),
    description: descriptionField.optional(),
  })
  .strict()
  .refine((value) => value.itemId !== undefined || value.currentIndex !== undefined, {
    message: "Provide itemId or currentIndex.",
    path: ["itemId"],
  })
  .refine((value) => value.title !== undefined || value.description !== undefined, {
    message: "Provide at least one section field to update.",
    path: ["title"],
  });

export const updateImageItemInputSchema = z
  .object({
    formId: formIdField,
    itemId: itemIdField.optional(),
    currentIndex: currentIndexField.optional(),
    title: titleField.optional(),
    description: descriptionField.optional(),
    imageUrl: imageUrlField.optional(),
    altText: altTextField.optional(),
    width: widthField.optional(),
    alignment: alignmentField.optional(),
  })
  .strict()
  .refine((value) => value.itemId !== undefined || value.currentIndex !== undefined, {
    message: "Provide itemId or currentIndex.",
    path: ["itemId"],
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.imageUrl !== undefined ||
      value.altText !== undefined ||
      value.width !== undefined ||
      value.alignment !== undefined,
    {
      message: "Provide at least one image field to update.",
      path: ["title"],
    },
  )
  .refine(
    (value) =>
      value.altText === undefined &&
      value.width === undefined &&
      value.alignment === undefined
        ? true
        : value.imageUrl !== undefined,
    {
      message: "imageUrl is required when updating image properties.",
      path: ["imageUrl"],
    },
  );

export const setQuestionImageInputSchema = z
  .object({
    formId: formIdField,
    itemId: itemIdField.optional(),
    currentIndex: currentIndexField.optional(),
    imageUrl: imageUrlField,
    altText: altTextField.optional(),
    width: widthField.optional(),
    alignment: alignmentField.optional(),
  })
  .strict()
  .refine((value) => value.itemId !== undefined || value.currentIndex !== undefined, {
    message: "Provide itemId or currentIndex.",
    path: ["itemId"],
  });

export const updateQuestionInputSchema = z
  .object({
    formId: formIdField,
    itemId: itemIdField.optional(),
    currentIndex: currentIndexField.optional(),
    title: titleField.optional(),
    description: descriptionField.optional(),
    required: requiredField.optional(),
    options: optionsField.optional(),
    choiceType: choiceTypeField.optional(),
    paragraph: paragraphField.optional(),
    includeOther: includeOtherField.optional(),
    optionNavigation: z.array(optionNavigationSchema).optional(),
  })
  .strict()
  .refine((value) => value.itemId !== undefined || value.currentIndex !== undefined, {
    message: "Provide itemId or currentIndex.",
    path: ["itemId"],
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.required !== undefined ||
      value.options !== undefined ||
      value.choiceType !== undefined ||
      value.paragraph !== undefined ||
      value.includeOther !== undefined ||
      value.optionNavigation !== undefined,
    {
      message: "Provide at least one field to update.",
      path: ["title"],
    },
  );

export const moveItemInputSchema = z
  .object({
    formId: formIdField,
    itemId: itemIdField.optional(),
    currentIndex: currentIndexField.optional(),
    newIndex: targetIndexField.describe("New zero-based index for the moved item."),
  })
  .strict()
  .refine((value) => value.itemId !== undefined || value.currentIndex !== undefined, {
    message: "Provide itemId or currentIndex.",
    path: ["itemId"],
  });

export const deleteItemInputSchema = z
  .object({
    formId: formIdField,
    itemId: itemIdField.optional(),
    currentIndex: currentIndexField.optional(),
  })
  .strict()
  .refine((value) => value.itemId !== undefined || value.currentIndex !== undefined, {
    message: "Provide itemId or currentIndex.",
    path: ["itemId"],
  });

export const listResponsesInputSchema = z
  .object({
    formId: formIdField,
    pageSize: pageSizeField.optional(),
    pageToken: pageTokenField.optional(),
  })
  .strict();

export const getResponseInputSchema = z
  .object({
    formId: formIdField,
    responseId: responseIdField,
  })
  .strict();

export const setPublishSettingsInputSchema = z
  .object({
    formId: formIdField,
    published: publishedField,
    responderAccess: responderAccessField.optional(),
  })
  .strict();
