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

export const getFormInputSchema = z.object({
  formId: nonEmptyString,
});

export const updateFormInfoInputSchema = z
  .object({
    formId: nonEmptyString,
    title: optionalNonEmptyString,
    description: optionalNonEmptyString,
  })
  .strict()
  .refine((value) => value.title !== undefined || value.description !== undefined, {
    message: "At least one of title or description must be provided.",
    path: ["title"],
  });

export const listItemsInputSchema = z.object({
  formId: nonEmptyString,
});

export const addTextQuestionInputSchema = z
  .object({
    formId: nonEmptyString,
    title: nonEmptyString,
    description: optionalNonEmptyString,
    required: z.boolean(),
    index: z.number().int().min(0).optional(),
  })
  .strict();

export const addParagraphQuestionInputSchema = z
  .object({
    formId: nonEmptyString,
    title: nonEmptyString,
    description: optionalNonEmptyString,
    required: z.boolean(),
    index: z.number().int().min(0).optional(),
  })
  .strict();

export const addMultipleChoiceQuestionInputSchema = z
  .object({
    formId: nonEmptyString,
    title: nonEmptyString,
    description: optionalNonEmptyString,
    options: optionsSchema,
    includeOther: z.boolean().optional(),
    required: z.boolean(),
    index: z.number().int().min(0).optional(),
  })
  .strict();

export const addCheckboxQuestionInputSchema = z
  .object({
    formId: nonEmptyString,
    title: nonEmptyString,
    description: optionalNonEmptyString,
    options: optionsSchema,
    includeOther: z.boolean().optional(),
    required: z.boolean(),
    index: z.number().int().min(0).optional(),
  })
  .strict();

export const addDropdownQuestionInputSchema = z
  .object({
    formId: nonEmptyString,
    title: nonEmptyString,
    description: optionalNonEmptyString,
    options: optionsSchema,
    required: z.boolean(),
    index: z.number().int().min(0).optional(),
  })
  .strict();

export const addSectionInputSchema = z
  .object({
    formId: nonEmptyString,
    title: nonEmptyString,
    description: optionalNonEmptyString,
    index: z.number().int().min(0).optional(),
  })
  .strict();

export const addImageItemInputSchema = z
  .object({
    formId: nonEmptyString,
    title: optionalNonEmptyString,
    description: optionalNonEmptyString,
    imageUrl: z.string().url(),
    altText: optionalNonEmptyString,
    width: z.number().int().min(1).max(740).optional(),
    alignment: mediaAlignmentSchema.optional(),
    index: z.number().int().min(0).optional(),
  })
  .strict();

export const updateSectionInputSchema = z
  .object({
    formId: nonEmptyString,
    itemId: optionalNonEmptyString,
    currentIndex: z.number().int().min(0).optional(),
    title: optionalNonEmptyString,
    description: optionalNonEmptyString,
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
    formId: nonEmptyString,
    itemId: optionalNonEmptyString,
    currentIndex: z.number().int().min(0).optional(),
    title: optionalNonEmptyString,
    description: optionalNonEmptyString,
    imageUrl: z.string().url().optional(),
    altText: optionalNonEmptyString,
    width: z.number().int().min(1).max(740).optional(),
    alignment: mediaAlignmentSchema.optional(),
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
    formId: nonEmptyString,
    itemId: optionalNonEmptyString,
    currentIndex: z.number().int().min(0).optional(),
    imageUrl: z.string().url(),
    altText: optionalNonEmptyString,
    width: z.number().int().min(1).max(740).optional(),
    alignment: mediaAlignmentSchema.optional(),
  })
  .strict()
  .refine((value) => value.itemId !== undefined || value.currentIndex !== undefined, {
    message: "Provide itemId or currentIndex.",
    path: ["itemId"],
  });

export const updateQuestionInputSchema = z
  .object({
    formId: nonEmptyString,
    itemId: optionalNonEmptyString,
    currentIndex: z.number().int().min(0).optional(),
    title: optionalNonEmptyString,
    description: optionalNonEmptyString,
    required: z.boolean().optional(),
    options: optionsSchema.optional(),
    choiceType: choiceTypeSchema.optional(),
    paragraph: z.boolean().optional(),
    includeOther: z.boolean().optional(),
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
    formId: nonEmptyString,
    itemId: optionalNonEmptyString,
    currentIndex: z.number().int().min(0).optional(),
    newIndex: z.number().int().min(0),
  })
  .strict()
  .refine((value) => value.itemId !== undefined || value.currentIndex !== undefined, {
    message: "Provide itemId or currentIndex.",
    path: ["itemId"],
  });

export const deleteItemInputSchema = z
  .object({
    formId: nonEmptyString,
    itemId: optionalNonEmptyString,
    currentIndex: z.number().int().min(0).optional(),
  })
  .strict()
  .refine((value) => value.itemId !== undefined || value.currentIndex !== undefined, {
    message: "Provide itemId or currentIndex.",
    path: ["itemId"],
  });

export const listResponsesInputSchema = z
  .object({
    formId: nonEmptyString,
    pageSize: z.number().int().min(1).max(5000).optional(),
    pageToken: optionalNonEmptyString,
  })
  .strict();

export const getResponseInputSchema = z
  .object({
    formId: nonEmptyString,
    responseId: nonEmptyString,
  })
  .strict();

export const setPublishSettingsInputSchema = z
  .object({
    formId: nonEmptyString,
    published: z.boolean(),
    responderAccess: z.enum(["ANYONE_WITH_LINK", "RESTRICTED"]).optional(),
  })
  .strict();
