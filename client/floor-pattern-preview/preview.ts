import {
  checkFloorImageAspectRatio,
  createFloorPatternLayout,
  DEFAULT_FLOOR_GROUT_WIDTH_M,
  FLOOR_PATTERN_DEFINITIONS,
} from "../../shared/flooring/patterns";
import { calculateFloorImageCoverCrop } from "../../shared/flooring/patternCanvas";
import type {
  FloorPatternLayout,
} from "../../shared/flooring/patterns";

const PREVIEW_ROWS = [
  { label: "Rectangular tile", lengthM: 0.6, widthM: 0.3 },
  { label: "Different aspect ratio", lengthM: 0.6, widthM: 0.4 },
] as const;
const PREVIEW_WIDTH = 520;
const PREVIEW_HEIGHT = 290;
const PREVIEW_SCALE = 180;
const REPEAT_CELL_COLOR = "rgba(36, 104, 173, 0.9)";
const rowsRoot = requireElement<HTMLElement>("#pattern-rows");
const imageStatus = requireElement<HTMLElement>("#image-status");
const imagePicker = requireElement<HTMLInputElement>("#tile-image");
let tileImage: HTMLCanvasElement | HTMLImageElement = createSampleTileImage();
let objectURL: string | null = null;
renderPreview();

imagePicker.addEventListener("change", () => {
  const file = imagePicker.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    imageStatus.textContent = "Choose an image file to preview.";
    imagePicker.value = "";
    return;
  }

  const nextURL = URL.createObjectURL(file);
  const candidate = new Image();
  candidate.onload = () => {
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = nextURL;
    tileImage = candidate;
    imageStatus.textContent =
      `Local preview image: ${file.name} (${candidate.naturalWidth} × ${candidate.naturalHeight} px).`;
    renderPreview();
  };
  candidate.onerror = () => {
    URL.revokeObjectURL(nextURL);
    imageStatus.textContent = "The selected image could not be decoded.";
  };
  candidate.src = nextURL;
});

function renderPreview(): void {
  rowsRoot.replaceChildren(
    ...PREVIEW_ROWS.map(({ label, lengthM, widthM }) =>
      createRow(label, lengthM, widthM),
    ),
  );
}

function createRow(label: string, lengthM: number, widthM: number): HTMLElement {
  const section = document.createElement("section");
  section.className = "pattern-row";

  const heading = document.createElement("div");
  heading.className = "row-heading";

  const title = document.createElement("h2");
  title.textContent = label;

  const dimensions = document.createElement("p");
  dimensions.textContent =
    `${(lengthM * 100).toFixed(0)} × ${(widthM * 100).toFixed(0)} cm · ` +
    `${(DEFAULT_FLOOR_GROUT_WIDTH_M * 1000).toFixed(0)} mm grout`;

  heading.append(title, dimensions);

  const grid = document.createElement("div");
  grid.className = "pattern-grid";

  for (const definition of FLOOR_PATTERN_DEFINITIONS) {
    const layout = createFloorPatternLayout(
      definition.id,
      lengthM,
      widthM,
      DEFAULT_FLOOR_GROUT_WIDTH_M,
    );
    grid.append(createPatternCard(definition.label, layout));
  }

  section.append(heading, grid);
  return section;
}

function createPatternCard(label: string, layout: FloorPatternLayout): HTMLElement {
  const card = document.createElement("article");
  card.className = "pattern-card";

  const header = document.createElement("header");
  const title = document.createElement("h3");
  title.textContent = label;
  const scale = document.createElement("span");
  scale.textContent = "same scale within row";
  header.append(title, scale);

  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW_WIDTH * 2;
  canvas.height = PREVIEW_HEIGHT * 2;

  const warning = document.createElement("p");
  warning.className = "warning";
  warning.setAttribute("role", "status");
  const imageSize = getTileImageSize();
  const aspect = checkFloorImageAspectRatio(
    imageSize.width,
    imageSize.height,
    layout.tileLengthM,
    layout.tileWidthM,
  );
  if (aspect.mismatch) {
    warning.textContent =
      `Image ratio ${aspect.imageAspectRatio.toFixed(2)} differs from physical tile ratio ` +
      `${aspect.physicalAspectRatio.toFixed(2)}. The image is center-cropped to fill the tile face.`;
  }

  card.append(header, canvas, warning);
  drawLayout(canvas, layout);
  return card;
}

function drawLayout(canvas: HTMLCanvasElement, layout: FloorPatternLayout): void {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create the floor-pattern preview canvas.");

  context.scale(2, 2);
  context.fillStyle = layout.groutColor;
  context.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);

  const repeatA = layout.repeatCell.a;
  const repeatB = layout.repeatCell.b;
  const extentX = PREVIEW_WIDTH / PREVIEW_SCALE;
  const extentY = PREVIEW_HEIGHT / PREVIEW_SCALE;
  const maxRepeat = Math.ceil(
    (extentX + extentY) /
      Math.min(Math.hypot(repeatA.x, repeatA.y), Math.hypot(repeatB.x, repeatB.y)),
  ) + 2;

  context.save();
  context.beginPath();
  context.rect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
  context.clip();

  for (let a = -maxRepeat; a <= maxRepeat; a += 1) {
    for (let b = -maxRepeat; b <= maxRepeat; b += 1) {
      for (const tile of layout.tiles) {
        drawTile(
          context,
          layout,
          {
            x: tile.center.x + a * repeatA.x + b * repeatB.x,
            y: tile.center.y + a * repeatA.y + b * repeatB.y,
          },
          tile.rotationRadians,
        );
      }
    }
  }

  drawRepeatCell(context, layout);
  context.restore();
}

function drawTile(
  context: CanvasRenderingContext2D,
  layout: FloorPatternLayout,
  center: { x: number; y: number },
  rotationRadians: number,
): void {
  const x = PREVIEW_WIDTH / 2 + center.x * PREVIEW_SCALE;
  const y = PREVIEW_HEIGHT / 2 - center.y * PREVIEW_SCALE;
  const faceLength = layout.tileLengthM - layout.tileFaceInsetM * 2;
  const faceWidth = layout.tileWidthM - layout.tileFaceInsetM * 2;

  context.save();
  context.translate(x, y);
  context.rotate(-rotationRadians);
  context.fillStyle = "#ece7dc";
  context.fillRect(
    -layout.tileLengthM * PREVIEW_SCALE / 2,
    -layout.tileWidthM * PREVIEW_SCALE / 2,
    layout.tileLengthM * PREVIEW_SCALE,
    layout.tileWidthM * PREVIEW_SCALE,
  );

  const imageSize = getTileImageSize();
  const faceAspect = faceLength / faceWidth;
  const crop = calculateFloorImageCoverCrop(
    imageSize.width,
    imageSize.height,
    faceAspect,
  );

  context.drawImage(
    tileImage,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    -faceLength * PREVIEW_SCALE / 2,
    -faceWidth * PREVIEW_SCALE / 2,
    faceLength * PREVIEW_SCALE,
    faceWidth * PREVIEW_SCALE,
  );
  context.restore();
}

function drawRepeatCell(
  context: CanvasRenderingContext2D,
  layout: FloorPatternLayout,
): void {
  const { a, b } = layout.repeatCell;
  const origin =
    layout.pattern === "diagonal"
      ? { x: -(a.x + b.x) / 2, y: -(a.y + b.y) / 2 }
      : { x: 0, y: 0 };
  const corners = [
    origin,
    { x: origin.x + a.x, y: origin.y + a.y },
    { x: origin.x + a.x + b.x, y: origin.y + a.y + b.y },
    { x: origin.x + b.x, y: origin.y + b.y },
  ];

  context.save();
  context.beginPath();
  corners.forEach((point, index) => {
    const x = PREVIEW_WIDTH / 2 + point.x * PREVIEW_SCALE;
    const y = PREVIEW_HEIGHT / 2 - point.y * PREVIEW_SCALE;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.setLineDash([5, 4]);
  context.lineWidth = 1.5;
  context.strokeStyle = REPEAT_CELL_COLOR;
  context.stroke();
  context.restore();
}

function createSampleTileImage(): HTMLCanvasElement {
  const sample = document.createElement("canvas");
  sample.width = 600;
  sample.height = 300;
  const context = sample.getContext("2d");
  if (!context) throw new Error("Unable to create the sample tile image.");

  const gradient = context.createLinearGradient(0, 0, sample.width, sample.height);
  gradient.addColorStop(0, "#d4c6ae");
  gradient.addColorStop(0.5, "#ede4d4");
  gradient.addColorStop(1, "#c8b99e");
  context.fillStyle = gradient;
  context.fillRect(0, 0, sample.width, sample.height);

  context.globalAlpha = 0.22;
  context.strokeStyle = "#8c806f";
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(20, 230);
  context.bezierCurveTo(180, 90, 360, 250, 580, 80);
  context.stroke();
  context.globalAlpha = 1;
  return sample;
}

function getTileImageSize(): { width: number; height: number } {
  if (tileImage instanceof HTMLCanvasElement) {
    return { width: tileImage.width, height: tileImage.height };
  }
  return { width: tileImage.naturalWidth, height: tileImage.naturalHeight };
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Floor pattern preview is missing ${selector}.`);
  return element;
}
