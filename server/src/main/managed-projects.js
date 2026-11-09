import { randomUUID } from "node:crypto";
import express from "express";
import { FieldPath, FieldValue } from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
  adminStorage,
} from "../firebase-admin.js";
import { requireRole } from "./authorization.js";
import { findClientAccountByIdentifier } from "./client-account.js";
import { createReservedFloorPlanDraft } from "./floorplan-reservation.js";
import {
  commitPublishedFloorPlan,
  createPublishedFloorPlanRecord,
} from "./floorplan-publishing.js";
import {
  findExistingFloorPlan,
  isFloorPlanClientAccount,
} from "./floorplan-client-eligibility.js";
import {
  ACCESS_AGREEMENT_VERSION,
  SUBMISSION_AGREEMENT_VERSION,
  canContinueAdminStructureSave,
  canTransitionProject,
  getPhilippineDateTimeKey,
  getClientEditLockReason,
  getPublicConsentFields,
  getPublicVisibilityUpdate,
  getProjectReviewVisibilityUpdate,
  getProjectStatus,
  isCurrentProjectAcknowledgement,
  isFutureProjectDeadline,
  isValidProjectDeadline,
} from "./project-workflow.js";
import {
  isClientAssignedToPublishedProject,
  isClientAccessibleManagedProjectFileKind,
  resolveManagedProjectFilePath,
  stripManagedFileUrlFields,
} from "./managed-project-file-access.js";
import {
  createPublicGalleryResponse,
  createPublicGalleryItems,
  createPublicProjectSnapshot,
  getPublicGalleryPageOptions,
  hasApprovedConsentSnapshot,
  isPubliclyEligibleProject,
  isSafePublicThumbnailPath,
} from "./public-project-access.js";

const router = express.Router();
const PROJECTS = "projects";
const USERS = "users";
const EMPLOYEES = "adminEmployees";
const ASSIGNMENTS = "adminManagedProjectAssignments";
const DRAFTS = "adminManagedFloorPlanDrafts";
const PROJECT_ACTIVITY = "projectActivity";
const PROJECT_VERSIONS = "projectVersions";
const PROJECT_SUBMISSIONS = "projectSubmissions";
const MAX_STRUCTURE_BYTES = 10 * 1024 * 1024;
const OWNER_PROJECT_CONFLICT =
  "This client already has a project or assignment. Open the existing project instead.";

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sendFailure(res, error, fallback) {
  if (Number.isInteger(error?.status)) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
}

function normalizedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validateName(value) {
  const name = normalizedString(value);
  if (!name) throw httpError(400, "A floor-plan name is required.");
  if (name.length > 120) throw httpError(400, "The floor-plan name must be 120 characters or fewer.");
  return name;
}

function validateStructure(value, projectId, ownerId, projectName) {
  if (!isRecord(value)) throw httpError(400, "Floor-plan data must be a JSON object.");
  if (value.projectId !== projectId || value.ownerId !== ownerId) {
    throw httpError(400, "Floor-plan IDs do not match the selected record.");
  }
  if (value.projectName !== projectName) {
    throw httpError(400, "Floor-plan JSON and project name must match.");
  }
  for (const field of ["walls", "corners", "doors", "windows", "openings"]) {
    if (!Array.isArray(value[field])) {
      throw httpError(400, `Floor-plan ${field} data must be an array.`);
    }
  }
  const serialized = JSON.stringify(stripManagedFileUrlFields(value));
  if (Buffer.byteLength(serialized, "utf8") > MAX_STRUCTURE_BYTES) {
    throw httpError(413, "Floor-plan data exceeds the 10 MB limit.");
  }
  return serialized;
}

function timestampToIso(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

async function uploadJson(path, json) {
  await adminStorage.file(path).save(Buffer.from(json, "utf8"), {
    resumable: false,
    metadata: {
      contentType: "application/json",
    },
  });
}

async function deleteStorageObject(path) {
  await adminStorage.file(path).delete({ ignoreNotFound: true });
}

async function loadJson(path) {
  const [contents] = await adminStorage.file(path).download();
  try {
    return JSON.parse(contents.toString("utf8"));
  } catch (error) {
    throw httpError(500, "Saved floor-plan JSON is invalid.");
  }
}

function assignmentReference(ownerId) {
  return adminDb.collection(ASSIGNMENTS).doc(encodeURIComponent(ownerId));
}

function getTodayInManila() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find(part => part.type === "year")?.value;
  const month = parts.find(part => part.type === "month")?.value;
  const day = parts.find(part => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function recordProjectActivity(transaction, projectId, actor, action, details = {}) {
  const reference = adminDb.collection(PROJECT_ACTIVITY).doc(randomUUID());
  const activity = {
    projectId,
    actorId: actor.uid,
    actorRole: actor.role,
    ...(normalizedString(actor.name) ? { actorName: normalizedString(actor.name) } : {}),
    action,
    createdAt: FieldValue.serverTimestamp(),
  };
  for (const [key, value] of Object.entries(details)) {
    if (value !== undefined) activity[key] = value;
  }
  transaction.create(reference, activity);
}

function assertAssignedClient(project, assignment, projectId, ownerId) {
  if (!assignment.exists || !isClientAssignedToPublishedProject(
    { ...project, projectId: normalizedString(project.projectId) || projectId },
    assignment.data(),
    projectId,
    ownerId,
  )) {
    throw httpError(403, "This published project is not assigned to the signed-in client.");
  }
}

function getInteriorStoragePath(project, ownerId, projectId) {
  const path = normalizedString(project.interiorJsonPath);
  if (!path) return "";
  const legacyPath = `projects/${ownerId}/${projectId}.interior.json`;
  const versionPath = `projects/${ownerId}/${projectId}/versions/`;
  if (path !== legacyPath && !path.startsWith(versionPath)) {
    throw httpError(409, "Saved interior design path does not match this project.");
  }
  return path;
}

async function reserveNextProjectId(transaction, year) {
  const counterReference = adminDb.collection("idCounters").doc(`projects-${year}`);
  const counterSnapshot = await transaction.get(counterReference);
  const storedSequence = counterSnapshot.exists
    ? Number(counterSnapshot.data().lastSequence ?? 0)
    : 0;
  if (!Number.isSafeInteger(storedSequence) || storedSequence < 0) {
    throw httpError(500, "The project ID counter is invalid.");
  }

  let nextSequence = storedSequence + 1;
  let projectId = formatProjectId(nextSequence, year);
  let projectReference = adminDb.collection(PROJECTS).doc(projectId);
  let projectSnapshot = await transaction.get(projectReference);
  while (projectSnapshot.exists) {
    nextSequence += 1;
    if (!Number.isSafeInteger(nextSequence)) {
      throw httpError(500, "Unable to generate another project ID.");
    }
    projectId = formatProjectId(nextSequence, year);
    projectReference = adminDb.collection(PROJECTS).doc(projectId);
    projectSnapshot = await transaction.get(projectReference);
  }

  transaction.set(counterReference, {
    lastSequence: nextSequence,
    year,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { projectId, projectReference };
}

function formatProjectId(sequence, year) {
  return `PRJ-${String(sequence).padStart(3, "0")}${String(year % 100).padStart(2, "0")}`;
}

function currentYearInManila() {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
  }).format(new Date()));
}

async function authenticateClient(req, res, next) {
  const authorization = req.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ success: false, message: "Sign in to save this project." });
  }

  try {
    const token = await adminAuth.verifyIdToken(match[1], true);
    const account = await findClientAccountByIdentifier(adminDb, token.uid);
    if (!account) {
      return res.status(403).json({ success: false, message: "An active client account is required." });
    }
    req.clientUser = { uid: token.uid };
    return next();
  } catch (error) {
    console.error("Client token verification failed:", error);
    return res.status(401).json({ success: false, message: "Your session is invalid. Sign in again." });
  }
}

async function createDraft(req, res) {
  try {
    const requestedOwnerId = normalizedString(req.body?.ownerId);
    const projectName = validateName(req.body?.projectName);
    if (!requestedOwnerId) throw httpError(400, "A client account is required.");
    const clientAccount = await findClientAccountByIdentifier(
      adminDb,
      requestedOwnerId,
      { requireActive: false },
    );
    if (!clientAccount) {
      throw httpError(409, "This client account is not eligible for a floor plan.");
    }
    const ownerId = clientAccount.uid;
    const draftId = randomUUID();
    const record = {
      draftId,
      projectName,
      intendedClientId: ownerId,
      intendedClientAccountId: clientAccount.id,
      createdBy: req.adminUser.uid,
      creatorName: req.adminUser.name,
      workflowType: "admin-managed",
      structuralOwner: "admin",
      structuralStatus: "draft",
      structuralRevision: 0,
      structureInitialized: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await createReservedFloorPlanDraft(adminDb, {
      ownerId,
      draftId,
      draftRecord: record,
      assignmentReference: assignmentReference(ownerId),
      additionalOwnerIds: clientAccount.id === ownerId ? [] : [clientAccount.id],
      additionalAssignmentReferences: clientAccount.id === ownerId
        ? []
        : [assignmentReference(clientAccount.id)],
    });
    return res.status(201).json({ success: true, draft: { ...record, draftId } });
  } catch (error) {
    return sendFailure(res, error, "Unable to create the floor-plan draft.");
  }
}

async function searchClients(req, res) {
  try {
    const search = normalizedString(req.query.search).toLocaleLowerCase();
    const [usersSnapshot, projectsSnapshot, assignmentSnapshot, employeesSnapshot, draftsSnapshot] = await Promise.all([
      adminDb.collection(USERS).get(),
      adminDb.collection(PROJECTS).get(),
      adminDb.collection(ASSIGNMENTS).get(),
      adminDb.collection(EMPLOYEES).get(),
      adminDb.collection(DRAFTS).get(),
    ]);

    const projectRecords = projectsSnapshot.docs.map(document => ({
      id: document.id,
      ...document.data(),
    }));
    const draftRecords = draftsSnapshot.docs.map(document => ({
      id: document.id,
      ...document.data(),
    }));
    const employeeUids = new Set(
      employeesSnapshot.docs
        .flatMap(document => [
          document.id,
          normalizedString(document.data().uid),
        ])
        .filter(Boolean)
    );
    const assignmentRecords = assignmentSnapshot.docs.map(document => document.data());
    const clients = [];
    let hasIneligibleMatches = false;

    for (const document of usersSnapshot.docs) {
      const data = document.data();
      const uid = normalizedString(data.uid) || document.id;
      const name = normalizedString(data.full_name) || normalizedString(data.name) || "Unknown User";
      const email = normalizedString(data.email);
      if (search && !`${name} ${email}`.toLocaleLowerCase().includes(search)) continue;

      const ownerIdentifiers = [...new Set([uid, document.id])];
      const existing = findExistingFloorPlan({
        identifiers: ownerIdentifiers,
        projects: projectRecords,
        drafts: draftRecords,
        assignments: assignmentRecords,
      });
      if (!isFloorPlanClientAccount(data, ownerIdentifiers, employeeUids)) {
        hasIneligibleMatches = true;
        continue;
      }
      const projectId = existing.projectId;
      const existingDraftId = existing.draftId;
      const hasFloorPlan = Boolean(projectId || existingDraftId);
      const isEligible = !hasFloorPlan;
      if (!isEligible) hasIneligibleMatches = true;
      clients.push({
        id: document.id,
        uid,
        name,
        email: email || undefined,
        eligible: isEligible,
        existingProjectId: projectId ?? undefined,
        existingDraftId: existingDraftId ?? undefined,
      });
    }

    clients.sort((first, second) => first.name.localeCompare(second.name));
    return res.json({
      success: true,
      clients,
      hasIneligibleMatches,
    });
  } catch (error) {
    return sendFailure(res, error, "Unable to search eligible client accounts.");
  }
}

function mapProject(document, ownerNames, creatorNames, assignmentByOwner, ownerEmails = new Map()) {
  const data = document.data();
  const projectId = typeof data.projectId === "string" ? data.projectId : document.id;
  const isManaged = data.workflowType === "admin-managed";
  return {
    projectId,
    projectName: typeof data.projectName === "string" ? data.projectName : "Unnamed Project",
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    ownerName: ownerNames.get(data.ownerId) ?? "Unknown User",
    workflowType: data.workflowType === "admin-managed" ? "admin-managed" : "legacy",
    structuralOwner: data.structuralOwner === "admin" ? "admin" : undefined,
    structuralStatus: data.structuralStatus === "draft" || data.structuralStatus === "published"
      ? data.structuralStatus
      : undefined,
    structuralRevision: Number.isSafeInteger(data.structuralRevision) ? data.structuralRevision : undefined,
    publishedStructuralRevision: Number.isSafeInteger(data.publishedStructuralRevision)
      ? data.publishedStructuralRevision
      : undefined,
    structureInitialized: typeof data.structureInitialized === "boolean" ? data.structureInitialized : undefined,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : undefined,
    creatorName: creatorNames.get(data.createdBy) ?? (typeof data.creatorName === "string" ? data.creatorName : undefined),
    intendedClientId: typeof data.intendedClientId === "string" ? data.intendedClientId : undefined,
    intendedClientEmail: ownerEmails.get(data.intendedClientId ?? data.ownerId),
    recordType: "project",
    ...(isManaged
      ? {
          hasPublishedStructure: typeof data.jsonPath === "string" && Boolean(data.jsonPath),
          hasDraftStructure: typeof data.draftJsonPath === "string" && Boolean(data.draftJsonPath),
          hasInterior: Boolean(data.interiorJsonPath || data.interiorJsonUrl),
        }
      : {
          jsonPath: typeof data.jsonPath === "string" ? data.jsonPath : "",
          jsonUrl: typeof data.jsonUrl === "string" ? data.jsonUrl : "",
          interiorJsonPath: typeof data.interiorJsonPath === "string" ? data.interiorJsonPath : undefined,
          interiorJsonUrl: typeof data.interiorJsonUrl === "string" ? data.interiorJsonUrl : undefined,
        }),
    clientDesignStarted: typeof data.clientDesignStarted === "boolean" ? data.clientDesignStarted : undefined,
    clientDesignStartedAt: timestampToIso(data.clientDesignStartedAt),
    projectStatus: getProjectStatus(data),
    publicConsent: data.publicConsent === true,
    publicConsentAt: timestampToIso(data.publicConsentAt),
    isPublic: data.isPublic === true,
    currentDesignVersionId: typeof data.currentDesignVersionId === "string" ? data.currentDesignVersionId : undefined,
    currentDesignVersionNumber: Number.isSafeInteger(data.currentDesignVersionNumber)
      ? data.currentDesignVersionNumber
      : undefined,
    submittedVersionId: typeof data.submittedVersionId === "string" ? data.submittedVersionId : undefined,
    submittedAt: timestampToIso(data.submittedAt),
    submittedVersionNumber: Number.isSafeInteger(data.submittedVersionNumber) ? data.submittedVersionNumber : undefined,
    ...(isManaged ? {
      submittedSubmissionId: typeof data.submittedSubmissionId === "string" ? data.submittedSubmissionId : undefined,
      approvedSubmissionId: typeof data.approvedSubmissionId === "string" ? data.approvedSubmissionId : undefined,
    } : {}),
    ...(isManaged ? {} : {
      submittedSnapshotPath: typeof data.submittedSnapshotPath === "string" ? data.submittedSnapshotPath : undefined,
      submittedSnapshotUrl: typeof data.submittedSnapshotUrl === "string" ? data.submittedSnapshotUrl : undefined,
    }),
    approvedAt: timestampToIso(data.approvedAt),
    approvedBy: typeof data.approvedBy === "string" ? data.approvedBy : undefined,
    approvedByName: typeof data.approvedByName === "string" ? data.approvedByName : undefined,
    approvedVersionNumber: Number.isSafeInteger(data.approvedVersionNumber) ? data.approvedVersionNumber : undefined,
    ...(isManaged ? {} : {
      approvedSnapshotPath: typeof data.approvedSnapshotPath === "string" ? data.approvedSnapshotPath : undefined,
      approvedSnapshotUrl: typeof data.approvedSnapshotUrl === "string" ? data.approvedSnapshotUrl : undefined,
    }),
    approvedVersionId: typeof data.approvedVersionId === "string" ? data.approvedVersionId : undefined,
    revisionFeedback: typeof data.revisionFeedback === "string" ? data.revisionFeedback : undefined,
    revisionRequestedAt: timestampToIso(data.revisionRequestedAt),
    lifecycleAssignmentId: assignmentByOwner.get(data.ownerId) ?? null,
    thumbnailPath: typeof data.thumbnailPath === "string" ? data.thumbnailPath : undefined,
    thumbnailUrl: typeof data.thumbnailUrl === "string" ? data.thumbnailUrl : undefined,
    schemaVersion: typeof data.schemaVersion === "number" ? data.schemaVersion : 1,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    totalCost: Number.isFinite(Number(data.totalCost)) ? Number(data.totalCost) : undefined,
    estimatedCost: Number.isFinite(Number(data.estimatedCost)) ? Number(data.estimatedCost) : undefined,
    deadline: typeof data.deadline === "string" ? data.deadline : null,
  };
}

async function getAdminProjects(req, res, includeDrafts) {
  try {
    const [projectsSnapshot, usersSnapshot, employeesSnapshot, assignmentsSnapshot, draftsSnapshot] =
      await Promise.all([
        adminDb.collection(PROJECTS).get(),
        adminDb.collection(USERS).get(),
        adminDb.collection(EMPLOYEES).get(),
        adminDb.collection(ASSIGNMENTS).get(),
        includeDrafts ? adminDb.collection(DRAFTS).get() : Promise.resolve({ docs: [] }),
      ]);

    const ownerNames = new Map();
    const ownerEmails = new Map();
    for (const document of usersSnapshot.docs) {
      const data = document.data();
      const uid = normalizedString(data.uid) || document.id;
      ownerNames.set(uid, normalizedString(data.full_name) || normalizedString(data.name) || "Unknown client");
      if (typeof data.email === "string" && data.email.trim()) ownerEmails.set(uid, data.email.trim());
    }
    const creatorNames = new Map();
    for (const document of employeesSnapshot.docs) {
      const data = document.data();
      const uid = normalizedString(data.uid);
      const displayName = normalizedString(data.name) || normalizedString(data.full_name);
      if (uid && displayName) creatorNames.set(uid, displayName);
    }
    const assignmentByOwner = new Map(
      assignmentsSnapshot.docs.map(document => [document.data().ownerId, document.data().projectId])
    );
    const projects = projectsSnapshot.docs
      .map(document => mapProject(document, ownerNames, creatorNames, assignmentByOwner, ownerEmails))
      .filter(project =>
        !includeDrafts ||
        (project.workflowType === "admin-managed" && project.structuralStatus === "draft")
      );

    if (includeDrafts) {
      for (const document of draftsSnapshot.docs) {
        const draft = document.data();
        if (
          (typeof draft.publishedProjectId === "string" && draft.publishedProjectId) ||
          (draft.structuralStatus !== undefined && draft.structuralStatus !== "draft")
        ) {
          continue;
        }
        const ownerId = typeof draft.intendedClientId === "string" ? draft.intendedClientId : "";
        projects.push({
          projectId: document.id,
          projectName: typeof draft.projectName === "string" ? draft.projectName : "Unnamed Project",
          ownerId,
          ownerName: ownerId ? ownerNames.get(ownerId) ?? "Unknown client" : "Unassigned",
          workflowType: "admin-managed",
          structuralOwner: "admin",
          structuralStatus: "draft",
          structuralRevision: Number.isSafeInteger(draft.structuralRevision) ? draft.structuralRevision : 0,
          structureInitialized: draft.structureInitialized === true,
          createdBy: typeof draft.createdBy === "string" ? draft.createdBy : undefined,
          creatorName: creatorNames.get(draft.createdBy) ??
            (typeof draft.creatorName === "string" ? draft.creatorName : undefined),
          intendedClientId: ownerId,
          intendedClientEmail: ownerEmails.get(ownerId),
          recordType: "draft",
          thumbnailPath: typeof draft.thumbnailPath === "string" ? draft.thumbnailPath : undefined,
          thumbnailUrl: typeof draft.thumbnailUrl === "string" ? draft.thumbnailUrl : undefined,
          hasDraftStructure: typeof draft.draftJsonPath === "string" && Boolean(draft.draftJsonPath),
          schemaVersion: 1,
          createdAt: timestampToIso(draft.createdAt),
          updatedAt: timestampToIso(draft.updatedAt),
          deadline: typeof draft.deadline === "string" ? draft.deadline : null,
        });
      }
    }

    projects.sort((first, second) =>
      new Date(second.updatedAt ?? 0).getTime() - new Date(first.updatedAt ?? 0).getTime()
    );
    const responseProjects = includeDrafts
      ? projects.filter(project => project.structuralStatus === "draft")
      : projects;
    return res.json({ success: true, projects: responseProjects });
  } catch (error) {
    return sendFailure(res, error, "Unable to load floor-plan projects.");
  }
}

async function getProject(req, res) {
  try {
    const projectId = normalizedString(req.params.projectId);
    if (!projectId) throw httpError(400, "Project ID is required.");
    const reference = adminDb.collection(PROJECTS).doc(projectId);
    const snapshot = await reference.get();
    if (!snapshot.exists) throw httpError(404, "Project does not exist.");
    const [usersSnapshot, employeesSnapshot, assignmentSnapshot] = await Promise.all([
      adminDb.collection(USERS).get(),
      adminDb.collection(EMPLOYEES).get(),
      assignmentReference(snapshot.data().ownerId ?? "").get(),
    ]);
    const ownerNames = new Map();
    for (const document of usersSnapshot.docs) {
      const data = document.data();
      ownerNames.set(normalizedString(data.uid) || document.id, normalizedString(data.full_name) || normalizedString(data.name) || "Unknown User");
    }
    const creatorNames = new Map();
    for (const document of employeesSnapshot.docs) {
      const data = document.data();
      if (typeof data.uid === "string") creatorNames.set(data.uid, data.name ?? data.full_name ?? "Unknown Administrator");
    }
    const ownerId = snapshot.data().ownerId;
    const assignmentByOwner = new Map([[ownerId, assignmentSnapshot.exists ? assignmentSnapshot.data().projectId : null]]);
    return res.json({ success: true, project: mapProject(snapshot, ownerNames, creatorNames, assignmentByOwner) });
  } catch (error) {
    return sendFailure(res, error, "Unable to load project.");
  }
}

async function getAdminAccountProjects(req, res) {
  try {
    const accountId = normalizedString(req.params.accountId);
    if (!accountId) throw httpError(400, "Client account ID is required.");
    const users = adminDb.collection(USERS);
    const accountDocument = await users.doc(accountId).get();
    const accountSnapshot = accountDocument.exists
      ? null
      : await users.where("uid", "==", accountId).limit(1).get();
    const userDocument = accountDocument.exists ? accountDocument : accountSnapshot?.docs[0];
    if (!userDocument) throw httpError(404, "Client account does not exist.");
    const userData = userDocument.data();
    const ownerId = normalizedString(userData.uid) || userDocument.id;
    const [projectsSnapshot, employeesSnapshot, assignmentSnapshot] = await Promise.all([
      adminDb.collection(PROJECTS).where("ownerId", "==", ownerId).get(),
      adminDb.collection(EMPLOYEES).get(),
      assignmentReference(ownerId).get(),
    ]);
    const ownerNames = new Map([[ownerId, normalizedString(userData.full_name) || normalizedString(userData.name) || "Unknown User"]]);
    const creatorNames = new Map();
    for (const document of employeesSnapshot.docs) {
      const data = document.data();
      if (typeof data.uid === "string") {
        creatorNames.set(data.uid, data.name ?? data.full_name ?? "Unknown Administrator");
      }
    }
    const assignmentByOwner = new Map([
      [ownerId, assignmentSnapshot.exists ? assignmentSnapshot.data().projectId : null],
    ]);
    const projects = projectsSnapshot.docs
      .map(document => mapProject(document, ownerNames, creatorNames, assignmentByOwner))
      .sort((first, second) =>
        new Date(second.updatedAt ?? 0).getTime() - new Date(first.updatedAt ?? 0).getTime()
      );
    return res.json({ success: true, projects });
  } catch (error) {
    return sendFailure(res, error, "Unable to load client projects.");
  }
}

async function getDraft(req, res) {
  try {
    const draftId = normalizedString(req.params.draftId);
    const reference = adminDb.collection(DRAFTS).doc(draftId);
    const snapshot = await reference.get();
    if (!snapshot.exists) throw httpError(404, "Floor-plan draft does not exist.");
    const draft = snapshot.data();
    const projectData = draft.draftJsonPath
      ? stripManagedFileUrlFields(await loadJson(draft.draftJsonPath))
      : null;
    const clientAccount = await findClientAccountByIdentifier(
      adminDb,
      draft.intendedClientId,
      { requireActive: false },
    );
    const clientData = clientAccount?.data;
    const {
      draftJsonPath: _draftJsonPath,
      draftJsonUrl: _draftJsonUrl,
      ...safeDraft
    } = draft;
    return res.json({
      success: true,
      draft: {
        draftId,
        ...safeDraft,
        intendedClientName: clientData?.full_name ?? clientData?.name ?? "Unknown User",
        projectData,
      },
    });
  } catch (error) {
    return sendFailure(res, error, "Unable to load floor-plan draft.");
  }
}

async function saveDraft(req, res) {
  const draftId = normalizedString(req.params.draftId);
  const reference = adminDb.collection(DRAFTS).doc(draftId);
  let uploadedPath;

  try {
    const projectName = validateName(req.body?.projectName);
    const snapshot = await reference.get();
    if (!snapshot.exists) throw httpError(404, "Floor-plan draft does not exist.");
    const draft = snapshot.data();
    if (draft.createdBy !== req.adminUser.uid) {
      throw httpError(403, "Only the administrator who created this draft may save it.");
    }
    if (draft.publishedProjectId) {
      throw httpError(409, "This draft has already been published.");
    }
    if (draft.deleting === true) {
      throw httpError(409, "This draft is being deleted.");
    }
    const revision = Number(req.body?.revision);
    if (!Number.isSafeInteger(revision) || revision < 1) {
      throw httpError(400, "A positive floor-plan revision is required.");
    }
    const deadline = normalizedString(req.body?.deadline);
    if (deadline && !isValidProjectDeadline(deadline)) {
      throw httpError(400, "Choose a valid project date and time.");
    }
    const ownerId = normalizedString(draft.intendedClientId);
    const projectData = req.body?.projectData;
    const json = validateStructure(projectData, draftId, ownerId, projectName);
    const storagePath = `adminManagedFloorPlanDrafts/${req.adminUser.uid}/${draftId}/draft-r${revision}-${randomUUID()}.json`;
    uploadedPath = storagePath;
    await uploadJson(storagePath, json);

    await adminDb.runTransaction(async transaction => {
      const currentSnapshot = await transaction.get(reference);
      if (!currentSnapshot.exists) throw httpError(404, "Floor-plan draft was removed during save.");
      const current = currentSnapshot.data();
      if (current.createdBy !== req.adminUser.uid || current.publishedProjectId || current.deleting === true) {
        throw httpError(403, "Draft ownership or status changed during save.");
      }
      transaction.set(reference, {
        projectName,
        structuralRevision: revision,
        structureInitialized: true,
        draftJsonPath: storagePath,
        draftJsonUrl: FieldValue.delete(),
        ...(deadline ? { deadline } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    return res.json({ success: true, draftId, revision });
  } catch (error) {
    if (uploadedPath) {
      try {
        await deleteStorageObject(uploadedPath);
      } catch (cleanupError) {
        console.error("Floor-plan draft save failed and its upload could not be removed:", cleanupError);
        return res.status(500).json({ success: false, message: "Draft save failed; cleanup of its temporary upload could not be confirmed." });
      }
    }
    return sendFailure(res, error, "Unable to save floor-plan draft.");
  }
}

async function publishDraft(req, res) {
  const draftId = normalizedString(req.params.draftId);
  const reference = adminDb.collection(DRAFTS).doc(draftId);
  let uploadedPath;
  try {
    const initialSnapshot = await reference.get();
    if (!initialSnapshot.exists) throw httpError(404, "Floor-plan draft does not exist.");
    const initial = initialSnapshot.data();
    if (initial.createdBy !== req.adminUser.uid) {
      throw httpError(403, "Only the administrator who created this draft may publish it.");
    }
    if (initial.publishedProjectId) {
      return res.json({ success: true, projectId: initial.publishedProjectId, alreadyPublished: true });
    }
    if (initial.deleting === true) {
      throw httpError(409, "This draft is being deleted.");
    }
    const deadline = normalizedString(req.body?.deadline) ||
      normalizedString(initial.deadline);
    if (!isFutureProjectDeadline(deadline, getTodayInManila())) {
      throw httpError(400, "Choose a valid project deadline after today before publishing.");
    }
    const projectName = validateName(req.body?.projectName ?? initial.projectName);
    const ownerId = normalizedString(initial.intendedClientId);
    const sourceData = req.body?.projectData ?? (
      initial.draftJsonPath ? await loadJson(initial.draftJsonPath) : null
    );
    if (!sourceData) throw httpError(400, "Save the draft before publishing it.");
    const year = currentYearInManila();
    const revision = Math.max(1, Number(initial.structuralRevision) || 1);
    validateStructure(sourceData, draftId, ownerId, projectName);
    const publishedTemplate = {
      ...sourceData,
      projectName,
      ownerId,
      workflowType: "admin-managed",
      structuralOwner: "admin",
      structuralStatus: "published",
      structuralRevision: revision,
      publishedStructuralRevision: revision,
      blueprint: null,
    };

    // Reserve the generated ID before upload; a transaction below rechecks uniqueness.
    const reservedId = await adminDb.runTransaction(async transaction => {
      const { projectId: nextProjectId } = await reserveNextProjectId(transaction, year);
      return nextProjectId;
    });
    const publishedData = {
      ...publishedTemplate,
      projectId: reservedId,
    };
    const finalJson = validateStructure(publishedData, reservedId, ownerId, projectName);
    uploadedPath = `projects/${ownerId}/${reservedId}/published-r${revision}-${randomUUID()}.json`;
    await uploadJson(uploadedPath, finalJson);
    const destinationReference = adminDb.collection(PROJECTS).doc(reservedId);
    const lockReference = assignmentReference(ownerId);
    const ownerAccount = await findClientAccountByIdentifier(
      adminDb,
      ownerId,
      { requireActive: false },
    );
    const ownerIdentifiers = [...new Set([
      ownerId,
      normalizedString(initial.intendedClientAccountId) || ownerAccount?.id || ownerId,
    ])];
    const assignmentReferences = ownerIdentifiers.map(assignmentReference);
    const ownerProjectsQueries = ownerIdentifiers.map(id =>
      adminDb.collection(PROJECTS).where("ownerId", "==", id).limit(1)
    );

    const result = await adminDb.runTransaction(async transaction => {
      const [currentDraftSnapshot, assignmentSnapshots, ownerProjectsSnapshots, destinationSnapshot] =
        await Promise.all([
          transaction.get(reference),
          Promise.all(assignmentReferences.map(ref => transaction.get(ref))),
          Promise.all(ownerProjectsQueries.map(query => transaction.get(query))),
          transaction.get(destinationReference),
        ]);
      if (!currentDraftSnapshot.exists) throw httpError(404, "Floor-plan draft was removed during publishing.");
      const currentDraft = currentDraftSnapshot.data();
      if (currentDraft.createdBy !== req.adminUser.uid) {
        throw httpError(403, "Draft ownership changed during publishing.");
      }
      if (currentDraft.publishedProjectId) {
        return { projectId: currentDraft.publishedProjectId, alreadyPublished: true };
      }
      if (currentDraft.deleting === true) {
        throw httpError(409, "This draft is being deleted.");
      }
      if (currentDraft.projectName !== initial.projectName) {
        throw httpError(409, "The draft name changed while publishing. Reload and try again.");
      }
      if (
        currentDraft.structuralRevision !== initial.structuralRevision ||
        currentDraft.draftJsonPath !== initial.draftJsonPath
      ) {
        throw httpError(409, "The floor-plan draft changed while publishing. Reload and try again.");
      }
      const primaryAssignment = assignmentSnapshots[0];
      const currentReservation = primaryAssignment.exists ? primaryAssignment.data() : null;
      const ownsDraftReservation = currentReservation?.status === "draft" &&
        currentReservation.draftId === draftId &&
        currentReservation.ownerId === ownerId;
      if (
        assignmentSnapshots.some((assignment, index) =>
          assignment.exists && !(index === 0 && ownsDraftReservation)
        ) ||
        ownerProjectsSnapshots.some(snapshot => snapshot.docs.length > 0)
      ) {
        throw httpError(409, OWNER_PROJECT_CONFLICT);
      }
      if (destinationSnapshot.exists) {
        throw httpError(409, "The generated project ID is already in use.");
      }
      const projectRecord = createPublishedFloorPlanRecord({
        projectId: reservedId,
        projectName,
        ownerId,
        deadline,
        revision,
        jsonPath: uploadedPath,
        createdBy: req.adminUser.uid,
        creatorName: req.adminUser.name,
        timestamp: FieldValue.serverTimestamp(),
      });
      commitPublishedFloorPlan(transaction, {
        projectReference: destinationReference,
        assignmentReference: lockReference,
        draftReference: reference,
        projectRecord,
        projectId: reservedId,
        ownerId,
        projectName,
        deadline,
        revision,
        actor: req.adminUser,
        timestamp: FieldValue.serverTimestamp(),
        deleteField: FieldValue.delete(),
        recordActivity: recordProjectActivity,
      });
      return { projectId: reservedId, alreadyPublished: false };
    });

    if (result.alreadyPublished) await deleteStorageObject(uploadedPath);
    return res.json({ success: true, projectId: result.projectId, alreadyPublished: result.alreadyPublished });
  } catch (error) {
    if (uploadedPath) {
      try {
        await deleteStorageObject(uploadedPath);
      } catch (cleanupError) {
        console.error("Floor-plan publication failed and its upload could not be removed:", cleanupError);
        return res.status(500).json({ success: false, message: "Publishing failed; cleanup of its temporary upload could not be confirmed." });
      }
    }
    return sendFailure(res, error, "Unable to publish floor plan.");
  }
}

async function saveProjectStructure(req, res) {
  const projectId = normalizedString(req.params.projectId);
  const reference = adminDb.collection(PROJECTS).doc(projectId);
  let uploadedPath;
  try {
    const projectSnapshot = await reference.get();
    if (!projectSnapshot.exists) throw httpError(404, "Project does not exist.");
    const existing = projectSnapshot.data();
    if (existing.createdBy !== req.adminUser.uid) {
      throw httpError(403, "Only the administrator who created this floor plan may edit it.");
    }
    if (existing.workflowType !== "admin-managed") {
      throw httpError(400, "Only admin-managed floor plans can be saved here.");
    }
    const existingStatus = getProjectStatus(existing);
    if (existingStatus === "submitted" || existingStatus === "approved") {
      throw httpError(409, "A submitted or approved project structure cannot be edited.");
    }
    const ownerId = normalizedString(existing.ownerId);
    const projectName = validateName(req.body?.projectName);
    if (normalizedString(req.body?.ownerId) !== ownerId) {
      throw httpError(400, "The client owner cannot be changed.");
    }
    const revision = Number(req.body?.revision);
    if (!Number.isSafeInteger(revision) || revision < 1) {
      throw httpError(400, "A positive floor-plan revision is required.");
    }
    const published = req.body?.published === true;
    const firstPublication = published && existing.structuralStatus !== "published";
    const deadline = firstPublication ? normalizedString(req.body?.deadline) : existing.deadline;
    if (
      firstPublication &&
      !isFutureProjectDeadline(deadline, getTodayInManila())
    ) {
      throw httpError(400, "Choose a valid project deadline after today before publishing.");
    }
    const projectData = req.body?.projectData;
    const managedData = {
      ...projectData,
      projectId,
      projectName,
      ownerId,
      workflowType: "admin-managed",
      structuralOwner: "admin",
      structuralStatus: published ? "published" : "draft",
      structuralRevision: revision,
      ...(published ? { publishedStructuralRevision: revision } : {}),
      blueprint: null,
    };
    const json = validateStructure(managedData, projectId, ownerId, projectName);
    const storagePath = `projects/${ownerId}/${projectId}/${published ? "published" : "draft"}-r${revision}-${randomUUID()}.json`;
    uploadedPath = storagePath;
    await uploadJson(storagePath, json);
    const lockReference = assignmentReference(ownerId);

    await adminDb.runTransaction(async transaction => {
      const [currentSnapshot, lockSnapshot] = await Promise.all([
        transaction.get(reference),
        transaction.get(lockReference),
      ]);
      if (!currentSnapshot.exists) throw httpError(404, "Project was removed during save.");
      const current = currentSnapshot.data();
      if (current.createdBy !== req.adminUser.uid) {
        throw httpError(403, "Project ownership changed during save.");
      }
      if (
        current.ownerId !== ownerId ||
        current.workflowType !== "admin-managed" ||
        !lockSnapshot.exists ||
        lockSnapshot.data().projectId !== projectId
      ) {
        throw httpError(409, "Project assignment or ownership changed during save.");
      }
      if (
        current.structuralRevision !== existing.structuralRevision ||
        current.publishedStructuralRevision !== existing.publishedStructuralRevision ||
        current.structuralStatus !== existing.structuralStatus ||
        current.draftJsonPath !== existing.draftJsonPath
      ) {
        throw httpError(409, "The project changed during save. Reload before trying again.");
      }
      if (!canContinueAdminStructureSave(existing, current)) {
        throw httpError(409, "The project lifecycle changed during save. Reload before trying again.");
      }

      const wasPublished = current.structuralStatus === "published"
        && Number.isSafeInteger(current.publishedStructuralRevision);
      const metadata = {
        projectId,
        projectName,
        ownerId,
        schemaVersion: 1,
        workflowType: "admin-managed",
        structuralOwner: "admin",
        structuralStatus: published || wasPublished ? "published" : "draft",
        jsonUrl: FieldValue.delete(),
        draftJsonUrl: FieldValue.delete(),
        interiorJsonUrl: FieldValue.delete(),
        submittedSnapshotUrl: FieldValue.delete(),
        approvedSnapshotUrl: FieldValue.delete(),
        ...(firstPublication ? {
          projectStatus: "available",
          deadline,
        } : {}),
        structuralRevision: published ? revision : wasPublished ? current.structuralRevision : revision,
        structureInitialized: true,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (published) {
        Object.assign(metadata, {
          jsonPath: storagePath,
          jsonUrl: FieldValue.delete(),
          publishedStructuralRevision: revision,
          clientDesignStarted: typeof current.clientDesignStarted === "boolean"
            ? current.clientDesignStarted
            : false,
        });
      } else {
        Object.assign(metadata, {
          draftJsonPath: storagePath,
          draftJsonUrl: FieldValue.delete(),
        });
      }
      transaction.set(reference, metadata, { merge: true });
      if (firstPublication) {
        recordProjectActivity(transaction, projectId, req.adminUser, "floor-plan-published", {
          newValue: { projectName, deadline, structuralRevision: revision },
        });
      }
    });
    return res.json({ success: true, projectId, revision, published });
  } catch (error) {
    if (uploadedPath) {
      try {
        await deleteStorageObject(uploadedPath);
      } catch (cleanupError) {
        console.error("Floor-plan save failed and its upload could not be removed:", cleanupError);
        return res.status(500).json({ success: false, message: "Save failed; cleanup of its temporary upload could not be confirmed." });
      }
    }
    return sendFailure(res, error, "Unable to save floor plan.");
  }
}

function hasMeaningfulInteriorData(data) {
  if (!isRecord(data)) return false;
  const furniture = Array.isArray(data.furniture) && data.furniture.some(item =>
    isRecord(item) && normalizedString(item.id) && normalizedString(item.assetId)
  );
  const floors = Array.isArray(data.floors) && data.floors.some(floor =>
    isRecord(floor) && (
      (Array.isArray(floor.furniture) && floor.furniture.length > 0) ||
      (isRecord(floor.floorFinishes) && Object.keys(floor.floorFinishes).length > 0) ||
      (isRecord(floor.wallFinishes) && Object.keys(floor.wallFinishes).length > 0)
    )
  );
  return furniture || floors ||
    (isRecord(data.floorFinishes) && Object.keys(data.floorFinishes).length > 0) ||
    (isRecord(data.wallFinishes) && Object.keys(data.wallFinishes).length > 0);
}

function hasCurrentProjectAccessAcknowledgement(project, ownerId) {
  return isCurrentProjectAcknowledgement(
    project.accessAcknowledgement,
    project.projectId,
    ownerId,
    "project-access",
    ACCESS_AGREEMENT_VERSION,
  );
}

async function saveClientInterior(req, res) {
  const projectId = normalizedString(req.params.projectId);
  const ownerId = req.clientUser.uid;
  const reference = adminDb.collection(PROJECTS).doc(projectId);
  const lockReference = assignmentReference(ownerId);
  const versionId = randomUUID();
  const versionReference = adminDb.collection(PROJECT_VERSIONS).doc(versionId);
  let uploadedPath;
  try {
    if (!projectId) throw httpError(400, "Project ID is required.");
    const interiorData = req.body?.interiorData;
    if (!isRecord(interiorData) || interiorData.projectId !== projectId || interiorData.ownerId !== ownerId) {
      throw httpError(400, "Interior data does not match the signed-in client and project.");
    }
    if (
      (interiorData.furniture !== undefined && !Array.isArray(interiorData.furniture)) ||
      (interiorData.floorFinishes !== undefined && !isRecord(interiorData.floorFinishes)) ||
      (interiorData.wallFinishes !== undefined && !isRecord(interiorData.wallFinishes)) ||
      (interiorData.floors !== undefined && !Array.isArray(interiorData.floors))
    ) {
      throw httpError(400, "Interior design data is invalid.");
    }
    const serialized = JSON.stringify(stripManagedFileUrlFields(interiorData));
    if (Buffer.byteLength(serialized, "utf8") > MAX_STRUCTURE_BYTES) {
      throw httpError(413, "Interior design data exceeds the 10 MB limit.");
    }
    const estimatedCost = Number(req.body?.estimatedCost);
    if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
      throw httpError(400, "Estimated cost must be a non-negative number.");
    }
    const [initialSnapshot, initialAssignment] = await Promise.all([
      reference.get(),
      lockReference.get(),
    ]);
    if (!initialSnapshot.exists) throw httpError(404, "Project does not exist.");
    const initial = initialSnapshot.data();
    assertAssignedClient(initial, initialAssignment, projectId, ownerId);
    if (!hasCurrentProjectAccessAcknowledgement(initial, ownerId)) {
      throw httpError(403, "Acknowledge project access before saving a design.");
    }
    const lockReason = getClientEditLockReason(initial, getPhilippineDateTimeKey());
    if (lockReason) throw httpError(409, lockReason);

    const versionNumber = (Number.isSafeInteger(initial.currentDesignVersionNumber)
      ? initial.currentDesignVersionNumber
      : 0) + 1;
    const storagePath = `projects/${ownerId}/${projectId}/versions/${versionId}.json`;
    uploadedPath = storagePath;
    await uploadJson(storagePath, serialized);
    const thumbnailPath = normalizedString(req.body?.thumbnailPath);
    const thumbnailUrl = normalizedString(req.body?.thumbnailUrl);
    if (thumbnailPath && thumbnailPath !== `projects/${ownerId}/${projectId}.jpg`) {
      throw httpError(400, "Thumbnail path does not match this client project.");
    }

    await adminDb.runTransaction(async transaction => {
      const [projectSnapshot, assignmentSnapshot] = await Promise.all([
        transaction.get(reference),
        transaction.get(lockReference),
      ]);
      if (!projectSnapshot.exists) throw httpError(404, "Project does not exist.");
      const current = projectSnapshot.data();
      assertAssignedClient(current, assignmentSnapshot, projectId, ownerId);
      if (!hasCurrentProjectAccessAcknowledgement(current, ownerId)) {
        throw httpError(403, "Acknowledge project access before saving a design.");
      }
      const currentLockReason = getClientEditLockReason(current, getPhilippineDateTimeKey());
      if (currentLockReason) throw httpError(409, currentLockReason);
      if (
        (current.currentDesignVersionId ?? null) !==
          (initial.currentDesignVersionId ?? null) ||
        (current.currentDesignVersionNumber ?? 0) !==
          (initial.currentDesignVersionNumber ?? 0)
      ) {
        throw httpError(409, "A newer design version was saved. Reload the project before saving again.");
      }
      const update = {
        projectId,
        ownerId,
        schemaVersion: 1,
        estimatedCost,
        interiorJsonPath: storagePath,
        interiorJsonUrl: FieldValue.delete(),
        currentDesignVersionId: versionId,
        currentDesignVersionNumber: versionNumber,
        projectStatus: "ongoing",
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (hasMeaningfulInteriorData(interiorData)) {
        update.clientDesignStarted = true;
        if (!current.clientDesignStartedAt) {
          update.clientDesignStartedAt = FieldValue.serverTimestamp();
        }
      }
      if (thumbnailPath && thumbnailUrl) {
        update.thumbnailPath = thumbnailPath;
        update.thumbnailUrl = thumbnailUrl;
      }
      transaction.create(versionReference, {
        projectId,
        ownerId,
        versionId,
        versionNumber,
        createdBy: ownerId,
        actorRole: "client",
        snapshotType: "design",
        storagePath,
        estimatedCost,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(reference, update, { merge: true });
      recordProjectActivity(transaction, projectId, { uid: ownerId, role: "client" }, "design-saved", {
        versionId,
        newValue: { versionNumber },
      });
      recordProjectActivity(transaction, projectId, { uid: ownerId, role: "client" }, "design-version-created", {
        versionId,
        newValue: { versionNumber, snapshotType: "design" },
      });
    });
    return res.json({ success: true, versionId, versionNumber });
  } catch (error) {
    if (uploadedPath) {
      try {
        await deleteStorageObject(uploadedPath);
      } catch (cleanupError) {
        console.error("Client interior save failed and its upload could not be removed:", cleanupError);
        return res.status(500).json({ success: false, message: "Interior save failed; cleanup of its temporary upload could not be confirmed." });
      }
    }
    return sendFailure(res, error, "Unable to save client project content.");
  }
}

async function getClientProjectWorkflow(req, res) {
  try {
    const projectId = normalizedString(req.params.projectId);
    const ownerId = req.clientUser.uid;
    if (!projectId) throw httpError(400, "Project ID is required.");
    const [projectSnapshot, assignmentSnapshot] = await Promise.all([
      adminDb.collection(PROJECTS).doc(projectId).get(),
      assignmentReference(ownerId).get(),
    ]);
    if (!projectSnapshot.exists) throw httpError(404, "Project does not exist.");
    const project = projectSnapshot.data();
    assertAssignedClient(project, assignmentSnapshot, projectId, ownerId);
    const submissionAgreement = project.submissionAgreement;
    return res.json({
      success: true,
      workflow: {
        projectId,
        projectName: project.projectName,
        projectStatus: getProjectStatus(project),
        deadline: project.deadline ?? null,
        currentDesignVersionId: project.currentDesignVersionId ?? null,
        currentDesignVersionNumber: project.currentDesignVersionNumber ?? null,
        clientDesignStarted: project.clientDesignStarted === true,
        submittedVersionId: project.submittedVersionId ?? null,
        submittedVersionNumber: project.submittedVersionNumber ?? null,
        submittedAt: timestampToIso(project.submittedAt),
        revisionFeedback: project.revisionFeedback ?? null,
        revisionRequestedAt: timestampToIso(project.revisionRequestedAt),
        approvedAt: timestampToIso(project.approvedAt),
        accessAcknowledged:
            hasCurrentProjectAccessAcknowledgement(project, ownerId),
        submissionAgreementAcknowledged: isCurrentProjectAcknowledgement(
            submissionAgreement,
            projectId,
            ownerId,
            "project-submission",
            SUBMISSION_AGREEMENT_VERSION,
        ),
      },
    });
  } catch (error) {
    return sendFailure(res, error, "Unable to load project workflow.");
  }
}

async function getManagedProjectFile(req, res, isAdmin) {
  try {
    const projectId = normalizedString(req.params.projectId);
    const kind = normalizedString(req.params.kind);
    const ownerId = isAdmin ? "" : req.clientUser.uid;
    if (!projectId || !["structure", "editable-structure", "interior", "version", "submitted", "approved", "submission"].includes(kind)) {
      throw httpError(400, "A valid project file request is required.");
    }
    if (!isAdmin && !isClientAccessibleManagedProjectFileKind(kind)) {
      throw httpError(404, "Managed project file does not exist.");
    }

    const projectReference = adminDb.collection(PROJECTS).doc(projectId);
    const projectSnapshot = await projectReference.get();
    if (!projectSnapshot.exists) throw httpError(404, "Project file does not exist.");
    const projectData = projectSnapshot.data();
    if (projectData.workflowType !== "admin-managed") {
      throw httpError(404, "Managed project file does not exist.");
    }
    const project = {
      ...projectData,
      projectId: normalizedString(projectData.projectId) || projectId,
    };

    if (!isAdmin) {
      const assignmentSnapshot = await assignmentReference(ownerId).get();
      assertAssignedClient(project, assignmentSnapshot, projectId, ownerId);
    }

    const fileId = normalizedString(req.params.fileId);
    const versionId = kind === "version"
      ? fileId
      : kind === "interior"
        ? normalizedString(project.currentDesignVersionId)
        : "";
    const submissionId = kind === "submission"
      ? fileId
      : kind === "submitted"
        ? normalizedString(project.submittedSubmissionId)
        : kind === "approved"
          ? normalizedString(project.approvedSubmissionId)
          : "";

    const [versionSnapshot, submissionSnapshot] = await Promise.all([
      versionId
        ? adminDb.collection(PROJECT_VERSIONS).doc(versionId).get()
        : Promise.resolve(null),
      submissionId
        ? adminDb.collection(PROJECT_SUBMISSIONS).doc(submissionId).get()
        : Promise.resolve(null),
    ]);
    const versionRecord = versionSnapshot?.exists ? versionSnapshot.data() : null;
    const submissionRecord = submissionSnapshot?.exists ? submissionSnapshot.data() : null;
    const storagePath = resolveManagedProjectFilePath({
      project,
      projectId,
      ownerId: project.ownerId,
      kind,
      fileId,
      versionRecord,
      submissionRecord,
    });
    if (!storagePath) throw httpError(404, "Managed project file does not exist.");

    const file = adminStorage.file(storagePath);
    const [fileMetadata] = await file.getMetadata();
    if (Number(fileMetadata.size) > MAX_STRUCTURE_BYTES) {
      throw httpError(413, "Managed project JSON exceeds the download size limit.");
    }
    if (
      typeof fileMetadata.contentType === "string" &&
      fileMetadata.contentType !== "application/json"
    ) {
      throw httpError(409, "Managed project file is not JSON.");
    }
    const [contents] = await file.download();
    let payload;
    try {
      payload = JSON.parse(contents.toString("utf8"));
    } catch {
      throw httpError(409, "Saved managed project JSON is invalid.");
    }
    if (
      !isRecord(payload) ||
      (payload.projectId !== undefined && payload.projectId !== projectId) ||
      (payload.ownerId !== undefined && payload.ownerId !== project.ownerId)
    ) {
      throw httpError(409, "Saved managed project JSON does not match its project.");
    }

    res.set({
      "Cache-Control": "private, no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    return res.type("application/json").send(JSON.stringify(stripManagedFileUrlFields(payload)));
  } catch (error) {
    if (
      String(error?.code) === "404" ||
      error?.code === "storage/object-not-found"
    ) {
      return res.status(404).json({ success: false, message: "Managed project file does not exist." });
    }
    return sendFailure(res, error, "Unable to download managed project file.");
  }
}

async function getClientManagedProjectFile(req, res) {
  return getManagedProjectFile(req, res, false);
}

async function getAdminManagedProjectFile(req, res) {
  return getManagedProjectFile(req, res, true);
}

function setPublicNoCacheHeaders(req, res, next) {
  res.set({
    "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "Vary": "Authorization",
    "X-Content-Type-Options": "nosniff",
  });
  return next();
}

function publicProjectNotFound(res) {
  return res.status(404).json({
    success: false,
    message: "Public design not found.",
  });
}

async function getEligiblePublicProject(publicId, viewerUid) {
  if (!publicId) return null;
  const snapshot = await adminDb.collection(PROJECTS)
    .where("publicId", "==", publicId)
    .limit(2)
    .get();
  if (snapshot.docs.length !== 1) return null;
  const document = snapshot.docs[0];
  const data = document.data();
  if (!isPubliclyEligibleProject(data, viewerUid)) return null;
  const submissionId = normalizedString(data.approvedSubmissionId);
  if (!submissionId) return null;
  const submissionSnapshot = await adminDb.collection(PROJECT_SUBMISSIONS)
    .doc(submissionId)
    .get();
  const submissionRecord = submissionSnapshot.exists ? submissionSnapshot.data() : null;
  if (!hasApprovedConsentSnapshot(data, document.id, submissionRecord)) return null;
  return { document, data, projectId: document.id, submissionRecord };
}

async function ensurePublicNumber(projectReference, publicId, viewerUid) {
  const counterReference = adminDb.collection("idCounters").doc("public-design-inspirations");
  return adminDb.runTransaction(async transaction => {
    const projectSnapshot = await transaction.get(projectReference);
    if (!projectSnapshot.exists) return null;
    const project = projectSnapshot.data();
    if (
      project.publicId !== publicId ||
      !isPubliclyEligibleProject(project, viewerUid)
    ) {
      return null;
    }
    if (Number.isSafeInteger(project.publicNumber) && project.publicNumber > 0) {
      return project.publicNumber;
    }

    const counterSnapshot = await transaction.get(counterReference);
    const previousNumber = counterSnapshot.exists
      ? Number(counterSnapshot.data().lastSequence ?? 0)
      : 0;
    if (!Number.isSafeInteger(previousNumber) || previousNumber < 0) {
      throw httpError(500, "The public design number counter is invalid.");
    }
    const publicNumber = previousNumber + 1;
    if (!Number.isSafeInteger(publicNumber)) {
      throw httpError(500, "Unable to generate another public design number.");
    }
    transaction.set(counterReference, {
      lastSequence: publicNumber,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(projectReference, { publicNumber }, { merge: true });
    return publicNumber;
  });
}

async function listPublicProjects(req, res) {
  try {
    let pageOptions;
    try {
      pageOptions = getPublicGalleryPageOptions(req.query);
    } catch (error) {
      throw httpError(400, error.message);
    }
    const { limit, cursor } = pageOptions;
    const pageEntries = [];
    let scanSnapshot = null;
    let exhausted = false;
    const scanBatchSize = 40;
    if (cursor) {
      const cursorSnapshot = await adminDb.collection(PROJECTS)
        .where("publicId", "==", cursor)
        .limit(2)
        .get();
      if (cursorSnapshot.size !== 1) {
        throw httpError(400, "Public design cursor is invalid.");
      }
      scanSnapshot = cursorSnapshot.docs[0];
    }
    while (pageEntries.length <= limit && !exhausted) {
      let projectsQuery = adminDb.collection(PROJECTS)
        .where("isPublic", "==", true)
        .orderBy(FieldPath.documentId());
      if (scanSnapshot) projectsQuery = projectsQuery.startAfter(scanSnapshot);
      const snapshot = await projectsQuery.limit(scanBatchSize).get();
      if (snapshot.empty) {
        exhausted = true;
        break;
      }

      for (const document of snapshot.docs) {
        const data = document.data();
        scanSnapshot = document;
        if (!isPubliclyEligibleProject(data, req.clientUser.uid)) continue;
        const submissionId = normalizedString(data.approvedSubmissionId);
        if (!submissionId) continue;
        const submission = await adminDb.collection(PROJECT_SUBMISSIONS)
          .doc(submissionId)
          .get();
        if (
          !submission.exists ||
          !hasApprovedConsentSnapshot(data, document.id, submission.data())
        ) {
          continue;
        }

        const publicNumber = await ensurePublicNumber(
          document.ref,
          data.publicId,
          req.clientUser.uid,
        );
        if (publicNumber === null) continue;
        const [entry] = createPublicGalleryItems([{
          projectId: document.id,
          data: { ...data, publicNumber },
        }], req.clientUser.uid);
        if (entry) pageEntries.push(entry);
        if (pageEntries.length > limit) break;
      }
      if (snapshot.size < scanBatchSize) exhausted = true;
    }

    const hasMore = pageEntries.length > limit;
    const entries = pageEntries.slice(0, limit);
    const thumbnailUrls = new Map();
    await Promise.all(entries.map(async entry => {
      if (isSafePublicThumbnailPath(entry.thumbnailPath, entry.ownerId, entry.projectId)) {
        const thumbnail = adminStorage.file(entry.thumbnailPath);
        try {
          const [metadata] = await thumbnail.getMetadata();
          if (
            Number(metadata.size) > 0 &&
            ["image/jpeg", "image/png", "image/webp"].includes(metadata.contentType)
          ) {
            thumbnailUrls.set(
              entry.publicId,
              `/api/projects/public/${encodeURIComponent(entry.publicId)}/thumbnail`,
            );
          }
        } catch (error) {
          if (
            String(error?.code) !== "404" &&
            error?.code !== "storage/object-not-found"
          ) {
            throw error;
          }
        }
      }
    }));
    const designs = createPublicGalleryResponse(entries, thumbnailUrls);
    return res.json({
      success: true,
      designs,
      nextCursor: hasMore ? entries[entries.length - 1].publicId : null,
      hasMore,
    });
  } catch (error) {
    return sendFailure(res, error, "Unable to load public designs.");
  }
}

async function loadPublicProjectSnapshot(path) {
  try {
    const file = adminStorage.file(path);
    const [metadata] = await file.getMetadata();
    if (
      Number(metadata.size) > MAX_STRUCTURE_BYTES ||
      (typeof metadata.contentType === "string" &&
        metadata.contentType !== "application/json")
    ) {
      return null;
    }
    const [contents] = await file.download();
    const payload = JSON.parse(contents.toString("utf8"));
    return isRecord(payload) ? payload : null;
  } catch (error) {
    if (
      String(error?.code) === "404" ||
      error?.code === "storage/object-not-found" ||
      error instanceof SyntaxError
    ) {
      return null;
    }
    throw error;
  }
}

async function getPublicProjectPreview(req, res) {
  try {
    const publicId = normalizedString(req.params.publicId);
    const eligible = await getEligiblePublicProject(publicId, req.clientUser.uid);
    if (!eligible) return publicProjectNotFound(res);
    const publicNumber = await ensurePublicNumber(
      eligible.document.ref,
      publicId,
      req.clientUser.uid,
    );
    if (publicNumber === null) return publicProjectNotFound(res);

    const project = {
      ...eligible.data,
      publicNumber,
      projectId: normalizedString(eligible.data.projectId) || eligible.projectId,
    };
    const submissionRecord = eligible.submissionRecord;
    const fileContext = {
      project,
      projectId: eligible.projectId,
      ownerId: project.ownerId,
      submissionRecord,
    };
    const structurePath = resolveManagedProjectFilePath({
      ...fileContext,
      kind: "structure",
    });
    const approvedPath = resolveManagedProjectFilePath({
      ...fileContext,
      kind: "approved",
    });
    if (!structurePath || !approvedPath) return publicProjectNotFound(res);

    const [structure, interior] = await Promise.all([
      loadPublicProjectSnapshot(structurePath),
      loadPublicProjectSnapshot(approvedPath),
    ]);
    if (
      !structure ||
      !interior ||
      structure.projectId !== eligible.projectId ||
      structure.ownerId !== project.ownerId ||
      structure.workflowType !== "admin-managed" ||
      structure.structuralStatus !== "published" ||
      structure.structuralRevision !== project.publishedStructuralRevision ||
      structure.publishedStructuralRevision !== project.publishedStructuralRevision ||
      interior.projectId !== eligible.projectId ||
      interior.ownerId !== project.ownerId
    ) {
      return publicProjectNotFound(res);
    }

    const currentSnapshot = await eligible.document.ref.get();
    if (
      !currentSnapshot.exists ||
      !isPubliclyEligibleProject(currentSnapshot.data(), req.clientUser.uid) ||
      currentSnapshot.data().publicId !== publicId ||
      currentSnapshot.data().approvedSubmissionId !== project.approvedSubmissionId
    ) {
      return publicProjectNotFound(res);
    }

    const title = `Design Inspiration #${publicNumber}`;

    return res.json({
      success: true,
      publicId,
      title,
      projectData: createPublicProjectSnapshot(structure, interior, title),
    });
  } catch (error) {
    return sendFailure(res, error, "Unable to load public design.");
  }
}

async function getPublicProjectThumbnail(req, res) {
  try {
    const eligible = await getEligiblePublicProject(
      normalizedString(req.params.publicId),
      req.clientUser.uid,
    );
    if (!eligible) return publicProjectNotFound(res);
    const path = eligible.data.thumbnailPath;
    if (!isSafePublicThumbnailPath(path, eligible.data.ownerId, eligible.projectId)) {
      return publicProjectNotFound(res);
    }

    const file = adminStorage.file(path);
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType;
    if (
      Number(metadata.size) <= 0 ||
      Number(metadata.size) > 5 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(contentType)
    ) {
      return publicProjectNotFound(res);
    }
    const [contents] = await file.download();
    const currentSnapshot = await eligible.document.ref.get();
    if (
      !currentSnapshot.exists ||
      !isPubliclyEligibleProject(currentSnapshot.data(), req.clientUser.uid) ||
      currentSnapshot.data().publicId !== eligible.data.publicId
    ) {
      return publicProjectNotFound(res);
    }
    return res.type(contentType).send(contents);
  } catch (error) {
    if (
      String(error?.code) === "404" ||
      error?.code === "storage/object-not-found"
    ) {
      return publicProjectNotFound(res);
    }
    return sendFailure(res, error, "Unable to load public design thumbnail.");
  }
}

async function acknowledgeProjectAccess(req, res) {
  const projectId = normalizedString(req.params.projectId);
  const ownerId = req.clientUser.uid;
  const reference = adminDb.collection(PROJECTS).doc(projectId);
  const assignment = assignmentReference(ownerId);
  try {
    if (!projectId) throw httpError(400, "Project ID is required.");
    if (req.body?.agreementVersion !== ACCESS_AGREEMENT_VERSION) {
      throw httpError(400, "The project access agreement version is invalid.");
    }
    await adminDb.runTransaction(async transaction => {
      const [projectSnapshot, assignmentSnapshot] = await Promise.all([
        transaction.get(reference),
        transaction.get(assignment),
      ]);
      if (!projectSnapshot.exists) throw httpError(404, "Project does not exist.");
      const project = projectSnapshot.data();
      assertAssignedClient(project, assignmentSnapshot, projectId, ownerId);
      if (getProjectStatus(project) === "submitted" || getProjectStatus(project) === "approved") {
        throw httpError(409, "This project is no longer available for client editing.");
      }
      if (hasCurrentProjectAccessAcknowledgement(project, ownerId)) return;
      const acceptedAt = FieldValue.serverTimestamp();
      transaction.set(reference, {
        accessAcknowledgement: {
          projectId,
          userId: ownerId,
          agreementType: "project-access",
          agreementVersion: ACCESS_AGREEMENT_VERSION,
          accepted: true,
          acceptedAt,
          deadlineAtAcceptance: project.deadline ?? null,
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      recordProjectActivity(transaction, projectId, { uid: ownerId, role: "client" }, "project-acknowledged", {
        newValue: { agreementType: "project-access", agreementVersion: ACCESS_AGREEMENT_VERSION },
      });
    });
    return res.json({ success: true, agreementVersion: ACCESS_AGREEMENT_VERSION });
  } catch (error) {
    return sendFailure(res, error, "Unable to record project acknowledgement.");
  }
}

async function acknowledgeSubmissionAgreement(req, res) {
  const projectId = normalizedString(req.params.projectId);
  const ownerId = req.clientUser.uid;
  const reference = adminDb.collection(PROJECTS).doc(projectId);
  const assignment = assignmentReference(ownerId);
  try {
    if (!projectId) throw httpError(400, "Project ID is required.");
    if (
      req.body?.agreementVersion !== SUBMISSION_AGREEMENT_VERSION ||
      req.body?.accepted !== true
    ) {
      throw httpError(400, "Explicit acknowledgement of the submission agreement is required.");
    }
    await adminDb.runTransaction(async transaction => {
      const [projectSnapshot, assignmentSnapshot] = await Promise.all([
        transaction.get(reference),
        transaction.get(assignment),
      ]);
      if (!projectSnapshot.exists) throw httpError(404, "Project does not exist.");
      const project = projectSnapshot.data();
      assertAssignedClient(project, assignmentSnapshot, projectId, ownerId);
      const lockReason = getClientEditLockReason(project, getPhilippineDateTimeKey());
      if (lockReason) throw httpError(409, lockReason);
      if (!hasCurrentProjectAccessAcknowledgement(project, ownerId)) {
        throw httpError(409, "Acknowledge project access before submission.");
      }
      transaction.set(reference, {
        submissionAgreement: {
          projectId,
          userId: ownerId,
          agreementType: "project-submission",
          agreementVersion: SUBMISSION_AGREEMENT_VERSION,
          accepted: true,
          acceptedAt: FieldValue.serverTimestamp(),
        },
      }, { merge: true });
      recordProjectActivity(transaction, projectId, { uid: ownerId, role: "client" }, "submission-agreement-acknowledged", {
        newValue: { agreementType: "project-submission", agreementVersion: SUBMISSION_AGREEMENT_VERSION },
      });
    });
    return res.json({ success: true, agreementVersion: SUBMISSION_AGREEMENT_VERSION });
  } catch (error) {
    return sendFailure(res, error, "Unable to record submission agreement acknowledgement.");
  }
}

async function submitClientProject(req, res) {
  const projectId = normalizedString(req.params.projectId);
  const ownerId = req.clientUser.uid;
  const reference = adminDb.collection(PROJECTS).doc(projectId);
  const assignment = assignmentReference(ownerId);
  const submissionId = randomUUID();
  const submissionReference = adminDb.collection(PROJECT_SUBMISSIONS).doc(submissionId);
  let uploadedPath;
  try {
    if (!projectId) throw httpError(400, "Project ID is required.");
    if (
      req.body?.publicConsent !== undefined &&
      typeof req.body.publicConsent !== "boolean"
    ) {
      throw httpError(400, "Public consent must be true or false.");
    }
    const publicConsent = req.body?.publicConsent === true;
    const publicConsentAt = publicConsent ? FieldValue.serverTimestamp() : null;
    const [initialSnapshot, assignmentSnapshot] = await Promise.all([
      reference.get(),
      assignment.get(),
    ]);
    if (!initialSnapshot.exists) throw httpError(404, "Project does not exist.");
    const initial = initialSnapshot.data();
    assertAssignedClient(initial, assignmentSnapshot, projectId, ownerId);
    const initialLockReason = getClientEditLockReason(initial, getPhilippineDateTimeKey());
    if (initialLockReason) throw httpError(409, initialLockReason);
    if (
      !isCurrentProjectAcknowledgement(
        initial.submissionAgreement,
        projectId,
        ownerId,
        "project-submission",
        SUBMISSION_AGREEMENT_VERSION,
      ) ||
      !hasCurrentProjectAccessAcknowledgement(initial, ownerId)
    ) {
      throw httpError(409, "Acknowledge the Project Submission Agreement before submitting.");
    }
    const sourcePath = getInteriorStoragePath(initial, ownerId, projectId);
    if (!sourcePath) throw httpError(409, "Save a design version before submitting.");
    const [sourceContents] = await adminStorage.file(sourcePath).download();
    let submittedData;
    try {
      submittedData = JSON.parse(sourceContents.toString("utf8"));
    } catch {
      throw httpError(409, "The latest saved design version is invalid.");
    }
    if (
      !isRecord(submittedData) ||
      submittedData.projectId !== projectId ||
      submittedData.ownerId !== ownerId
    ) {
      throw httpError(409, "The saved design does not match this project and client.");
    }
    const versionId = initial.currentDesignVersionId ?? `legacy-${randomUUID()}`;
    const versionNumber = Number.isSafeInteger(initial.currentDesignVersionNumber)
      ? initial.currentDesignVersionNumber
      : 0;
    uploadedPath = `projects/${ownerId}/${projectId}/submissions/${submissionId}.json`;
    await uploadJson(uploadedPath, sourceContents.toString("utf8"));

    await adminDb.runTransaction(async transaction => {
      const [projectSnapshot, currentAssignment] = await Promise.all([
        transaction.get(reference),
        transaction.get(assignment),
      ]);
      if (!projectSnapshot.exists) throw httpError(404, "Project does not exist.");
      const current = projectSnapshot.data();
      assertAssignedClient(current, currentAssignment, projectId, ownerId);
      const currentStatus = getProjectStatus(current);
      const currentLockReason = getClientEditLockReason(current, getPhilippineDateTimeKey());
      if (currentLockReason) throw httpError(409, currentLockReason);
      if (
        getInteriorStoragePath(current, ownerId, projectId) !== sourcePath ||
        (current.currentDesignVersionId ?? null) !== (initial.currentDesignVersionId ?? null) ||
        !isCurrentProjectAcknowledgement(
          current.submissionAgreement,
          projectId,
          ownerId,
          "project-submission",
          SUBMISSION_AGREEMENT_VERSION,
        ) ||
        !hasCurrentProjectAccessAcknowledgement(current, ownerId)
      ) {
        throw httpError(409, "The project changed during submission. Reload and try again.");
      }
      transaction.create(submissionReference, {
        projectId,
        ownerId,
        ...getPublicConsentFields(publicConsent, publicConsentAt),
        submissionId,
        versionId,
        versionNumber,
        snapshotType: "submission",
        snapshotPath: uploadedPath,
        submittedBy: ownerId,
        submittedAt: FieldValue.serverTimestamp(),
        agreementVersion: SUBMISSION_AGREEMENT_VERSION,
      });
      transaction.set(reference, {
        ...getPublicConsentFields(publicConsent, publicConsentAt),
        projectStatus: "submitted",
        submittedVersionId: versionId,
        submittedVersionNumber: versionNumber,
        submittedSubmissionId: submissionId,
        submittedSnapshotPath: uploadedPath,
        submittedSnapshotUrl: FieldValue.delete(),
        submittedAt: FieldValue.serverTimestamp(),
        submittedBy: ownerId,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      recordProjectActivity(
        transaction,
        projectId,
        { uid: ownerId, role: "client" },
        currentStatus === "revision-requested" ? "project-resubmitted" : "project-submitted",
        {
          versionId,
          newValue: { submissionId, versionNumber },
        },
      );
    });
    return res.json({ success: true, submissionId, versionId, versionNumber });
  } catch (error) {
    if (uploadedPath) {
      try {
        await deleteStorageObject(uploadedPath);
      } catch (cleanupError) {
        console.error("Project submission failed and its new snapshot could not be removed:", cleanupError);
        return res.status(500).json({ success: false, message: "Submission failed; temporary snapshot cleanup could not be confirmed." });
      }
    }
    return sendFailure(res, error, "Unable to submit project.");
  }
}

async function reviewSubmittedProject(req, res) {
  const projectId = normalizedString(req.params.projectId);
  const action = req.body?.action;
  const reason = normalizedString(req.body?.reason);
  const reference = adminDb.collection(PROJECTS).doc(projectId);
  try {
    if (!projectId) throw httpError(400, "Project ID is required.");
    if (!["approve", "request-revision"].includes(action)) {
      throw httpError(400, "Choose approve or request-revision.");
    }
    if (action === "request-revision" && (!reason || reason.length > 2000)) {
      throw httpError(400, "Revision feedback is required and must be 2,000 characters or fewer.");
    }
    const result = await adminDb.runTransaction(async transaction => {
      const projectSnapshot = await transaction.get(reference);
      if (!projectSnapshot.exists) throw httpError(404, "Project does not exist.");
      const project = projectSnapshot.data();
      const status = getProjectStatus(project);
      if (!canTransitionProject(status, action)) {
        throw httpError(409, "Only a submitted project can be approved or returned for revision.");
      }
      const update = {
        projectStatus: action === "approve" ? "approved" : "revision-requested",
        ...getProjectReviewVisibilityUpdate(action),
        reviewedBy: req.adminUser.uid,
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (action === "approve") {
        Object.assign(update, {
          approvedBy: req.adminUser.uid,
          approvedByName: req.adminUser.name || "",
          approvedAt: FieldValue.serverTimestamp(),
          approvedVersionId: project.submittedVersionId ?? null,
          approvedVersionNumber: Number.isSafeInteger(project.submittedVersionNumber)
            ? project.submittedVersionNumber
            : null,
          approvedSubmissionId: project.submittedSubmissionId ?? null,
          approvedSnapshotPath: project.submittedSnapshotPath ?? null,
          approvedSnapshotUrl: FieldValue.delete(),
        });
      } else {
        Object.assign(update, {
          ...getPublicConsentFields(false, null),
          revisionFeedback: reason,
          revisionRequestedAt: FieldValue.serverTimestamp(),
          revisionRequestedBy: req.adminUser.uid,
          submissionAgreement: null,
        });
      }
      transaction.set(reference, update, { merge: true });
      recordProjectActivity(
        transaction,
        projectId,
        req.adminUser,
        action === "approve" ? "project-approved" : "revision-requested",
        {
          versionId: project.submittedVersionId ?? null,
          description: action === "request-revision" ? reason : undefined,
          newValue: action === "approve"
            ? { approvedSubmissionId: project.submittedSubmissionId ?? null }
            : { projectStatus: "revision-requested" },
        },
      );
      return {
        projectStatus: update.projectStatus,
        submittedSubmissionId: project.submittedSubmissionId,
      };
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendFailure(res, error, "Unable to review submitted project.");
  }
}

async function updateProjectPublicVisibility(req, res) {
  const projectId = normalizedString(req.params.projectId);
  const requestedVisibility = req.body?.isPublic;
  const reference = adminDb.collection(PROJECTS).doc(projectId);
  try {
    if (!projectId) throw httpError(400, "Project ID is required.");
    if (typeof requestedVisibility !== "boolean") {
      throw httpError(400, "Public visibility must be true or false.");
    }

    const result = await adminDb.runTransaction(async transaction => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw httpError(404, "Project does not exist.");
      const project = snapshot.data();
      let generatedPublicNumber;
      let counterReference;
      let counterSnapshot;
      if (
        requestedVisibility &&
        (!Number.isSafeInteger(project.publicNumber) || project.publicNumber < 1)
      ) {
        counterReference = adminDb.collection("idCounters").doc("public-design-inspirations");
        counterSnapshot = await transaction.get(counterReference);
        const previousNumber = counterSnapshot.exists
          ? Number(counterSnapshot.data().lastSequence ?? 0)
          : 0;
        if (!Number.isSafeInteger(previousNumber) || previousNumber < 0) {
          throw httpError(500, "The public design number counter is invalid.");
        }
        generatedPublicNumber = previousNumber + 1;
        if (!Number.isSafeInteger(generatedPublicNumber)) {
          throw httpError(500, "Unable to generate another public design number.");
        }
      }
      const visibilityUpdate = getPublicVisibilityUpdate(
        project,
        requestedVisibility,
        requestedVisibility ? randomUUID() : "",
        generatedPublicNumber,
      );
      if (!visibilityUpdate) {
        throw httpError(
          409,
          "Only an approved project with explicit client consent can be made public.",
        );
      }

      const wasPublic = project.isPublic === true;
      transaction.set(reference, {
        ...visibilityUpdate,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      if (counterReference && counterSnapshot) {
        transaction.set(counterReference, {
          lastSequence: generatedPublicNumber,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      recordProjectActivity(
        transaction,
        projectId,
        req.adminUser,
        requestedVisibility ? "project-made-public" : "project-made-private",
        {
          previousValue: { isPublic: wasPublic },
          newValue: { isPublic: requestedVisibility },
        },
      );

      return {
        isPublic: requestedVisibility,
        publicId: visibilityUpdate.publicId ?? project.publicId ?? null,
      };
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendFailure(res, error, "Unable to update project public visibility.");
  }
}

async function readProjectActivity(projectId) {
  const snapshot = await adminDb.collection(PROJECT_ACTIVITY)
    .where("projectId", "==", projectId)
    .get();
  return snapshot.docs
    .map(document => {
      const data = document.data();
      return {
        id: document.id,
        ...data,
        createdAt: timestampToIso(data.createdAt),
      };
    })
    .sort((first, second) => {
      const getTime = value => {
        if (typeof value?.toMillis === "function") return value.toMillis();
        if (value instanceof Date) return value.getTime();
        if (typeof value === "string") {
          const parsed = Date.parse(value);
          return Number.isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };
      const firstTime = getTime(first.createdAt);
      const secondTime = getTime(second.createdAt);
      return secondTime - firstTime;
    })
    .slice(0, 100);
}

async function getProjectActivity(req, res) {
  try {
    const projectId = normalizedString(req.params.projectId);
    if (!projectId) throw httpError(400, "Project ID is required.");
    const project = await adminDb.collection(PROJECTS).doc(projectId).get();
    if (!project.exists) throw httpError(404, "Project does not exist.");
    return res.json({ success: true, activities: await readProjectActivity(projectId) });
  } catch (error) {
    return sendFailure(res, error, "Unable to load project activity.");
  }
}

async function getClientProjectActivity(req, res) {
  try {
    const projectId = normalizedString(req.params.projectId);
    const ownerId = req.clientUser.uid;
    if (!projectId) throw httpError(400, "Project ID is required.");
    const [project, assignment] = await Promise.all([
      adminDb.collection(PROJECTS).doc(projectId).get(),
      assignmentReference(ownerId).get(),
    ]);
    if (!project.exists) throw httpError(404, "Project does not exist.");
    assertAssignedClient(project.data(), assignment, projectId, ownerId);
    return res.json({ success: true, activities: await readProjectActivity(projectId) });
  } catch (error) {
    return sendFailure(res, error, "Unable to load project activity.");
  }
}

async function getClientProjectComments(req, res) {
  try {
    const projectId = normalizedString(req.params.projectId);
    const ownerId = req.clientUser.uid;
    if (!projectId) throw httpError(400, "Project ID is required.");
    const [project, assignment] = await Promise.all([
      adminDb.collection(PROJECTS).doc(projectId).get(),
      assignmentReference(ownerId).get(),
    ]);
    if (!project.exists) throw httpError(404, "Project does not exist.");
    assertAssignedClient(project.data(), assignment, projectId, ownerId);
    const snapshot = await adminDb.collection("adminComments")
      .where("projectId", "==", projectId)
      .get();
    const comments = snapshot.docs
      .map(document => {
        const data = document.data();
        return {
          id: document.id,
          ...data,
          createdAt: timestampToIso(data.createdAt),
        };
      })
      .sort((first, second) => {
        const firstTime = first.createdAt?.toMillis?.() ?? 0;
        const secondTime = second.createdAt?.toMillis?.() ?? 0;
        return firstTime - secondTime;
      });
    return res.json({ success: true, comments });
  } catch (error) {
    return sendFailure(res, error, "Unable to load project comments.");
  }
}

async function deleteDraft(req, res) {
  const draftId = normalizedString(req.params.draftId);
  const reference = adminDb.collection(DRAFTS).doc(draftId);
  try {
    if (!draftId) throw httpError(400, "Draft ID is required.");
    const storagePath = await adminDb.runTransaction(async transaction => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw httpError(404, "Floor-plan draft does not exist.");
      const draft = snapshot.data();
      if (draft.createdBy !== req.adminUser.uid) {
        throw httpError(403, "Only the administrator who created this draft may delete it.");
      }
      if (draft.publishedProjectId) {
        throw httpError(409, "A published floor plan cannot be deleted as a draft.");
      }
      const path = normalizedString(draft.draftJsonPath);
      const expectedPrefix = `adminManagedFloorPlanDrafts/${req.adminUser.uid}/${draftId}/`;
      if (path && !path.startsWith(expectedPrefix)) {
        throw httpError(409, "Draft storage path does not match the draft owner.");
      }
      transaction.set(reference, {
        deleting: true,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return path;
    });
    if (storagePath) await deleteStorageObject(storagePath);
    await adminDb.runTransaction(async transaction => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return;
      const draft = snapshot.data();
      const reservationReference = assignmentReference(
        normalizedString(draft.intendedClientId),
      );
      const reservationSnapshot = await transaction.get(reservationReference);
      if (draft.createdBy !== req.adminUser.uid || draft.publishedProjectId || draft.deleting !== true) {
        throw httpError(409, "Draft status changed while deleting.");
      }
      transaction.delete(reference);
      if (
        reservationSnapshot.exists &&
        reservationSnapshot.data().status === "draft" &&
        reservationSnapshot.data().draftId === draftId
      ) {
        transaction.delete(reservationReference);
      }
    });
    return res.json({ success: true });
  } catch (error) {
    return sendFailure(res, error, "Unable to delete floor-plan draft.");
  }
}

router.get("/admin/floor-plan-clients", requireRole("admin", "superadmin"), searchClients);
router.get("/admin/projects", requireRole("admin", "superadmin"), (req, res) => getAdminProjects(req, res, false));
router.get("/admin/floor-plans", requireRole("admin", "superadmin"), (req, res) => getAdminProjects(req, res, true));
router.get("/admin/projects/:projectId", requireRole("admin", "superadmin"), getProject);
router.get("/admin/users/:accountId/projects", requireRole("admin", "superadmin"), getAdminAccountProjects);
router.post("/admin/floor-plan-drafts", requireRole("admin", "superadmin"), createDraft);
router.get("/admin/floor-plan-drafts/:draftId", requireRole("admin", "superadmin"), getDraft);
router.put("/admin/floor-plan-drafts/:draftId", requireRole("admin", "superadmin"), saveDraft);
router.post("/admin/floor-plan-drafts/:draftId/publish", requireRole("admin", "superadmin"), publishDraft);
router.delete("/admin/floor-plan-drafts/:draftId", requireRole("admin", "superadmin"), deleteDraft);
router.put("/admin/projects/:projectId/structure", requireRole("admin", "superadmin"), saveProjectStructure);
router.get("/admin/projects/:projectId/files/:kind", requireRole("admin", "superadmin"), getAdminManagedProjectFile);
router.get("/admin/projects/:projectId/files/:kind/:fileId", requireRole("admin", "superadmin"), getAdminManagedProjectFile);
router.put("/projects/:projectId/managed-interior", authenticateClient, saveClientInterior);
router.get("/projects/:projectId/workflow", authenticateClient, getClientProjectWorkflow);
router.get("/projects/public", setPublicNoCacheHeaders, authenticateClient, listPublicProjects);
router.get("/projects/public/:publicId/thumbnail", setPublicNoCacheHeaders, authenticateClient, getPublicProjectThumbnail);
router.get("/projects/public/:publicId", setPublicNoCacheHeaders, authenticateClient, getPublicProjectPreview);
router.get("/projects/:projectId/files/:kind", authenticateClient, getClientManagedProjectFile);
router.get("/projects/:projectId/files/:kind/:fileId", authenticateClient, getClientManagedProjectFile);
router.post("/projects/:projectId/access-acknowledgement", authenticateClient, acknowledgeProjectAccess);
router.post("/projects/:projectId/submission-agreement", authenticateClient, acknowledgeSubmissionAgreement);
router.post("/projects/:projectId/submit", authenticateClient, submitClientProject);
router.post("/admin/projects/:projectId/review", requireRole("admin", "superadmin"), reviewSubmittedProject);
router.patch("/admin/projects/:projectId/public-visibility", requireRole("admin", "superadmin"), updateProjectPublicVisibility);
router.get("/admin/projects/:projectId/activity", requireRole("admin", "superadmin"), getProjectActivity);
router.get("/projects/:projectId/activity", authenticateClient, getClientProjectActivity);
router.get("/projects/:projectId/comments", authenticateClient, getClientProjectComments);

export default router;
