import { AppError } from "../google/errors.js";
import type {
  ChoiceQuestionType,
  GoogleBatchRequest,
  GoogleChoiceOption,
  GoogleForm,
  GoogleFormItem,
  MediaAlignment,
  NormalizedItem,
  SectionNavigationAction,
} from "../types/google.js";

export type ChoiceOptionInput =
  | string
  | {
      value?: string;
      isOther?: boolean;
      goToAction?: SectionNavigationAction;
      goToSectionId?: string;
    };

export type ImageInput = {
  sourceUri: string;
  altText?: string;
  width?: number;
  alignment?: MediaAlignment;
};

type CreateQuestionConfig =
  | {
      title: string;
      description?: string;
      required: boolean;
      textQuestion: { paragraph: boolean };
    }
  | {
      title: string;
      description?: string;
      required: boolean;
      choiceQuestion: {
        type: ChoiceQuestionType;
        options: ChoiceOptionInput[];
      };
    };

function ensureEditableQuestionItem(item: GoogleFormItem, targetIndex: number): GoogleFormItem {
  const question = item.questionItem?.question;

  if (!question) {
    throw new AppError("invalid_item_type", "The specified item is not an editable question.", {
      targetIndex,
      itemId: item.itemId ?? null,
    });
  }

  return {
    ...item,
    questionItem: {
      ...item.questionItem,
      question: {
        ...question,
      },
    },
  };
}

function toChoiceOptions(
  options: ChoiceOptionInput[],
  type: ChoiceQuestionType,
): GoogleChoiceOption[] {
  if (options.length === 0) {
    throw new AppError("empty_options", "Question options cannot be empty.");
  }

  const mapped = options.map((option) => {
    if (typeof option === "string") {
      return { value: option };
    }

    if (option.isOther === true) {
      if (type === "DROP_DOWN") {
        throw new AppError(
          "invalid_choice_option",
          "Dropdown questions do not support native Other options.",
        );
      }

      return {
        isOther: true,
      };
    }

    if (!option.value) {
      throw new AppError(
        "invalid_choice_option",
        "Each non-Other choice option must include a value.",
      );
    }

    if (type === "CHECKBOX" && (option.goToAction || option.goToSectionId)) {
      throw new AppError(
        "invalid_choice_option",
        "Checkbox questions do not support section navigation per option.",
      );
    }

    if (option.goToAction && option.goToSectionId) {
      throw new AppError(
        "invalid_choice_option",
        "A choice option cannot set both goToAction and goToSectionId.",
      );
    }

    return {
      value: option.value,
      ...(option.goToAction !== undefined ? { goToAction: option.goToAction } : {}),
      ...(option.goToSectionId !== undefined ? { goToSectionId: option.goToSectionId } : {}),
    };
  });

  if (
    !mapped.some(
      (option) => ("value" in option && option.value) || ("isOther" in option && option.isOther),
    )
  ) {
    throw new AppError("empty_options", "Question options cannot be empty.");
  }

  return mapped;
}

function buildQuestionItem(config: CreateQuestionConfig): GoogleFormItem {
  const baseItem: GoogleFormItem = {
    title: config.title,
    ...(config.description !== undefined ? { description: config.description } : {}),
    questionItem: {
      question: {
        required: config.required,
      },
    },
  };

  if ("textQuestion" in config) {
    baseItem.questionItem!.question!.textQuestion = {
      paragraph: config.textQuestion.paragraph,
    };
    return baseItem;
  }

  baseItem.questionItem!.question!.choiceQuestion = {
    type: config.choiceQuestion.type,
    options: toChoiceOptions(config.choiceQuestion.options, config.choiceQuestion.type),
  };
  return baseItem;
}

function buildImage(
  input: ImageInput,
): Exclude<NonNullable<GoogleFormItem["imageItem"]>["image"], undefined> {
  return {
    sourceUri: input.sourceUri,
    ...(input.altText !== undefined ? { altText: input.altText } : {}),
    ...((input.width !== undefined || input.alignment !== undefined)
      ? {
          properties: {
            ...(input.width !== undefined ? { width: input.width } : {}),
            ...(input.alignment !== undefined ? { alignment: input.alignment } : {}),
          },
        }
      : {}),
  };
}

export function buildCreateTextBlockRequest(
  title: string,
  description: string | undefined,
  index: number,
): GoogleBatchRequest {
  return {
    createItem: {
      item: {
        title,
        ...(description !== undefined ? { description } : {}),
        textItem: {},
      },
      location: { index },
    },
  };
}

export function buildCreateImageItemRequest(
  image: ImageInput,
  index: number,
  title?: string,
  description?: string,
): GoogleBatchRequest {
  return {
    createItem: {
      item: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        imageItem: {
          image: buildImage(image),
        },
      },
      location: { index },
    },
  };
}

export function buildCreateSectionRequest(
  title: string,
  description: string | undefined,
  index: number,
): GoogleBatchRequest {
  return {
    createItem: {
      item: {
        title,
        ...(description !== undefined ? { description } : {}),
        pageBreakItem: {},
      },
      location: { index },
    },
  };
}

export function buildCreateTextQuestionRequest(
  title: string,
  required: boolean,
  index: number,
  description?: string,
): GoogleBatchRequest {
  return {
    createItem: {
      item: buildQuestionItem({
        title,
        ...(description !== undefined ? { description } : {}),
        required,
        textQuestion: { paragraph: false },
      }),
      location: { index },
    },
  };
}

export function buildCreateParagraphQuestionRequest(
  title: string,
  required: boolean,
  index: number,
  description?: string,
): GoogleBatchRequest {
  return {
    createItem: {
      item: buildQuestionItem({
        title,
        ...(description !== undefined ? { description } : {}),
        required,
        textQuestion: { paragraph: true },
      }),
      location: { index },
    },
  };
}

export function buildCreateChoiceQuestionRequest(
  title: string,
  options: ChoiceOptionInput[],
  required: boolean,
  index: number,
  type: ChoiceQuestionType,
  description?: string,
): GoogleBatchRequest {
  return {
    createItem: {
      item: buildQuestionItem({
        title,
        ...(description !== undefined ? { description } : {}),
        required,
        choiceQuestion: {
          type,
          options,
        },
      }),
      location: { index },
    },
  };
}

export function buildUpdateFormInfoRequests(
  title?: string,
  description?: string,
): GoogleBatchRequest[] {
  const info: Record<string, string> = {};
  const updateMask: string[] = [];

  if (title !== undefined) {
    info.title = title;
    updateMask.push("title");
  }

  if (description !== undefined) {
    info.description = description;
    updateMask.push("description");
  }

  if (updateMask.length === 0) {
    throw new AppError("invalid_request", "At least one form info field must be provided.");
  }

  return [
    {
      updateFormInfo: {
        info,
        updateMask: updateMask.join(","),
      },
    },
  ];
}

export function buildUpdateSectionRequest(
  form: GoogleForm,
  targetIndex: number,
  updates: {
    title?: string;
    description?: string;
  },
): GoogleBatchRequest {
  const item = form.items?.[targetIndex];

  if (!item) {
    throw new AppError("invalid_item_index", "The provided item index is out of range.", {
      targetIndex,
      itemCount: form.items?.length ?? 0,
    });
  }

  if (!item.pageBreakItem) {
    throw new AppError("invalid_item_type", "The specified item is not a section header.", {
      targetIndex,
      itemId: item.itemId ?? null,
    });
  }

  const nextItem: GoogleFormItem = {
    ...item,
  };
  const updateMask: string[] = [];

  if (updates.title !== undefined) {
    nextItem.title = updates.title;
    updateMask.push("title");
  }

  if (updates.description !== undefined) {
    nextItem.description = updates.description;
    updateMask.push("description");
  }

  if (updateMask.length === 0) {
    throw new AppError("invalid_request", "At least one section field must be provided.");
  }

  return {
    updateItem: {
      item: nextItem,
      location: { index: targetIndex },
      updateMask: updateMask.join(","),
    },
  };
}

export function buildUpdateTextBlockRequest(
  form: GoogleForm,
  targetIndex: number,
  updates: {
    title?: string;
    description?: string;
  },
): GoogleBatchRequest {
  const item = form.items?.[targetIndex];

  if (!item) {
    throw new AppError("invalid_item_index", "The provided item index is out of range.", {
      targetIndex,
      itemCount: form.items?.length ?? 0,
    });
  }

  if (!item.textItem) {
    throw new AppError("invalid_item_type", "The specified item is not a text block.", {
      targetIndex,
      itemId: item.itemId ?? null,
    });
  }

  const nextItem: GoogleFormItem = {
    ...item,
  };
  const updateMask: string[] = [];

  if (updates.title !== undefined) {
    nextItem.title = updates.title;
    updateMask.push("title");
  }

  if (updates.description !== undefined) {
    nextItem.description = updates.description;
    updateMask.push("description");
  }

  if (updateMask.length === 0) {
    throw new AppError("invalid_request", "At least one text block field must be provided.");
  }

  return {
    updateItem: {
      item: nextItem,
      location: { index: targetIndex },
      updateMask: updateMask.join(","),
    },
  };
}

export function buildUpdateImageItemRequest(
  form: GoogleForm,
  targetIndex: number,
  updates: {
    title?: string;
    description?: string;
    image?: ImageInput;
  },
): GoogleBatchRequest {
  const item = form.items?.[targetIndex];

  if (!item) {
    throw new AppError("invalid_item_index", "The provided item index is out of range.", {
      targetIndex,
      itemCount: form.items?.length ?? 0,
    });
  }

  if (!item.imageItem) {
    throw new AppError("invalid_item_type", "The specified item is not an image block.", {
      targetIndex,
      itemId: item.itemId ?? null,
    });
  }

  const nextItem: GoogleFormItem = {
    ...item,
    imageItem: {
      ...item.imageItem,
      image: {
        ...item.imageItem.image,
      },
    },
  };
  const updateMask: string[] = [];

  if (updates.title !== undefined) {
    nextItem.title = updates.title;
    updateMask.push("title");
  }

  if (updates.description !== undefined) {
    nextItem.description = updates.description;
    updateMask.push("description");
  }

  if (updates.image !== undefined) {
    nextItem.imageItem!.image = buildImage(updates.image);
    updateMask.push("imageItem.image");
  }

  if (updateMask.length === 0) {
    throw new AppError("invalid_request", "At least one image item field must be provided.");
  }

  return {
    updateItem: {
      item: nextItem,
      location: { index: targetIndex },
      updateMask: updateMask.join(","),
    },
  };
}

export function buildUpdateQuestionImageRequest(
  form: GoogleForm,
  targetIndex: number,
  image: ImageInput,
): GoogleBatchRequest {
  const item = form.items?.[targetIndex];

  if (!item) {
    throw new AppError("invalid_item_index", "The provided item index is out of range.", {
      targetIndex,
      itemCount: form.items?.length ?? 0,
    });
  }

  const nextItem = ensureEditableQuestionItem(item, targetIndex);
  nextItem.questionItem = {
    ...nextItem.questionItem,
    image: buildImage(image),
  };

  return {
    updateItem: {
      item: nextItem,
      location: { index: targetIndex },
      updateMask: "questionItem.image",
    },
  };
}

export function buildUpdateQuestionRequest(
  form: GoogleForm,
  targetIndex: number,
  updates: {
    title?: string;
    description?: string;
    required?: boolean;
    options?: ChoiceOptionInput[];
    choiceType?: ChoiceQuestionType;
    paragraph?: boolean;
  },
): GoogleBatchRequest {
  const item = form.items?.[targetIndex];

  if (!item) {
    throw new AppError("invalid_item_index", "The provided item index is out of range.", {
      targetIndex,
      itemCount: form.items?.length ?? 0,
    });
  }

  const nextItem = ensureEditableQuestionItem(item, targetIndex);
  const nextQuestion = nextItem.questionItem!.question!;
  const updateMask: string[] = [];

  if (updates.title !== undefined) {
    nextItem.title = updates.title;
    updateMask.push("title");
  }

  if (updates.description !== undefined) {
    nextItem.description = updates.description;
    updateMask.push("description");
  }

  if (updates.required !== undefined) {
    nextQuestion.required = updates.required;
    updateMask.push("questionItem.question.required");
  }

  if (updates.paragraph !== undefined) {
    if (!nextQuestion.textQuestion) {
      throw new AppError(
        "invalid_item_type",
        "Only text questions can update paragraph mode.",
        {
          targetIndex,
          itemId: item.itemId ?? null,
        },
      );
    }

    nextQuestion.textQuestion = {
      ...nextQuestion.textQuestion,
      paragraph: updates.paragraph,
    };
    updateMask.push("questionItem.question.textQuestion.paragraph");
  }

  if (updates.choiceType !== undefined) {
    if (!nextQuestion.choiceQuestion) {
      throw new AppError(
        "invalid_item_type",
        "Only choice questions can update choice type.",
        {
          targetIndex,
          itemId: item.itemId ?? null,
        },
      );
    }

    nextQuestion.choiceQuestion = {
      ...nextQuestion.choiceQuestion,
      type: updates.choiceType,
    };
    updateMask.push("questionItem.question.choiceQuestion.type");
  }

  if (updates.options !== undefined) {
    const choiceQuestion = nextQuestion.choiceQuestion;

    if (!choiceQuestion) {
      throw new AppError(
        "invalid_item_type",
        "Only multiple-choice, checkbox, and dropdown questions can update options.",
        {
          targetIndex,
          itemId: item.itemId ?? null,
        },
      );
    }

    const resolvedType = updates.choiceType ?? choiceQuestion.type;

    if (
      resolvedType !== "RADIO" &&
      resolvedType !== "CHECKBOX" &&
      resolvedType !== "DROP_DOWN"
    ) {
      throw new AppError("invalid_item_type", "Unsupported choice question type.", {
        targetIndex,
        itemId: item.itemId ?? null,
        choiceType: resolvedType ?? null,
      });
    }

    nextQuestion.choiceQuestion = {
      ...choiceQuestion,
      type: resolvedType,
      options: toChoiceOptions(updates.options, resolvedType),
    };
    updateMask.push("questionItem.question.choiceQuestion.options");
  }

  if (updateMask.length === 0) {
    throw new AppError("invalid_request", "At least one question field must be provided.");
  }

  return {
    updateItem: {
      item: nextItem,
      location: { index: targetIndex },
      updateMask: updateMask.join(","),
    },
  };
}

export function resolveItemIndex(
  form: GoogleForm,
  selector: { itemId?: string; currentIndex?: number },
): number {
  const items = form.items ?? [];

  if (selector.currentIndex !== undefined) {
    if (selector.currentIndex < 0 || selector.currentIndex >= items.length) {
      throw new AppError("invalid_item_index", "The provided item index is out of range.", {
        currentIndex: selector.currentIndex,
        itemCount: items.length,
      });
    }

    return selector.currentIndex;
  }

  const itemIndex = items.findIndex((item) => item.itemId === selector.itemId);

  if (itemIndex === -1) {
    throw new AppError("item_not_found", "The specified itemId was not found in the form.", {
      itemId: selector.itemId,
    });
  }

  return itemIndex;
}

export function normalizeFormItem(item: GoogleFormItem, index: number): NormalizedItem {
  const question = item.questionItem?.question;
  const choiceQuestion = question?.choiceQuestion;
  const textQuestion = question?.textQuestion;
  const image = item.imageItem?.image ?? item.questionItem?.image ?? null;
  const optionDetails =
    choiceQuestion?.options?.map((option) => ({
      value: option.value ?? null,
      isOther: option.isOther === true,
      goToAction: option.goToAction ?? null,
      goToSectionId: option.goToSectionId ?? null,
    })) ?? [];

  const kind: NormalizedItem["kind"] = item.textItem
    ? "text_block"
    : textQuestion?.paragraph
      ? "paragraph"
      : textQuestion
        ? "text"
        : choiceQuestion?.type === "RADIO"
          ? "multiple_choice"
          : choiceQuestion?.type === "CHECKBOX"
            ? "checkbox"
            : choiceQuestion?.type === "DROP_DOWN"
              ? "dropdown"
              : item.questionGroupItem
                ? "question_group"
                : item.pageBreakItem
                  ? "page_break"
                  : item.videoItem
                    ? "video"
                    : item.imageItem
                      ? "image"
                      : "unknown";

  return {
    index,
    itemId: item.itemId ?? null,
    title: item.title ?? null,
    description: item.description ?? null,
    kind,
    required: question?.required ?? null,
    questionId: question?.questionId ?? null,
    options: optionDetails.map((option) => option.value ?? "").filter(Boolean),
    optionDetails,
    choiceType:
      choiceQuestion?.type === "RADIO" ||
      choiceQuestion?.type === "CHECKBOX" ||
      choiceQuestion?.type === "DROP_DOWN"
        ? choiceQuestion.type
        : null,
    hasOtherOption: optionDetails.some((option) => option.isOther),
    isParagraph: textQuestion?.paragraph === true,
    hasImageItem: item.imageItem !== undefined,
    hasQuestionImage: item.questionItem?.image !== undefined,
    imageAltText: image?.altText ?? null,
    imageContentUri: image?.contentUri ?? image?.sourceUri ?? null,
  };
}

export function normalizeFormItems(form: GoogleForm): NormalizedItem[] {
  return (form.items ?? []).map((item, index) => normalizeFormItem(item, index));
}
