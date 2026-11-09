const CORNER_FIELDS = ["id", "position"];
const DOOR_FIELDS = [
  "id",
  "assetId",
  "wallId",
  "position",
  "rotationY",
  "width",
  "height",
  "depth",
];
const WINDOW_FIELDS = [...DOOR_FIELDS, "wallWidth"];
const OPENING_FIELDS = [
  "id",
  "wallId",
  "shape",
  "position",
  "width",
  "height",
  "depth",
  "archRise",
];
const FURNITURE_FIELDS = [
  "id",
  "assetId",
  "position",
  "rotationY",
  "modelOffset",
  "width",
  "depth",
  "height",
];
const STAIR_FIELDS = [
  "id",
  "floorId",
  "destinationFloorId",
  "stairConnectionId",
  "position",
  "rotationY",
  "width",
  "totalRise",
  "riserCount",
  "treadDepth",
  "treadThickness",
  "railings",
  "shape",
  "turnDirection",
  "flights",
];
const LANDING_FIELDS = [
  "id",
  "stairId",
  "stairConnectionId",
  "floorId",
  "position",
  "rotationY",
  "width",
  "run",
];
const PAINT_SEPARATOR_FIELDS = ["wallPaintSeparators", "floorPaintSeparators"];
const FINISH_FIELDS = ["floorFinishes", "wallFinishes"];

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function finiteVector(value) {
  if (!isRecord(value)) return undefined;
  const coordinates = Object.fromEntries(
    ["x", "y", "z"]
      .filter(axis => Number.isFinite(value[axis]))
      .map(axis => [axis, value[axis]]),
  );
  return Object.keys(coordinates).length ? coordinates : undefined;
}

function sanitizeStringFields(value, fields) {
  return Object.fromEntries(
    fields
      .filter(field => typeof value[field] === "string")
      .map(field => [field, value[field]]),
  );
}

function sanitizeNumberFields(value, fields) {
  return Object.fromEntries(
    fields
      .filter(field => Number.isFinite(value[field]))
      .map(field => [field, value[field]]),
  );
}

function sanitizeSimpleArray(value, fields) {
  if (!Array.isArray(value)) return undefined;
  return value.filter(isRecord).map(item => {
    const stringFields = fields.filter(field => [
      "id",
      "assetId",
      "wallId",
      "floorId",
      "destinationFloorId",
      "stairConnectionId",
      "stairId",
      "shape",
      "turnDirection",
    ].includes(field));
    const numericFields = fields.filter(field => [
      "rotationY",
      "width",
      "height",
      "depth",
      "wallWidth",
      "archRise",
      "run",
      "totalRise",
      "riserCount",
      "treadDepth",
      "treadThickness",
    ].includes(field));
    const result = {
      ...sanitizeStringFields(item, stringFields),
      ...sanitizeNumberFields(item, numericFields),
    };
    for (const key of ["position", "modelOffset"]) {
      if (Object.hasOwn(item, key)) {
        const vector = finiteVector(item[key]);
        if (vector) result[key] = vector;
      }
    }
    if (typeof item.railings === "boolean") result.railings = item.railings;
    if (fields.includes("flights") && Array.isArray(item.flights)) {
      result.flights = item.flights.filter(isRecord).map(flight => {
        const safeFlight = {
          ...sanitizeStringFields(flight, ["id"]),
          ...sanitizeNumberFields(flight, [
            "startRise",
            "width",
            "run",
            "riserCount",
            "totalRise",
            "riserHeight",
            "treadDepth",
          ]),
        };
        if (isRecord(flight.start)) safeFlight.start = finiteVector(flight.start);
        if (isRecord(flight.direction)) {
          safeFlight.direction = Object.fromEntries(
            ["x", "z"]
              .filter(axis => Number.isFinite(flight.direction[axis]))
              .map(axis => [axis, flight.direction[axis]]),
          );
        }
        return safeFlight;
      });
    }
    return result;
  });
}

function sanitizeWalls(value) {
  if (!Array.isArray(value)) return undefined;
  return value.filter(isRecord).map(wall => ({
    ...sanitizeStringFields(wall, ["id"]),
    ...(isRecord(wall.start) ? {
      start: {
        ...sanitizeStringFields(wall.start, ["id"]),
        ...(finiteVector(wall.start.position)
          ? { position: finiteVector(wall.start.position) }
          : {}),
      },
    } : {}),
    ...(isRecord(wall.end) ? {
      end: {
        ...sanitizeStringFields(wall.end, ["id"]),
        ...(finiteVector(wall.end.position)
          ? { position: finiteVector(wall.end.position) }
          : {}),
      },
    } : {}),
  }));
}

function sanitizeCorners(value) {
  return sanitizeSimpleArray(value, CORNER_FIELDS)?.map(corner => {
    const position = finiteVector(corner.position);
    return { ...corner, ...(position ? { position } : {}) };
  });
}

function sanitizePaintMap(value) {
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, face]) => isRecord(face))
      .map(([key, face]) => {
        const result = {};
        if (typeof face.floorId === "string") result.floorId = face.floorId;
        if (face.surfaceType === "wall" || face.surfaceType === "floor") {
          result.surfaceType = face.surfaceType;
        }
        if (typeof face.surfaceId === "string") result.surfaceId = face.surfaceId;
        if (face.wallSide === 1 || face.wallSide === -1) result.wallSide = face.wallSide;
        if (Array.isArray(face.separators)) {
          result.separators = face.separators
            .filter(separator =>
              isRecord(separator) &&
              typeof separator.id === "string" &&
              (separator.orientation === "vertical" || separator.orientation === "horizontal") &&
              Number.isFinite(separator.position),
            )
            .map(separator => ({
              id: separator.id,
              orientation: separator.orientation,
              position: separator.position,
            }));
        } else {
          delete result.separators;
        }
        if (isRecord(face.sectionMaterials)) {
          result.sectionMaterials = Object.fromEntries(
            Object.entries(face.sectionMaterials)
              .filter(([, material]) => typeof material === "string"),
          );
        } else {
          delete result.sectionMaterials;
        }
        return [key, result];
      }),
  );
}

function sanitizeStringRecord(value) {
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => typeof item === "string"),
  );
}

function sanitizeNestedStringRecord(value) {
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, sanitizeStringRecord(item)])
      .filter(([, item]) => item !== undefined),
  );
}

function sanitizeScene(value, title) {
  if (!isRecord(value)) return {};
  const scene = {
    ...sanitizeNumberFields(value, [
      "schemaVersion",
      "wallHeight",
      "wallThickness",
      "gridSize",
      "archRise",
      "openingWidth",
      "openingHeight",
    ]),
    ...Object.fromEntries(
      ["snapEnabled", "layoutConfirmed"]
        .filter(field => typeof value[field] === "boolean")
        .map(field => [field, value[field]]),
    ),
  };
  scene.projectName = title;

  const arrays = [
    ["walls", sanitizeWalls],
    ["corners", sanitizeCorners],
    ["doors", items => sanitizeSimpleArray(items, DOOR_FIELDS)],
    ["windows", items => sanitizeSimpleArray(items, WINDOW_FIELDS)],
    ["openings", items => sanitizeSimpleArray(items, OPENING_FIELDS)],
    ["furniture", items => sanitizeSimpleArray(items, FURNITURE_FIELDS)],
    ["stairs", items => sanitizeSimpleArray(items, STAIR_FIELDS)],
    ["stairLandings", items => sanitizeSimpleArray(items, LANDING_FIELDS)],
  ];
  for (const [field, sanitize] of arrays) {
    const result = sanitize(value[field]);
    if (result !== undefined) scene[field] = result;
  }
  for (const field of ["floorFinishes"]) {
    const result = sanitizeStringRecord(value[field]);
    if (result !== undefined) scene[field] = result;
  }
  const wallFinishes = sanitizeNestedStringRecord(value.wallFinishes);
  if (wallFinishes !== undefined) scene.wallFinishes = wallFinishes;
  for (const field of ["wallPaintSeparators", "floorPaintSeparators"]) {
    const result = sanitizePaintMap(value[field]);
    if (result !== undefined) scene[field] = result;
  }
  if (typeof value.activeFloorId === "string") {
    scene.activeFloorId = value.activeFloorId;
  }
  return scene;
}

function sanitizeFloor(value, index, title) {
  if (!isRecord(value)) return null;
  const floor = {
    ...sanitizeStringFields(value, ["floorId"]),
    name: `Floor ${index + 1}`,
  };
  if (isRecord(value.structure)) {
    floor.structure = sanitizeScene(value.structure, title);
  }
  for (const field of ["furniture", "stairs", "stairLandings"]) {
    const fields = field === "furniture"
      ? FURNITURE_FIELDS
      : field === "stairs"
        ? STAIR_FIELDS
        : LANDING_FIELDS;
    const result = sanitizeSimpleArray(value[field], fields);
    if (result !== undefined) floor[field] = result;
  }
  const floorFinishes = sanitizeStringRecord(value.floorFinishes);
  if (floorFinishes !== undefined) floor.floorFinishes = floorFinishes;
  const wallFinishes = sanitizeNestedStringRecord(value.wallFinishes);
  if (wallFinishes !== undefined) floor.wallFinishes = wallFinishes;
  for (const field of PAINT_SEPARATOR_FIELDS) {
    const result = sanitizePaintMap(value[field]);
    if (result !== undefined) floor[field] = result;
  }
  return floor;
}

function mergeApprovedInterior(structure, interior) {
  const result = { ...structure };
  if (!isRecord(interior)) return result;
  const interiorFloors = new Map(
    (Array.isArray(interior.floors) ? interior.floors : [])
      .filter(isRecord)
      .map(floor => [floor.floorId, floor]),
  );
  if (Array.isArray(structure.floors)) {
    result.floors = structure.floors.map((floor, index) => {
      if (!isRecord(floor)) return floor;
      const floorId = floor.floorId ?? floor.id ?? (index === 0 ? "first-floor" : "");
      const interiorFloor = interiorFloors.get(floorId);
      return interiorFloor ? { ...floor, ...interiorFloor, floorId } : { ...floor, floorId };
    });
  }
  for (const field of ["furniture", ...FINISH_FIELDS, ...PAINT_SEPARATOR_FIELDS]) {
    if (Object.hasOwn(interior, field)) result[field] = interior[field];
  }
  const firstInteriorFloor = result.floors?.[0]
    ? interiorFloors.get(result.floors[0].floorId)
    : undefined;
  for (const field of [...FINISH_FIELDS, ...PAINT_SEPARATOR_FIELDS]) {
    if (Object.hasOwn(interior, field)) continue;
    if (firstInteriorFloor && Object.hasOwn(firstInteriorFloor, field)) {
      result[field] = firstInteriorFloor[field];
    }
  }
  if (!Object.hasOwn(interior, "furniture") && firstInteriorFloor?.furniture) {
    result.furniture = firstInteriorFloor.furniture;
  }
  return result;
}

export function isPubliclyEligibleProject(project, viewerUid) {
  return project?.workflowType === "admin-managed" &&
    project?.projectStatus === "approved" &&
    project?.publicConsent === true &&
    project?.isPublic === true &&
    typeof project?.publicId === "string" &&
    project.publicId.length > 0 &&
    typeof project?.ownerId === "string" &&
    project.ownerId !== viewerUid;
}

export function hasApprovedConsentSnapshot(project, projectId, submissionRecord) {
  return typeof project?.approvedSubmissionId === "string" &&
    project.approvedSubmissionId.length > 0 &&
    submissionRecord?.projectId === projectId &&
    submissionRecord?.ownerId === project.ownerId &&
    submissionRecord?.submissionId === project.approvedSubmissionId &&
    submissionRecord?.snapshotType === "submission" &&
    submissionRecord?.publicConsent === true;
}

export function createPublicGalleryItems(projects, viewerUid) {
  return projects
    .filter(project => isPubliclyEligibleProject(project.data, viewerUid))
    .sort((first, second) => first.data.publicId.localeCompare(second.data.publicId))
    .filter(project => Number.isSafeInteger(project.data.publicNumber) && project.data.publicNumber > 0)
    .map(project => ({
      projectId: project.projectId,
      ownerId: project.data.ownerId,
      publicId: project.data.publicId,
      publicNumber: project.data.publicNumber,
      approvedSubmissionId: project.data.approvedSubmissionId,
      title: `Design Inspiration #${project.data.publicNumber}`,
      thumbnailPath: project.data.thumbnailPath,
    }));
}

export function getPublicGalleryPageOptions(query = {}) {
  const requestedLimit = query.limit === undefined ? 12 : Number(query.limit);
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1) {
    throw new TypeError("Public design limit must be a positive integer.");
  }
  if (query.cursor !== undefined && typeof query.cursor !== "string") {
    throw new TypeError("Public design cursor is invalid.");
  }
  const cursor = typeof query.cursor === "string" ? query.cursor.trim() : "";
  if (cursor.length > 128) {
    throw new TypeError("Public design cursor is invalid.");
  }
  return {
    limit: Math.min(requestedLimit, 30),
    cursor: cursor || null,
  };
}

export function createPublicGalleryResponse(items, thumbnailUrls = new Map()) {
    return items.map(item => ({
      publicId: item.publicId,
      title: item.title,
      ...(thumbnailUrls.has(item.publicId)
        ? { thumbnailUrl: thumbnailUrls.get(item.publicId) }
        : {}),
    }));
}

export function isSafePublicThumbnailPath(path, ownerId, projectId) {
  return typeof path === "string" &&
    path === `projects/${ownerId}/${projectId}.jpg`;
}

export function createPublicProjectSnapshot(structure, interior, title) {
  const merged = mergeApprovedInterior(structure, interior);
  const projectData = sanitizeScene(merged, title);
  if (Array.isArray(merged.floors)) {
    projectData.floors = merged.floors
      .map((floor, index) => sanitizeFloor(floor, index, title))
      .filter(Boolean);
  }
  return projectData;
}
