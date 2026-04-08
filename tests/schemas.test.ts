import assert from "node:assert/strict";
import { describe, it } from "node:test";
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

describe("tool schemas", () => {
  it("rejects update_form_info without changes", () => {
    const result = updateFormInfoInputSchema.safeParse({ formId: "abc123" });
    assert.equal(result.success, false);
  });

  it("rejects choice questions with empty options", () => {
    const result = addCheckboxQuestionInputSchema.safeParse({
      formId: "abc123",
      title: "Select",
      options: [],
      required: false,
    });

    assert.equal(result.success, false);
  });

  it("accepts paragraph question schema", () => {
    const result = addParagraphQuestionInputSchema.safeParse({
      formId: "abc123",
      title: "Describe",
      required: false,
    });

    assert.equal(result.success, true);
  });

  it("accepts dropdown question schema", () => {
    const result = addDropdownQuestionInputSchema.safeParse({
      formId: "abc123",
      title: "Type",
      options: ["A", "B"],
      required: false,
    });

    assert.equal(result.success, true);
  });

  it("accepts image item schema", () => {
    const result = addImageItemInputSchema.safeParse({
      formId: "abc123",
      imageUrl: "https://example.com/image.png",
    });

    assert.equal(result.success, true);
  });

  it("requires itemId or currentIndex for move_item", () => {
    const result = moveItemInputSchema.safeParse({
      formId: "abc123",
      newIndex: 1,
    });

    assert.equal(result.success, false);
  });

  it("requires itemId or currentIndex for delete_item", () => {
    const result = deleteItemInputSchema.safeParse({
      formId: "abc123",
    });

    assert.equal(result.success, false);
  });

  it("requires selector for update_question", () => {
    const result = updateQuestionInputSchema.safeParse({
      formId: "abc123",
      title: "New title",
    });

    assert.equal(result.success, false);
  });

  it("requires at least one change for update_question", () => {
    const result = updateQuestionInputSchema.safeParse({
      formId: "abc123",
      itemId: "item-1",
    });

    assert.equal(result.success, false);
  });

  it("accepts advanced update_question fields", () => {
    const result = updateQuestionInputSchema.safeParse({
      formId: "abc123",
      itemId: "item-1",
      choiceType: "DROP_DOWN",
      options: ["A", "B"],
      includeOther: false,
      optionNavigation: [
        {
          optionValue: "A",
          goToAction: "NEXT_SECTION",
        },
      ],
    });

    assert.equal(result.success, true);
  });

  it("accepts add_section schema", () => {
    const result = addSectionInputSchema.safeParse({
      formId: "abc123",
      title: "Section",
    });

    assert.equal(result.success, true);
  });

  it("accepts set_question_image schema", () => {
    const result = setQuestionImageInputSchema.safeParse({
      formId: "abc123",
      itemId: "item-1",
      imageUrl: "https://example.com/image.png",
    });

    assert.equal(result.success, true);
  });

  it("requires imageUrl when updating image item properties", () => {
    const result = updateImageItemInputSchema.safeParse({
      formId: "abc123",
      itemId: "item-1",
      altText: "Preview",
    });

    assert.equal(result.success, false);
  });

  it("requires selector for update_section", () => {
    const result = updateSectionInputSchema.safeParse({
      formId: "abc123",
      title: "Section",
    });

    assert.equal(result.success, false);
  });

  it("accepts supported responder access modes", () => {
    const result = setPublishSettingsInputSchema.safeParse({
      formId: "abc123",
      published: true,
      responderAccess: "ANYONE_WITH_LINK",
    });

    assert.equal(result.success, true);
  });
});
