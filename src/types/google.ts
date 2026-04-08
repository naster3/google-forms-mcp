import type { forms_v1 } from "googleapis";

export type GoogleForm = forms_v1.Schema$Form;
export type GoogleFormItem = forms_v1.Schema$Item;
export type GoogleFormResponse = forms_v1.Schema$FormResponse;
export type GoogleBatchRequest = forms_v1.Schema$Request;
export type GoogleChoiceOption = forms_v1.Schema$Option;

export type ChoiceQuestionType = "RADIO" | "CHECKBOX" | "DROP_DOWN";
export type SectionNavigationAction = "NEXT_SECTION" | "RESTART_FORM" | "SUBMIT_FORM";
export type MediaAlignment = "LEFT" | "CENTER" | "RIGHT";

export type NormalizedOption = {
  value: string | null;
  isOther: boolean;
  goToAction: string | null;
  goToSectionId: string | null;
};

export type NormalizedItem = {
  index: number;
  itemId: string | null;
  title: string | null;
  description: string | null;
  kind:
    | "text"
    | "paragraph"
    | "multiple_choice"
    | "checkbox"
    | "dropdown"
    | "text_block"
    | "question_group"
    | "page_break"
    | "video"
    | "image"
    | "unknown";
  required: boolean | null;
  questionId: string | null;
  options: string[];
  optionDetails: NormalizedOption[];
  choiceType: ChoiceQuestionType | null;
  hasOtherOption: boolean;
  isParagraph: boolean;
  hasImageItem: boolean;
  hasQuestionImage: boolean;
  imageAltText: string | null;
  imageContentUri: string | null;
};
