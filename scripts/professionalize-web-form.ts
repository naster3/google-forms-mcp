import type { forms_v1 } from "googleapis";
import { loadAuthorizedClient } from "../src/auth/oauth.js";
import { AppError } from "../src/google/errors.js";
import { GoogleFormsClient } from "../src/google/forms-client.js";
import {
  buildCreateChoiceQuestionRequest,
  buildCreateParagraphQuestionRequest,
  buildCreateSectionRequest,
  buildCreateTextBlockRequest,
  buildCreateTextQuestionRequest,
  buildUpdateFormInfoRequests,
  buildUpdateQuestionRequest,
  buildUpdateSectionRequest,
  buildUpdateTextBlockRequest,
  normalizeFormItems,
  resolveItemIndex,
  type ChoiceOptionInput,
} from "../src/tools/helpers.js";
import type {
  ChoiceQuestionType,
  GoogleBatchRequest,
  GoogleForm,
  GoogleFormItem,
  SectionNavigationAction,
} from "../src/types/google.js";
import { loadEnv } from "../src/utils/env.js";
import { Logger } from "../src/utils/logger.js";

const FINAL_FORM_TITLE =
  "Formulario de levantamiento de requerimientos para paginas web / Website project requirements form";
const FINAL_FORM_DESCRIPTION =
  "Comparte la informacion clave de tu proyecto web para preparar una propuesta clara, profesional y alineada a tu negocio. / Share the key information about your website project so we can prepare a clear, professional proposal aligned with your business.";

type SpecChoiceOption =
  | string
  | {
      value?: string;
      isOther?: boolean;
      goToSectionKey?: string;
      goToAction?: SectionNavigationAction;
    };

type SpecBase = {
  key: string;
  title: string;
  description?: string;
  reuseItemId?: string;
};

type QuestionSpec = SpecBase & {
  itemKind: "question";
  questionKind: "text" | "paragraph" | "multiple_choice" | "checkbox" | "dropdown";
  required: boolean;
  options?: SpecChoiceOption[];
};

type SectionSpec = SpecBase & {
  itemKind: "section";
};

type TextBlockSpec = SpecBase & {
  itemKind: "text_block";
};

type ItemSpec = QuestionSpec | SectionSpec | TextBlockSpec;

type Summary = {
  reused: string[];
  edited: string[];
  added: string[];
  removed: string[];
  sections: string[];
};

function getTargetFormId(): string {
  const formId = process.env.TARGET_FORM_ID?.trim();

  if (!formId) {
    throw new Error("TARGET_FORM_ID is required for professionalize-web-form.");
  }

  return formId;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function yesNoOptions(): SpecChoiceOption[] {
  return ["Si / Yes", "No / No"];
}

function materializeChoiceOptions(
  options: SpecChoiceOption[] | undefined,
  resolvedItemIds: Map<string, string>,
  includeNavigation: boolean,
): ChoiceOptionInput[] {
  return (options ?? []).map((option) => {
    if (typeof option === "string") {
      return option;
    }

    return {
      ...(option.value !== undefined ? { value: option.value } : {}),
      ...(option.isOther === true ? { isOther: true } : {}),
      ...(includeNavigation && option.goToSectionKey
        ? (() => {
            const goToSectionId = resolvedItemIds.get(option.goToSectionKey);
            return goToSectionId !== undefined ? { goToSectionId } : {};
          })()
        : {}),
      ...(includeNavigation && option.goToAction !== undefined
        ? { goToAction: option.goToAction }
        : {}),
    };
  });
}

function matchesSpecKind(item: GoogleFormItem, spec: ItemSpec): boolean {
  if (spec.itemKind === "section") {
    return item.pageBreakItem !== undefined;
  }

  if (spec.itemKind === "text_block") {
    return item.textItem !== undefined;
  }

  const question = item.questionItem?.question;

  if (!question) {
    return false;
  }

  switch (spec.questionKind) {
    case "text":
      return question.textQuestion?.paragraph !== true;
    case "paragraph":
      return question.textQuestion !== undefined;
    case "multiple_choice":
      return question.choiceQuestion?.type === "RADIO";
    case "checkbox":
      return question.choiceQuestion?.type === "CHECKBOX";
    case "dropdown":
      return question.choiceQuestion?.type === "DROP_DOWN";
  }
}

function findItemByTitle(form: GoogleForm, spec: ItemSpec): GoogleFormItem | undefined {
  return (form.items ?? []).find(
    (item) => item.title === spec.title && matchesSpecKind(item, spec),
  );
}

function buildCreateRequest(
  spec: ItemSpec,
  index: number,
  resolvedItemIds: Map<string, string>,
): GoogleBatchRequest {
  switch (spec.itemKind) {
    case "section":
      return buildCreateSectionRequest(spec.title, spec.description, index);
    case "text_block":
      return buildCreateTextBlockRequest(spec.title, spec.description, index);
    case "question":
      switch (spec.questionKind) {
        case "text":
          return buildCreateTextQuestionRequest(
            spec.title,
            spec.required,
            index,
            spec.description,
          );
        case "paragraph":
          return buildCreateParagraphQuestionRequest(
            spec.title,
            spec.required,
            index,
            spec.description,
          );
        case "multiple_choice":
          return buildCreateChoiceQuestionRequest(
            spec.title,
            materializeChoiceOptions(spec.options, resolvedItemIds, false),
            spec.required,
            index,
            "RADIO",
            spec.description,
          );
        case "checkbox":
          return buildCreateChoiceQuestionRequest(
            spec.title,
            materializeChoiceOptions(spec.options, resolvedItemIds, false),
            spec.required,
            index,
            "CHECKBOX",
            spec.description,
          );
        case "dropdown":
          return buildCreateChoiceQuestionRequest(
            spec.title,
            materializeChoiceOptions(spec.options, resolvedItemIds, false),
            spec.required,
            index,
            "DROP_DOWN",
            spec.description,
          );
      }
  }
}

function buildUpdateRequest(
  form: GoogleForm,
  spec: ItemSpec,
  resolvedItemIds: Map<string, string>,
): GoogleBatchRequest | null {
  const itemId = resolvedItemIds.get(spec.key);

  if (!itemId) {
    throw new AppError("item_not_found", `Missing resolved item id for key ${spec.key}.`);
  }

  const targetIndex = resolveItemIndex(form, { itemId });

  if (spec.itemKind === "section") {
    return buildUpdateSectionRequest(form, targetIndex, {
      title: spec.title,
      ...(spec.description !== undefined ? { description: spec.description } : {}),
    });
  }

  if (spec.itemKind === "text_block") {
    return buildUpdateTextBlockRequest(form, targetIndex, {
      title: spec.title,
      ...(spec.description !== undefined ? { description: spec.description } : {}),
    });
  }

  const choiceTypeMap: Record<QuestionSpec["questionKind"], ChoiceQuestionType | undefined> = {
    text: undefined,
    paragraph: undefined,
    multiple_choice: "RADIO",
    checkbox: "CHECKBOX",
    dropdown: "DROP_DOWN",
  };
  const choiceType = choiceTypeMap[spec.questionKind];

  return buildUpdateQuestionRequest(form, targetIndex, {
    title: spec.title,
    ...(spec.description !== undefined ? { description: spec.description } : {}),
    required: spec.required,
    ...(spec.questionKind === "paragraph" ? { paragraph: true } : {}),
    ...(spec.questionKind === "text" ? { paragraph: false } : {}),
    ...(choiceType !== undefined ? { choiceType } : {}),
    ...(spec.options !== undefined
      ? {
          options: materializeChoiceOptions(spec.options, resolvedItemIds, true),
        }
      : {}),
  });
}

async function runBatchedUpdate(
  formsClient: GoogleFormsClient,
  formId: string,
  requests: GoogleBatchRequest[],
): Promise<void> {
  for (const requestChunk of chunk(requests, 20)) {
    await formsClient.batchUpdate(formId, requestChunk, false);
  }
}

async function reorderItems(
  formsClient: GoogleFormsClient,
  formId: string,
  desiredOrder: string[],
): Promise<void> {
  const form = await formsClient.getForm(formId);
  const currentOrder = (form.items ?? []).map((item) => item.itemId ?? "");

  for (const [targetIndex, itemId] of desiredOrder.entries()) {
    const currentIndex = currentOrder.indexOf(itemId);

    if (currentIndex === -1) {
      throw new AppError("item_not_found", `Cannot reorder missing item ${itemId}.`);
    }

    if (currentIndex === targetIndex) {
      continue;
    }

    await formsClient.batchUpdate(
      formId,
      [
        {
          moveItem: {
            originalLocation: { index: currentIndex },
            newLocation: { index: targetIndex },
          },
        },
      ],
      false,
    );

    const [movedItemId] = currentOrder.splice(currentIndex, 1);
    if (!movedItemId) {
      throw new AppError("item_not_found", `Failed to move missing item ${itemId}.`);
    }
    currentOrder.splice(targetIndex, 0, movedItemId);
  }
}

const specs: ItemSpec[] = [
  {
    key: "section_general_intro",
    itemKind: "text_block",
    title: "Informacion general del cliente / General client information",
    description:
      "Comparte tus datos principales para identificar correctamente el proyecto y el equipo de contacto. / Share your basic details so we can correctly identify the project and the contact team.",
  },
  {
    key: "full_name",
    itemKind: "question",
    questionKind: "text",
    reuseItemId: "4cf61491",
    title: "Nombre completo / Full name",
    required: true,
  },
  {
    key: "company_name",
    itemKind: "question",
    questionKind: "text",
    reuseItemId: "1b702974",
    title: "Nombre de la empresa o negocio / Company or business name",
    required: true,
  },
  {
    key: "email",
    itemKind: "question",
    questionKind: "text",
    reuseItemId: "316c9d36",
    title: "Correo electronico / Email address",
    required: true,
  },
  {
    key: "phone",
    itemKind: "question",
    questionKind: "text",
    reuseItemId: "1ed2eaf1",
    title: "Numero de telefono o WhatsApp / Phone number or WhatsApp",
    required: false,
  },
  {
    key: "company_role",
    itemKind: "question",
    questionKind: "text",
    title: "Cargo dentro de la empresa / Role in the company",
    required: false,
  },
  {
    key: "country_location",
    itemKind: "question",
    questionKind: "text",
    title: "Pais o ubicacion / Country or location",
    required: false,
  },
  {
    key: "section_business",
    itemKind: "section",
    reuseItemId: "630e406b",
    title: "Informacion del negocio / Business information",
    description:
      "Describe tu negocio para entender mejor el contexto comercial del sitio web. / Describe your business so we can better understand the commercial context of the website.",
  },
  {
    key: "business_type",
    itemKind: "question",
    questionKind: "dropdown",
    reuseItemId: "684f655f",
    title: "A que se dedica su negocio? / What does your business do?",
    description:
      "Selecciona la categoria que mejor represente tu actividad principal. / Choose the category that best represents your main activity.",
    required: false,
    options: [
      "Restaurante / Restaurant",
      "Tienda minorista / Retail store",
      "Salud y bienestar / Health and wellness",
      "Belleza y cuidado personal / Beauty and personal care",
      "Servicios profesionales / Professional services",
      "Educacion / Education",
      "Tecnologia / Technology",
      "Construccion o inmobiliaria / Construction or real estate",
      "Turismo y hospitalidad / Tourism and hospitality",
      "Otro / Other",
    ],
  },
  {
    key: "business_type_other",
    itemKind: "question",
    questionKind: "text",
    title: "Si selecciono Otro, especifique / If you selected Other, please specify",
    required: false,
  },
  {
    key: "business_description",
    itemKind: "question",
    questionKind: "paragraph",
    reuseItemId: "2edcadfc",
    title:
      "Describa brevemente su empresa, productos o servicios / Briefly describe your company, products, or services",
    description:
      "Incluya que vende, a quien sirve y que hace diferente a su negocio. / Include what you sell, who you serve, and what makes your business different.",
    required: true,
  },
  {
    key: "business_operating_time",
    itemKind: "question",
    questionKind: "text",
    reuseItemId: "4815f5db",
    title:
      "Cuanto tiempo tiene operando su negocio? / How long has your business been operating?",
    required: false,
  },
  {
    key: "target_market",
    itemKind: "question",
    questionKind: "paragraph",
    reuseItemId: "16c620c7",
    title:
      "Cual es su mercado o publico objetivo? / What is your target market or audience?",
    required: false,
  },
  {
    key: "business_scope",
    itemKind: "question",
    questionKind: "multiple_choice",
    title:
      "Su negocio opera localmente, nacionalmente o internacionalmente? / Does your business operate locally, nationally, or internationally?",
    required: false,
    options: [
      "Localmente / Locally",
      "Nacionalmente / Nationally",
      "Internacionalmente / Internationally",
      "Mixto / Mixed",
    ],
  },
  {
    key: "section_goals",
    itemKind: "section",
    title: "Objetivo del proyecto web / Website project goals",
    description:
      "Explica que quieres lograr con la nueva pagina web y como mediras el exito. / Explain what you want to achieve with the new website and how you will measure success.",
  },
  {
    key: "main_goal",
    itemKind: "question",
    questionKind: "multiple_choice",
    reuseItemId: "25a2684c",
    title:
      "Cual es el objetivo principal de la pagina web? / What is the main goal of the website?",
    required: true,
    options: [
      "Mostrar informacion del negocio / Show business information",
      "Generar clientes potenciales / Generate leads",
      "Vender productos / Sell products",
      "Reservas o citas / Bookings or appointments",
      "Portafolio / Portfolio",
      "Blog o contenido / Blog or content",
      "Soporte al cliente / Customer support",
      { isOther: true },
    ],
  },
  {
    key: "main_action",
    itemKind: "question",
    questionKind: "multiple_choice",
    reuseItemId: "6098e49a",
    title:
      "Cual es la accion numero uno que quiere que realicen los visitantes? / What is the number one action you want visitors to take?",
    required: false,
    options: [
      "Comprar / Buy",
      "Escribir por WhatsApp / Message on WhatsApp",
      "Llenar un formulario / Fill out a form",
      "Llamar / Call",
      "Reservar una cita / Book an appointment",
      "Solicitar cotizacion / Request a quote",
      "Seguir en redes sociales / Follow on social media",
    ],
  },
  {
    key: "website_problem",
    itemKind: "question",
    questionKind: "paragraph",
    title:
      "Que problema desea resolver con esta web? / What problem do you want this website to solve?",
    required: false,
  },
  {
    key: "website_outcome_months",
    itemKind: "question",
    questionKind: "paragraph",
    title:
      "Que espera lograr con el sitio web en los proximos meses? / What do you expect to achieve with the website in the next few months?",
    required: false,
  },
  {
    key: "section_current_status",
    itemKind: "section",
    title: "Estado actual del proyecto / Current project status",
    description:
      "Indica con que recursos cuenta hoy y si ya existe una web previa. / Tell us what resources you already have today and whether there is an existing website.",
  },
  {
    key: "has_domain",
    itemKind: "question",
    questionKind: "multiple_choice",
    title: "Tiene dominio registrado? / Do you have a registered domain?",
    required: false,
    options: yesNoOptions(),
  },
  {
    key: "has_hosting",
    itemKind: "question",
    questionKind: "multiple_choice",
    title: "Tiene hosting contratado? / Do you have hosting?",
    required: false,
    options: yesNoOptions(),
  },
  {
    key: "has_logo",
    itemKind: "question",
    questionKind: "multiple_choice",
    reuseItemId: "17a61b17",
    title:
      "Ya cuenta con logo e identidad visual? / Do you already have a logo and visual identity?",
    required: false,
    options: yesNoOptions(),
  },
  {
    key: "has_social_media",
    itemKind: "question",
    questionKind: "multiple_choice",
    title: "Tiene redes sociales activas? / Do you have active social media accounts?",
    required: false,
    options: yesNoOptions(),
  },
  {
    key: "has_current_website",
    itemKind: "question",
    questionKind: "multiple_choice",
    title: "Ya tiene una pagina web actualmente? / Do you currently have a website?",
    required: true,
    options: [
      { value: "Si / Yes", goToSectionKey: "section_current_website_url" },
      { value: "No / No", goToSectionKey: "section_content" },
    ],
  },
  {
    key: "section_current_website_url",
    itemKind: "section",
    title: "URL del sitio web actual / Current website URL",
    description:
      "Comparte la direccion actual para revisar estructura, contenido y oportunidades de mejora. / Share the current address so we can review the structure, content, and improvement opportunities.",
  },
  {
    key: "current_website_url",
    itemKind: "question",
    questionKind: "text",
    title: "Cual es la URL? / What is the URL?",
    required: false,
  },
  {
    key: "section_content",
    itemKind: "section",
    title: "Contenido y paginas necesarias / Content and required pages",
    description:
      "Define las secciones, el contenido disponible y el apoyo que necesitas para prepararlo. / Define the sections, available content, and the support you need to prepare it.",
  },
  {
    key: "pages_needed",
    itemKind: "question",
    questionKind: "checkbox",
    reuseItemId: "14978247",
    title:
      "Que secciones o paginas necesita en su sitio web? / What sections or pages do you need on your website?",
    required: false,
    options: [
      "Inicio / Home",
      "Nosotros / About us",
      "Servicios / Services",
      "Productos / Products",
      "Tienda / Store",
      "Portafolio / Portfolio",
      "Testimonios / Testimonials",
      "Preguntas frecuentes / FAQ",
      "Blog / Blog",
      "Contacto / Contact",
      "Reservas / Bookings",
      { isOther: true },
    ],
  },
  {
    key: "content_ready",
    itemKind: "question",
    questionKind: "multiple_choice",
    title: "Ya tiene el contenido preparado? / Do you already have the content prepared?",
    required: false,
    options: [
      "Si, casi todo / Yes, almost everything",
      "Parcialmente / Partially",
      "No, aun no / No, not yet",
    ],
  },
  {
    key: "content_provider",
    itemKind: "question",
    questionKind: "multiple_choice",
    title:
      "Quien proporcionara los textos e imagenes? / Who will provide the text and images?",
    required: false,
    options: [
      "Nuestro equipo / Our team",
      "Su empresa / Your company",
      "Ambas partes / Both sides",
      "Aun no esta definido / Not defined yet",
    ],
  },
  {
    key: "needs_content_writing",
    itemKind: "question",
    questionKind: "multiple_choice",
    title:
      "Necesita ayuda con redaccion de contenido? / Do you need help with content writing?",
    required: false,
    options: yesNoOptions(),
  },
  {
    key: "needs_visual_material",
    itemKind: "question",
    questionKind: "multiple_choice",
    reuseItemId: "33a50548",
    title:
      "Necesita ayuda con fotografias, banners o material visual? / Do you need help with photos, banners, or visual material?",
    required: false,
    options: [
      "Tengo material listo / I already have material ready",
      "Necesito apoyo parcial / I need partial support",
      "Necesito apoyo completo / I need full support",
    ],
  },
  {
    key: "section_design",
    itemKind: "section",
    reuseItemId: "6b40d340",
    title: "Diseno y estilo visual / Design and visual style",
    description:
      "Comparte la direccion visual deseada y referencias utiles para el look and feel. / Share the desired visual direction and any helpful references for the look and feel.",
  },
  {
    key: "visual_style",
    itemKind: "question",
    questionKind: "multiple_choice",
    reuseItemId: "22527ddb",
    title:
      "Que estilo visual desea para la web? / What visual style do you want for the website?",
    required: false,
    options: [
      "Moderno / Modern",
      "Minimalista / Minimalist",
      "Corporativo / Corporate",
      "Elegante / Elegant",
      "Creativo / Creative",
      "Tecnologico / Tech-focused",
      { isOther: true },
    ],
  },
  {
    key: "brand_colors",
    itemKind: "question",
    questionKind: "text",
    title: "Tiene colores de marca definidos? / Do you have defined brand colors?",
    required: false,
  },
  {
    key: "reference_links",
    itemKind: "question",
    questionKind: "paragraph",
    title: "Agregue enlaces de referencia / Add reference links",
    description:
      "Pegue uno o varios enlaces, idealmente uno por linea. / Paste one or more links, ideally one per line.",
    required: false,
  },
  {
    key: "reference_likes",
    itemKind: "question",
    questionKind: "paragraph",
    title:
      "Que le gusta de esas referencias? / What do you like about those references?",
    required: false,
  },
  {
    key: "design_avoid",
    itemKind: "question",
    questionKind: "paragraph",
    title: "Que quiere evitar en el diseno? / What do you want to avoid in the design?",
    required: false,
  },
  {
    key: "section_features",
    itemKind: "section",
    title: "Funcionalidades requeridas / Required features",
    description:
      "Indica que funciones debe incluir el sitio web para apoyar la operacion del negocio. / Indicate which features the website should include to support the business operation.",
  },
  {
    key: "required_features",
    itemKind: "question",
    questionKind: "checkbox",
    reuseItemId: "4de0c34b",
    title: "Que funcionalidades necesita? / What features do you need?",
    required: false,
    options: [
      "Formulario de contacto / Contact form",
      "Boton de WhatsApp / WhatsApp button",
      "Chat en linea / Live chat",
      "Galeria de imagenes / Image gallery",
      "Blog / Blog",
      "Tienda en linea / Online store",
      "Carrito de compras / Shopping cart",
      "Pagos en linea / Online payments",
      "Reservas o citas / Bookings or appointments",
      "Registro de usuarios / User registration",
      "Panel administrativo / Admin panel",
      "Integracion con redes sociales / Social media integration",
      "Mapa de ubicacion / Location map",
      "Multi idioma / Multi-language",
      { isOther: true },
    ],
  },
  {
    key: "website_languages",
    itemKind: "question",
    questionKind: "checkbox",
    reuseItemId: "2fa44501",
    title:
      "Que idiomas debe tener el sitio web? / What languages should the website support?",
    required: false,
    options: ["Espanol / Spanish", "Ingles / English", "Frances / French", { isOther: true }],
  },
  {
    key: "special_functionality",
    itemKind: "question",
    questionKind: "paragraph",
    title:
      "Describa cualquier funcionalidad especial / Describe any special functionality",
    required: false,
  },
  {
    key: "section_integrations",
    itemKind: "section",
    title: "Integraciones y herramientas externas / Integrations and external tools",
    description:
      "Selecciona las plataformas con las que la web debera conectarse. / Select the platforms the website should connect with.",
  },
  {
    key: "integrations_needed",
    itemKind: "question",
    questionKind: "checkbox",
    title:
      "Necesita integrar la web con alguna plataforma? / Do you need to integrate the website with any platform?",
    required: false,
    options: [
      "Ninguna / None",
      "WhatsApp / WhatsApp",
      "Instagram / Instagram",
      "Facebook / Facebook",
      "Google Maps / Google Maps",
      "Google Analytics / Google Analytics",
      "Meta Pixel / Meta Pixel",
      "CRM / CRM",
      "Email marketing / Email marketing",
      "Calendario de reservas / Booking calendar",
      "Pasarela de pago / Payment gateway",
      { isOther: true },
    ],
  },
  {
    key: "integrations_details",
    itemKind: "question",
    questionKind: "paragraph",
    title: "Especifique cuales / Please specify which ones",
    required: false,
  },
  {
    key: "section_seo",
    itemKind: "section",
    title: "SEO, visibilidad y marketing / SEO, visibility and marketing",
    description:
      "Aclara si el sitio necesitara visibilidad organica, medicion y apoyo de marketing. / Clarify whether the website will need organic visibility, measurement, and marketing support.",
  },
  {
    key: "appear_on_google",
    itemKind: "question",
    questionKind: "multiple_choice",
    title: "Desea que su web aparezca en Google? / Do you want your website to appear on Google?",
    required: false,
    options: yesNoOptions(),
  },
  {
    key: "needs_basic_seo",
    itemKind: "question",
    questionKind: "multiple_choice",
    reuseItemId: "6a1d8e75",
    title: "Necesita SEO basico? / Do you need basic SEO?",
    required: false,
    options: yesNoOptions(),
  },
  {
    key: "needs_keyword_help",
    itemKind: "question",
    questionKind: "multiple_choice",
    title:
      "Necesita ayuda con palabras clave o estrategia digital? / Do you need help with keywords or digital strategy?",
    required: false,
    options: yesNoOptions(),
  },
  {
    key: "ads_after_launch",
    itemKind: "question",
    questionKind: "multiple_choice",
    title:
      "Planea hacer campanas publicitarias luego del lanzamiento? / Do you plan to run advertising campaigns after launch?",
    required: false,
    options: [
      "Si / Yes",
      "No / No",
      "Aun no lo se / I am not sure yet",
    ],
  },
  {
    key: "section_admin",
    itemKind: "section",
    title: "Administracion y mantenimiento / Administration and maintenance",
    description:
      "Define quien administrara la web y el nivel de soporte esperado despues de la entrega. / Define who will manage the website and the level of support expected after delivery.",
  },
  {
    key: "site_manager",
    itemKind: "question",
    questionKind: "multiple_choice",
    title:
      "Quien administrara la pagina luego de ser entregada? / Who will manage the website after delivery?",
    required: false,
    options: [
      "Mi equipo interno / My internal team",
      "Su equipo / Your team",
      "Un tercero / A third party",
      "Aun no esta definido / Not defined yet",
    ],
  },
  {
    key: "needs_admin_panel",
    itemKind: "question",
    questionKind: "multiple_choice",
    title: "Necesita panel de administracion? / Do you need an admin panel?",
    required: false,
    options: yesNoOptions(),
  },
  {
    key: "needs_training",
    itemKind: "question",
    questionKind: "multiple_choice",
    title: "Necesita capacitacion para usar la web? / Do you need training to use the website?",
    required: false,
    options: yesNoOptions(),
  },
  {
    key: "needs_maintenance",
    itemKind: "question",
    questionKind: "multiple_choice",
    title:
      "Desea soporte o mantenimiento mensual? / Do you want monthly support or maintenance?",
    required: false,
    options: yesNoOptions(),
  },
  {
    key: "section_timeline",
    itemKind: "section",
    title: "Tiempo, prioridad y presupuesto / Timeline, priority and budget",
    description:
      "Comparte el ritmo esperado del proyecto para orientar alcance, prioridad y propuesta. / Share the expected pace of the project so we can guide scope, priority, and proposal.",
  },
  {
    key: "desired_launch_time",
    itemKind: "question",
    questionKind: "multiple_choice",
    title: "Cuando le gustaria tener lista la web? / When would you like the website to be ready?",
    required: false,
    options: [
      "Lo antes posible / As soon as possible",
      "En menos de 1 mes / In less than 1 month",
      "En 1 a 3 meses / In 1 to 3 months",
      "En mas de 3 meses / In more than 3 months",
      "Sin fecha fija / No fixed date",
    ],
  },
  {
    key: "project_urgency",
    itemKind: "question",
    questionKind: "multiple_choice",
    title: "Que tan urgente es este proyecto? / How urgent is this project?",
    required: false,
    options: ["Baja / Low", "Media / Medium", "Alta / High"],
  },
  {
    key: "estimated_budget",
    itemKind: "question",
    questionKind: "multiple_choice",
    title: "Tiene un presupuesto estimado? / Do you have an estimated budget?",
    required: false,
    options: [
      "Aun no definido / Not defined yet",
      "Presupuesto limitado / Limited budget",
      "Presupuesto medio / Medium budget",
      "Presupuesto amplio / Flexible budget",
    ],
  },
  {
    key: "budget_range",
    itemKind: "question",
    questionKind: "text",
    title: "Si desea, indique un rango aproximado / If you want, indicate an approximate range",
    required: false,
  },
  {
    key: "section_final_comments",
    itemKind: "section",
    title: "Comentarios finales / Final comments",
    description:
      "Agrega cualquier contexto final que nos ayude a entender mejor el proyecto. / Add any final context that helps us better understand the project.",
  },
  {
    key: "additional_project_details",
    itemKind: "question",
    questionKind: "paragraph",
    reuseItemId: "5e976e64",
    title:
      "Hay algun detalle adicional que debamos saber sobre su proyecto? / Is there any additional detail we should know about your project?",
    required: false,
  },
  {
    key: "successful_outcome",
    itemKind: "question",
    questionKind: "paragraph",
    reuseItemId: "6d78f4ec",
    title:
      "Que seria un resultado exitoso para usted? / What would be a successful outcome for you?",
    required: false,
  },
  {
    key: "preferred_contact_method",
    itemKind: "question",
    questionKind: "multiple_choice",
    title:
      "Como prefiere que le contactemos? / How do you prefer us to contact you?",
    required: false,
    options: [
      "Correo electronico / Email",
      "WhatsApp / WhatsApp",
      "Llamada telefonica / Phone call",
      "Videollamada / Video call",
    ],
  },
];

async function main(): Promise<void> {
  const targetFormId = getTargetFormId();
  const env = loadEnv();
  const logger = new Logger(env.logLevel);
  const authClient = await loadAuthorizedClient(env, logger);
  const formsClient = new GoogleFormsClient(authClient);

  logger.info("Loading target form for professionalization.", { formId: targetFormId });
  let form = await formsClient.getForm(targetFormId);

  const resolvedItemIds = new Map<string, string>();
  const summary: Summary = {
    reused: [],
    edited: [],
    added: [],
    removed: [],
    sections: specs
      .filter((spec) => spec.itemKind === "section" || spec.itemKind === "text_block")
      .map((spec) => spec.title),
  };

  const createSpecs: ItemSpec[] = [];

  for (const spec of specs) {
    if (spec.reuseItemId) {
      const targetIndex = resolveItemIndex(form, { itemId: spec.reuseItemId });
      const targetItem = form.items?.[targetIndex];

      if (!targetItem) {
        throw new AppError("item_not_found", `Missing existing item ${spec.reuseItemId}.`);
      }

      resolvedItemIds.set(spec.key, spec.reuseItemId);
      summary.reused.push(spec.title);
      continue;
    }

    const existingMatch = findItemByTitle(form, spec);

    if (existingMatch?.itemId) {
      resolvedItemIds.set(spec.key, existingMatch.itemId);
      continue;
    }

    createSpecs.push(spec);
  }

  if (createSpecs.length > 0) {
    logger.info("Creating missing form items.", { count: createSpecs.length });
    const startIndex = form.items?.length ?? 0;
    const createRequests = createSpecs.map((spec, offset) =>
      buildCreateRequest(spec, startIndex + offset, resolvedItemIds),
    );
    const response = await formsClient.batchUpdate(targetFormId, createRequests);

    createSpecs.forEach((spec, offset) => {
      const itemId = response.replies?.[offset]?.createItem?.itemId;

      if (!itemId) {
        throw new AppError(
          "google_api_error",
          `Google Forms API did not return an itemId for created item ${spec.key}.`,
        );
      }

      resolvedItemIds.set(spec.key, itemId);
      summary.added.push(spec.title);
    });

    form = await formsClient.getForm(targetFormId);
  }

  const updateRequests: GoogleBatchRequest[] = buildUpdateFormInfoRequests(
    FINAL_FORM_TITLE,
    FINAL_FORM_DESCRIPTION,
  );

  for (const spec of specs) {
    updateRequests.push(buildUpdateRequest(form, spec, resolvedItemIds) as GoogleBatchRequest);
    summary.edited.push(spec.title);
  }

  logger.info("Applying content updates.", { requestCount: updateRequests.length });
  await runBatchedUpdate(formsClient, targetFormId, updateRequests);

  const desiredOrder = specs.map((spec) => {
    const itemId = resolvedItemIds.get(spec.key);

    if (!itemId) {
      throw new AppError("item_not_found", `Missing final item id for ${spec.key}.`);
    }

    return itemId;
  });

  logger.info("Reordering form items.", { itemCount: desiredOrder.length });
  await reorderItems(formsClient, targetFormId, desiredOrder);

  form = await formsClient.getForm(targetFormId);
  const normalizedItems = normalizeFormItems(form);

  logger.info("Form professionalization completed.", {
    formId: targetFormId,
    itemCount: normalizedItems.length,
  });

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        formId: targetFormId,
        title: form.info?.title ?? null,
        description: form.info?.description ?? null,
        itemCount: form.items?.length ?? 0,
        reused: summary.reused,
        edited: summary.edited,
        added: summary.added,
        removed: summary.removed,
        sections: summary.sections,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const logger = new Logger("error");
  logger.error("Failed to professionalize web requirements form.", {
    error: error instanceof Error ? { name: error.name, message: error.message } : { error },
  });
  process.exitCode = 1;
});
