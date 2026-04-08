import assert from "node:assert/strict";
import {
  buildCreateImageItemRequest,
  buildCreateChoiceQuestionRequest,
  buildCreateParagraphQuestionRequest,
  buildCreateSectionRequest,
  buildCreateTextQuestionRequest,
  buildUpdateImageItemRequest,
  buildUpdateQuestionRequest,
  buildUpdateQuestionImageRequest,
  buildUpdateSectionRequest,
  normalizeFormItems,
  resolveItemIndex,
} from "../src/tools/helpers.js";
import { AppError } from "../src/google/errors.js";
import {
  addImageItemInputSchema,
  addDropdownQuestionInputSchema,
  addParagraphQuestionInputSchema,
  addSectionInputSchema,
  addCheckboxQuestionInputSchema,
  deleteItemInputSchema,
  moveItemInputSchema,
  setPublishSettingsInputSchema,
  setQuestionImageInputSchema,
  updateFormInfoInputSchema,
  updateImageItemInputSchema,
  updateQuestionInputSchema,
  updateSectionInputSchema,
} from "../src/tools/schemas.js";

type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [
  {
    name: "buildCreateTextQuestionRequest creates a text question request",
    run: () => {
      const request = buildCreateTextQuestionRequest("Name", true, 0);
      assert.equal(request.createItem?.item?.title, "Name");
      assert.equal(
        request.createItem?.item?.questionItem?.question?.textQuestion?.paragraph,
        false,
      );
      assert.equal(request.createItem?.item?.questionItem?.question?.required, true);
      assert.equal(request.createItem?.location?.index, 0);
    },
  },
  {
    name: "buildCreateChoiceQuestionRequest creates a RADIO choice request",
    run: () => {
      const request = buildCreateChoiceQuestionRequest(
        "Color",
        ["Red", "Blue"],
        false,
        1,
        "RADIO",
      );

      assert.equal(
        request.createItem?.item?.questionItem?.question?.choiceQuestion?.type,
        "RADIO",
      );
      assert.deepEqual(
        request.createItem?.item?.questionItem?.question?.choiceQuestion?.options?.map(
          (option) => option.value,
        ),
        ["Red", "Blue"],
      );
    },
  },
  {
    name: "buildCreateImageItemRequest creates an image block",
    run: () => {
      const request = buildCreateImageItemRequest(
        {
          sourceUri: "https://example.com/image.png",
          altText: "Preview",
          width: 320,
          alignment: "CENTER",
        },
        4,
        "Gallery",
      );

      assert.equal(request.createItem?.item?.title, "Gallery");
      assert.equal(request.createItem?.item?.imageItem?.image?.sourceUri, "https://example.com/image.png");
      assert.equal(request.createItem?.item?.imageItem?.image?.altText, "Preview");
      assert.equal(request.createItem?.item?.imageItem?.image?.properties?.width, 320);
    },
  },
  {
    name: "buildCreateParagraphQuestionRequest creates a paragraph text request",
    run: () => {
      const request = buildCreateParagraphQuestionRequest("Details", false, 2, "More context");
      assert.equal(request.createItem?.item?.description, "More context");
      assert.equal(
        request.createItem?.item?.questionItem?.question?.textQuestion?.paragraph,
        true,
      );
    },
  },
  {
    name: "buildCreateSectionRequest creates a section header",
    run: () => {
      const request = buildCreateSectionRequest("Section", "Description", 3);
      assert.equal(request.createItem?.item?.title, "Section");
      assert.equal(request.createItem?.item?.description, "Description");
      assert.deepEqual(request.createItem?.item?.pageBreakItem, {});
    },
  },
  {
    name: "normalizeFormItems flattens known item types",
    run: () => {
      const items = normalizeFormItems({
        items: [
          {
            itemId: "item-1",
            title: "Name",
            questionItem: {
              question: {
                questionId: "q-1",
                required: true,
                textQuestion: {
                  paragraph: false,
                },
              },
            },
          },
          {
            itemId: "item-2",
            title: "Choice",
            questionItem: {
              question: {
                questionId: "q-2",
                choiceQuestion: {
                  type: "CHECKBOX",
                  options: [{ value: "A" }, { value: "B" }],
                },
              },
            },
          },
        ],
      });

      assert.deepEqual(items, [
        {
          index: 0,
          itemId: "item-1",
          title: "Name",
          description: null,
          kind: "text",
          required: true,
          questionId: "q-1",
          options: [],
          optionDetails: [],
          choiceType: null,
          hasOtherOption: false,
          isParagraph: false,
          hasImageItem: false,
          hasQuestionImage: false,
          imageAltText: null,
          imageContentUri: null,
        },
        {
          index: 1,
          itemId: "item-2",
          title: "Choice",
          description: null,
          kind: "checkbox",
          required: null,
          questionId: "q-2",
          options: ["A", "B"],
          optionDetails: [
            {
              value: "A",
              isOther: false,
              goToAction: null,
              goToSectionId: null,
            },
            {
              value: "B",
              isOther: false,
              goToAction: null,
              goToSectionId: null,
            },
          ],
          choiceType: "CHECKBOX",
          hasOtherOption: false,
          isParagraph: false,
          hasImageItem: false,
          hasQuestionImage: false,
          imageAltText: null,
          imageContentUri: null,
        },
      ]);
    },
  },
  {
    name: "normalizeFormItems recognizes dropdown and text blocks",
    run: () => {
      const items = normalizeFormItems({
        items: [
          {
            title: "Intro",
            textItem: {},
          },
          {
            title: "Type",
            questionItem: {
              question: {
                choiceQuestion: {
                  type: "DROP_DOWN",
                  options: [{ value: "A" }, { isOther: true }],
                },
              },
            },
          },
        ],
      });

      assert.equal(items[0]?.kind, "text_block");
      assert.equal(items[1]?.kind, "dropdown");
      assert.equal(items[1]?.hasOtherOption, true);
    },
  },
  {
    name: "normalizeFormItems exposes image metadata",
    run: () => {
      const items = normalizeFormItems({
        items: [
          {
            title: "Hero image",
            imageItem: {
              image: {
                altText: "Hero",
                contentUri: "https://example.com/hero.png",
              },
            },
          },
        ],
      });

      assert.equal(items[0]?.hasImageItem, true);
      assert.equal(items[0]?.imageAltText, "Hero");
      assert.equal(items[0]?.imageContentUri, "https://example.com/hero.png");
    },
  },
  {
    name: "resolveItemIndex resolves by itemId",
    run: () => {
      const form = {
        items: [{ itemId: "a" }, { itemId: "b" }, { itemId: "c" }],
      };

      assert.equal(resolveItemIndex(form, { itemId: "b" }), 1);
    },
  },
  {
    name: "resolveItemIndex throws on invalid index",
    run: () => {
      const form = {
        items: [{ itemId: "a" }],
      };

      assert.throws(() => resolveItemIndex(form, { currentIndex: 5 }), AppError);
    },
  },
  {
    name: "buildUpdateQuestionRequest updates choice question fields",
    run: () => {
      const request = buildUpdateQuestionRequest(
        {
          items: [
            {
              itemId: "item-1",
              title: "Old",
              questionItem: {
                question: {
                  required: false,
                  choiceQuestion: {
                    type: "RADIO",
                    options: [{ value: "A" }],
                  },
                },
              },
            },
          ],
        },
        0,
        {
          title: "New",
          required: true,
          options: ["X", "Y"],
        },
      );

      assert.equal(request.updateItem?.item?.title, "New");
      assert.equal(request.updateItem?.item?.questionItem?.question?.required, true);
      assert.deepEqual(
        request.updateItem?.item?.questionItem?.question?.choiceQuestion?.options?.map(
          (option) => option.value,
        ),
        ["X", "Y"],
      );
      assert.equal(
        request.updateItem?.updateMask,
        "title,questionItem.question.required,questionItem.question.choiceQuestion.options",
      );
    },
  },
  {
    name: "buildUpdateQuestionRequest updates paragraph and choice type",
    run: () => {
      const request = buildUpdateQuestionRequest(
        {
          items: [
            {
              itemId: "item-1",
              title: "Old",
              questionItem: {
                question: {
                  required: false,
                  textQuestion: {
                    paragraph: false,
                  },
                },
              },
            },
          ],
        },
        0,
        {
          paragraph: true,
        },
      );

      assert.equal(request.updateItem?.item?.questionItem?.question?.textQuestion?.paragraph, true);
    },
  },
  {
    name: "buildUpdateSectionRequest updates section title and description",
    run: () => {
      const request = buildUpdateSectionRequest(
        {
          items: [
            {
              itemId: "section-1",
              title: "Old section",
              pageBreakItem: {},
            },
          ],
        },
        0,
        {
          title: "New section",
          description: "Intro",
        },
      );

      assert.equal(request.updateItem?.item?.title, "New section");
      assert.equal(request.updateItem?.item?.description, "Intro");
    },
  },
  {
    name: "buildUpdateQuestionImageRequest attaches an image to a question",
    run: () => {
      const request = buildUpdateQuestionImageRequest(
        {
          items: [
            {
              itemId: "item-1",
              title: "Question",
              questionItem: {
                question: {
                  textQuestion: {
                    paragraph: false,
                  },
                },
              },
            },
          ],
        },
        0,
        {
          sourceUri: "https://example.com/question.png",
          altText: "Reference",
        },
      );

      assert.equal(request.updateItem?.item?.questionItem?.image?.sourceUri, "https://example.com/question.png");
      assert.equal(request.updateItem?.updateMask, "questionItem.image");
    },
  },
  {
    name: "buildUpdateImageItemRequest updates an image block",
    run: () => {
      const request = buildUpdateImageItemRequest(
        {
          items: [
            {
              itemId: "item-1",
              title: "Old image",
              imageItem: {
                image: {
                  contentUri: "https://example.com/old.png",
                },
              },
            },
          ],
        },
        0,
        {
          title: "New image",
          image: {
            sourceUri: "https://example.com/new.png",
            altText: "Updated",
          },
        },
      );

      assert.equal(request.updateItem?.item?.title, "New image");
      assert.equal(request.updateItem?.item?.imageItem?.image?.sourceUri, "https://example.com/new.png");
      assert.equal(request.updateItem?.updateMask, "title,imageItem.image");
    },
  },
  {
    name: "buildUpdateQuestionRequest rejects options for text questions",
    run: () => {
      assert.throws(
        () =>
          buildUpdateQuestionRequest(
            {
              items: [
                {
                  itemId: "item-1",
                  title: "Name",
                  questionItem: {
                    question: {
                      textQuestion: {
                        paragraph: false,
                      },
                    },
                  },
                },
              ],
            },
            0,
            {
              options: ["A"],
            },
          ),
        AppError,
      );
    },
  },
  {
    name: "updateFormInfoInputSchema rejects empty updates",
    run: () => {
      const result = updateFormInfoInputSchema.safeParse({ formId: "abc123" });
      assert.equal(result.success, false);
    },
  },
  {
    name: "addCheckboxQuestionInputSchema rejects empty options",
    run: () => {
      const result = addCheckboxQuestionInputSchema.safeParse({
        formId: "abc123",
        title: "Select",
        options: [],
        required: false,
      });

      assert.equal(result.success, false);
    },
  },
  {
    name: "addParagraphQuestionInputSchema accepts paragraph questions",
    run: () => {
      const result = addParagraphQuestionInputSchema.safeParse({
        formId: "abc123",
        title: "Describe",
        required: false,
      });

      assert.equal(result.success, true);
    },
  },
  {
    name: "addDropdownQuestionInputSchema accepts dropdown questions",
    run: () => {
      const result = addDropdownQuestionInputSchema.safeParse({
        formId: "abc123",
        title: "Type",
        options: ["A", "B"],
        required: false,
      });

      assert.equal(result.success, true);
    },
  },
  {
    name: "addImageItemInputSchema accepts image items",
    run: () => {
      const result = addImageItemInputSchema.safeParse({
        formId: "abc123",
        imageUrl: "https://example.com/image.png",
      });

      assert.equal(result.success, true);
    },
  },
  {
    name: "moveItemInputSchema requires itemId or currentIndex",
    run: () => {
      const result = moveItemInputSchema.safeParse({
        formId: "abc123",
        newIndex: 1,
      });

      assert.equal(result.success, false);
    },
  },
  {
    name: "deleteItemInputSchema requires itemId or currentIndex",
    run: () => {
      const result = deleteItemInputSchema.safeParse({
        formId: "abc123",
      });

      assert.equal(result.success, false);
    },
  },
  {
    name: "updateQuestionInputSchema requires selector",
    run: () => {
      const result = updateQuestionInputSchema.safeParse({
        formId: "abc123",
        title: "New title",
      });

      assert.equal(result.success, false);
    },
  },
  {
    name: "updateQuestionInputSchema requires at least one change",
    run: () => {
      const result = updateQuestionInputSchema.safeParse({
        formId: "abc123",
        itemId: "item-1",
      });

      assert.equal(result.success, false);
    },
  },
  {
    name: "updateQuestionInputSchema accepts advanced choice settings",
    run: () => {
      const result = updateQuestionInputSchema.safeParse({
        formId: "abc123",
        itemId: "item-1",
        choiceType: "DROP_DOWN",
        options: ["A", "B"],
        includeOther: false,
      });

      assert.equal(result.success, true);
    },
  },
  {
    name: "addSectionInputSchema accepts section creation",
    run: () => {
      const result = addSectionInputSchema.safeParse({
        formId: "abc123",
        title: "Section",
      });

      assert.equal(result.success, true);
    },
  },
  {
    name: "setQuestionImageInputSchema accepts question images",
    run: () => {
      const result = setQuestionImageInputSchema.safeParse({
        formId: "abc123",
        itemId: "item-1",
        imageUrl: "https://example.com/image.png",
      });

      assert.equal(result.success, true);
    },
  },
  {
    name: "updateImageItemInputSchema requires imageUrl for image properties",
    run: () => {
      const result = updateImageItemInputSchema.safeParse({
        formId: "abc123",
        itemId: "item-1",
        altText: "Preview",
      });

      assert.equal(result.success, false);
    },
  },
  {
    name: "updateSectionInputSchema requires selector",
    run: () => {
      const result = updateSectionInputSchema.safeParse({
        formId: "abc123",
        title: "Section",
      });

      assert.equal(result.success, false);
    },
  },
  {
    name: "setPublishSettingsInputSchema accepts supported responderAccess",
    run: () => {
      const result = setPublishSettingsInputSchema.safeParse({
        formId: "abc123",
        published: true,
        responderAccess: "ANYONE_WITH_LINK",
      });

      assert.equal(result.success, true);
    },
  },
];

let passed = 0;

for (const test of tests) {
  try {
    test.run();
    process.stdout.write(`PASS ${test.name}\n`);
    passed += 1;
  } catch (error) {
    process.stderr.write(`FAIL ${test.name}\n`);
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
    break;
  }
}

if (process.exitCode !== 1) {
  process.stdout.write(`\n${passed}/${tests.length} tests passed.\n`);
}
