import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCreateImageItemRequest,
  buildCreateChoiceQuestionRequest,
  buildCreateTextQuestionRequest,
  normalizeFormItems,
  resolveItemIndex,
} from "../src/tools/helpers.js";
import { AppError } from "../src/google/errors.js";

describe("tool helpers", () => {
  it("builds a text question request", () => {
    const request = buildCreateTextQuestionRequest("Name", true, 0);

    assert.equal(request.createItem?.item?.title, "Name");
    assert.equal(request.createItem?.item?.questionItem?.question?.textQuestion?.paragraph, false);
    assert.equal(request.createItem?.item?.questionItem?.question?.required, true);
    assert.equal(request.createItem?.location?.index, 0);
  });

  it("builds a multiple choice request", () => {
    const request = buildCreateChoiceQuestionRequest(
      "Color",
      ["Red", "Blue"],
      false,
      1,
      "RADIO",
    );

    assert.equal(request.createItem?.item?.questionItem?.question?.choiceQuestion?.type, "RADIO");
    assert.deepEqual(
      request.createItem?.item?.questionItem?.question?.choiceQuestion?.options?.map(
        (option) => option.value,
      ),
      ["Red", "Blue"],
    );
  });

  it("builds an image item request", () => {
    const request = buildCreateImageItemRequest(
      {
        sourceUri: "https://example.com/image.png",
        altText: "Preview",
      },
      2,
      "Hero",
    );

    assert.equal(request.createItem?.item?.title, "Hero");
    assert.equal(request.createItem?.item?.imageItem?.image?.sourceUri, "https://example.com/image.png");
  });

  it("normalizes known item kinds", () => {
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
          { value: "A", isOther: false, goToAction: null, goToSectionId: null },
          { value: "B", isOther: false, goToAction: null, goToSectionId: null },
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
  });

  it("resolves an item index by id", () => {
    const form = {
      items: [{ itemId: "a" }, { itemId: "b" }, { itemId: "c" }],
    };

    assert.equal(resolveItemIndex(form, { itemId: "b" }), 1);
  });

  it("throws on invalid item index", () => {
    const form = {
      items: [{ itemId: "a" }],
    };

    assert.throws(() => resolveItemIndex(form, { currentIndex: 5 }), AppError);
  });
});
