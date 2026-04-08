import { extname, resolve } from "node:path";
import { loadAuthorizedClient } from "../src/auth/oauth.js";
import { GoogleDriveClient } from "../src/google/drive-client.js";
import { GoogleFormsClient } from "../src/google/forms-client.js";
import {
  buildCreateImageItemRequest,
  normalizeFormItems,
  resolveItemIndex,
} from "../src/tools/helpers.js";
import { loadEnv } from "../src/utils/env.js";
import { Logger } from "../src/utils/logger.js";

const IMAGE_WIDTH = 640;

const VISUAL_STYLE_TITLE =
  "Que estilo visual desea para la web? / What visual style do you want for the website?";
const BRAND_COLORS_TITLE = "Tiene colores de marca definidos? / Do you have defined brand colors?";
const REFERENCE_LINKS_TITLE = "Agregue enlaces de referencia / Add reference links";
const REFERENCE_LIKES_TITLE =
  "Que le gusta de esas referencias? / What do you like about those references?";

type ImageSpec = {
  key: string;
  filePath: string;
  driveName: string;
  altText: string;
};

const sectionCoverImage: ImageSpec = {
  key: "sectionCover",
  filePath: resolve("020740157700745.63a186aa276ab.png"),
  driveName: "web-form-design-section-cover.png",
  altText:
    "Referencia visual general para la seccion de diseno y estilo visual / General visual reference for the design and visual style section",
};

const styleQuestionImage: ImageSpec = {
  key: "styleQuestion",
  filePath: resolve("converted-images/original-068ea7ccad60d84ffd0dd3562fc9dbbe.png"),
  driveName: "web-form-style-question-reference-dark-portfolio.png",
  altText:
    "Referencia de estilo visual oscuro tipo portafolio / Dark portfolio style visual reference",
};

const styleBlock1Image: ImageSpec = {
  key: "styleBlock1",
  filePath: resolve("converted-images/original-4be2c674e8166ef798d36cd9d6f99924.png"),
  driveName: "web-form-style-reference-light-commercial.png",
  altText:
    "Referencia visual clara y comercial / Light commercial visual reference",
};

const styleBlock2Image: ImageSpec = {
  key: "styleBlock2",
  filePath: resolve("converted-images/original-17282c028829a5817e7206e14cb5a74b.png"),
  driveName: "web-form-style-reference-saas-dashboard.png",
  altText:
    "Referencia visual moderna tipo SaaS o dashboard / Modern SaaS or dashboard visual reference",
};

const referenceLinksImage: ImageSpec = {
  key: "referenceLinks",
  filePath: resolve(
    "converted-images/ismart_ecommerce_website_home_page__ui_design_in_adobe_photoshop_mockup_4x.png",
  ),
  driveName: "web-form-reference-links-example.png",
  altText: "Ejemplo de sitio de referencia / Example of a reference website",
};

const referenceLikesImage: ImageSpec = {
  key: "referenceLikes",
  filePath: resolve("converted-images/4db99a76eaef393a91254456eb28969f.png"),
  driveName: "web-form-reference-likes-example.png",
  altText:
    "Ejemplo de elementos visuales para evaluar / Example of visual elements to evaluate",
};

const imageSpecs: ImageSpec[] = [
  sectionCoverImage,
  styleQuestionImage,
  styleBlock1Image,
  styleBlock2Image,
  referenceLinksImage,
  referenceLikesImage,
];

function getTargetFormId(): string {
  const formId = process.env.TARGET_FORM_ID?.trim();

  if (!formId) {
    throw new Error("TARGET_FORM_ID is required for apply-design-images.");
  }

  return formId;
}

function mimeTypeForPath(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      throw new Error(`Unsupported image extension: ${filePath}`);
  }
}

async function uploadPublicImage(
  driveClient: GoogleDriveClient,
  spec: ImageSpec,
): Promise<{ url: string; fileId: string }> {
  const uploaded = await driveClient.uploadFile({
    filePath: spec.filePath,
    mimeType: mimeTypeForPath(spec.filePath),
    name: spec.driveName,
  });

  if (!uploaded.id) {
    throw new Error(`Drive upload did not return an id for ${spec.filePath}`);
  }

  await driveClient.ensureAnyoneReader(uploaded.id);
  const metadata = await driveClient.getFileMetadata(uploaded.id);

  return {
    fileId: uploaded.id,
    url: metadata.webContentLink ?? driveClient.buildPublicDownloadUrl(metadata),
  };
}

function findItemIndexByTitle(
  form: Awaited<ReturnType<GoogleFormsClient["getForm"]>>,
  title: string,
): number {
  return resolveItemIndex(form, {
    currentIndex: (form.items ?? []).findIndex((item) => item.title === title),
  });
}

async function createImageBlockAt(
  formsClient: GoogleFormsClient,
  formId: string,
  imageUrl: string,
  altText: string,
  index: number,
): Promise<void> {
  await formsClient.batchUpdate(formId, [
    buildCreateImageItemRequest(
      {
        sourceUri: imageUrl,
        altText,
        width: IMAGE_WIDTH,
        alignment: "CENTER",
      },
      index,
    ),
  ]);
}

async function createImageBlockBeforeTitle(
  formsClient: GoogleFormsClient,
  formId: string,
  title: string,
  imageUrl: string,
  altText: string,
): Promise<void> {
  const form = await formsClient.getForm(formId);
  const index = findItemIndexByTitle(form, title);
  await createImageBlockAt(formsClient, formId, imageUrl, altText, index);
}

async function main(): Promise<void> {
  const targetFormId = getTargetFormId();
  const env = loadEnv();
  const logger = new Logger(env.logLevel);
  const authClient = await loadAuthorizedClient(env, logger);
  const driveClient = new GoogleDriveClient(authClient);
  const formsClient = new GoogleFormsClient(authClient);

  const initialForm = await formsClient.getForm(targetFormId);
  const normalized = normalizeFormItems(initialForm);
  const existingAltTexts = new Set(
    normalized.map((item) => item.imageAltText).filter((value): value is string => Boolean(value)),
  );

  const uploaded = new Map<string, { url: string; fileId: string }>();

  for (const spec of imageSpecs) {
    const result = await uploadPublicImage(driveClient, spec);
    uploaded.set(spec.key, result);
    logger.info("Uploaded design image to Drive.", {
      key: spec.key,
      fileId: result.fileId,
      imageUrl: result.url,
    });
  }

  if (!existingAltTexts.has(sectionCoverImage.altText)) {
    await createImageBlockBeforeTitle(
      formsClient,
      targetFormId,
      VISUAL_STYLE_TITLE,
      uploaded.get(sectionCoverImage.key)!.url,
      sectionCoverImage.altText,
    );
  }

  if (!existingAltTexts.has(styleQuestionImage.altText)) {
    await createImageBlockBeforeTitle(
      formsClient,
      targetFormId,
      BRAND_COLORS_TITLE,
      uploaded.get(styleQuestionImage.key)!.url,
      styleQuestionImage.altText,
    );
  }

  if (!existingAltTexts.has(styleBlock1Image.altText)) {
    await createImageBlockBeforeTitle(
      formsClient,
      targetFormId,
      BRAND_COLORS_TITLE,
      uploaded.get(styleBlock1Image.key)!.url,
      styleBlock1Image.altText,
    );
  }

  if (!existingAltTexts.has(styleBlock2Image.altText)) {
    await createImageBlockBeforeTitle(
      formsClient,
      targetFormId,
      BRAND_COLORS_TITLE,
      uploaded.get(styleBlock2Image.key)!.url,
      styleBlock2Image.altText,
    );
  }

  if (!existingAltTexts.has(referenceLinksImage.altText)) {
    await createImageBlockBeforeTitle(
      formsClient,
      targetFormId,
      REFERENCE_LINKS_TITLE,
      uploaded.get(referenceLinksImage.key)!.url,
      referenceLinksImage.altText,
    );
  }

  if (!existingAltTexts.has(referenceLikesImage.altText)) {
    await createImageBlockBeforeTitle(
      formsClient,
      targetFormId,
      REFERENCE_LIKES_TITLE,
      uploaded.get(referenceLikesImage.key)!.url,
      referenceLikesImage.altText,
    );
  }

  const finalForm = await formsClient.getForm(targetFormId);
  const finalItems = normalizeFormItems(finalForm);
  const finalImageCount = finalItems.filter((item) => item.hasImageItem || item.hasQuestionImage).length;

  console.log(
    JSON.stringify(
      {
        ok: true,
        formId: targetFormId,
        finalImageCount,
        placements: [
          {
            placement: "design_section_cover",
            file: sectionCoverImage.filePath,
          },
          {
            placement: "visual_style_reference_block_1",
            file: styleQuestionImage.filePath,
          },
          {
            placement: "visual_style_reference_block_2",
            file: styleBlock1Image.filePath,
          },
          {
            placement: "visual_style_reference_block_3",
            file: styleBlock2Image.filePath,
          },
          {
            placement: "reference_links_reference_block",
            file: referenceLinksImage.filePath,
          },
          {
            placement: "reference_likes_reference_block",
            file: referenceLikesImage.filePath,
          },
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
