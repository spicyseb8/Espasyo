import { randomUUID } from "node:crypto";
import express from "express";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
  adminStorage,
} from "../firebase-admin.js";
import { requireRole } from "./authorization.js";

const router = express.Router();
const PROJECTS = "projects";
const USERS = "users";
const EMPLOYEES = "adminEmployees";
const ASSIGNMENTS = "adminManagedProjectAssignments";
const DRAFTS = "adminManagedFloorPlanDrafts";
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
  const serialized = JSON.stringify(value);
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

function storageDownloadUrl(path, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${adminStorage.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

async function uploadJson(path, json) {
  const token = randomUUID();
  await adminStorage.file(path).save(Buffer.from(json, "utf8"), {
    resumable: false,
    metadata: {
      contentType: "application/json",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  return storageDownloadUrl(path, token);
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

async function findClientAccount(ownerId) {
  const [usersSnapshot, employeeSnapshot] = await Promise.all([
    adminDb.collection(USERS).where("uid", "==", ownerId).limit(1).get(),
    adminDb.collection(EMPLOYEES).where("uid", "==", ownerId).limit(1).get(),
  ]);
  const userDocument = usersSnapshot.docs[0];
  if (!userDocument || employeeSnapshot.docs.length > 0) return null;
  const user = userDocument.data();
  if (user.account_status !== "active" || ["admin", "superadmin"].includes(user.role)) {
    return null;
  }
  return { document: userDocument, data: user };
}

async function hasExistingProjectOrAssignment(ownerId) {
  const [projectsSnapshot, assignmentSnapshot] = await Promise.all([
    adminDb.collection(PROJECTS).where("ownerId", "==", ownerId).limit(1).get(),
    assignmentReference(ownerId).get(),
  ]);
  return projectsSnapshot.size > 0 || assignmentSnapshot.exists;
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
    const account = await findClientAccount(token.uid);
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
    const ownerId = normalizedString(req.body?.ownerId);
    const projectName = validateName(req.body?.projectName);
    if (!ownerId) throw httpError(400, "A client account is required.");
    if (!(await findClientAccount(ownerId))) {
      throw httpError(409, "This client account is not eligible for a floor plan.");
    }
    if (await hasExistingProjectOrAssignment(ownerId)) {
      throw httpError(409, OWNER_PROJECT_CONFLICT);
    }

    const draftId = randomUUID();
    const reference = adminDb.collection(DRAFTS).doc(draftId);
    const record = {
      draftId,
      projectName,
      intendedClientId: ownerId,
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
    await reference.create(record);
    return res.status(201).json({ success: true, draft: { ...record, draftId } });
  } catch (error) {
    return sendFailure(res, error, "Unable to create the floor-plan draft.");
  }
}

async function searchClients(req, res) {
  try {
    const search = normalizedString(req.query.search).toLocaleLowerCase();
    const [usersSnapshot, projectsSnapshot, assignmentSnapshot, employeesSnapshot] = await Promise.all([
      adminDb.collection(USERS).get(),
      adminDb.collection(PROJECTS).get(),
      adminDb.collection(ASSIGNMENTS).get(),
      adminDb.collection(EMPLOYEES).get(),
    ]);

    const projectOwners = new Set(
      projectsSnapshot.docs
        .map(document => document.data().ownerId)
        .filter(value => typeof value === "string")
    );
    const assignedOwners = new Set(
      assignmentSnapshot.docs
        .map(document => document.data().ownerId)
        .filter(value => typeof value === "string")
    );
    const employeeUids = new Set(
      employeesSnapshot.docs
        .map(document => document.data().uid)
        .filter(value => typeof value === "string")
    );
    const clients = [];
    let hasIneligibleMatches = false;

    for (const document of usersSnapshot.docs) {
      const data = document.data();
      const uid = normalizedString(data.uid) || document.id;
      const name = normalizedString(data.full_name) || normalizedString(data.name) || "Unknown User";
      const email = normalizedString(data.email);
      if (search && !`${name} ${email}`.toLocaleLowerCase().includes(search)) continue;

      const isEligible = data.account_status === "active"
        && !["admin", "superadmin"].includes(data.role)
        && !employeeUids.has(uid)
        && !projectOwners.has(uid)
        && !assignedOwners.has(uid);
      if (!isEligible) {
        hasIneligibleMatches = true;
        continue;
      }
      clients.push({ id: document.id, uid, name, email: email || undefined });
    }

    clients.sort((first, second) => first.name.localeCompare(second.name));
    return res.json({
      success: true,
      clients: clients.slice(0, 50),
      hasIneligibleMatches,
    });
  } catch (error) {
    return sendFailure(res, error, "Unable to search eligible client accounts.");
  }
}

function mapProject(document, ownerNames, creatorNames, assignmentByOwner, ownerEmails = new Map()) {
  const data = document.data();
  const projectId = typeof data.projectId === "string" ? data.projectId : document.id;
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
    jsonPath: typeof data.jsonPath === "string" ? data.jsonPath : "",
    jsonUrl: typeof data.jsonUrl === "string" ? data.jsonUrl : "",
    draftJsonPath: typeof data.draftJsonPath === "string" ? data.draftJsonPath : undefined,
    draftJsonUrl: typeof data.draftJsonUrl === "string" ? data.draftJsonUrl : undefined,
    interiorJsonPath: typeof data.interiorJsonPath === "string" ? data.interiorJsonPath : undefined,
    interiorJsonUrl: typeof data.interiorJsonUrl === "string" ? data.interiorJsonUrl : undefined,
    clientDesignStarted: typeof data.clientDesignStarted === "boolean" ? data.clientDesignStarted : undefined,
    clientDesignStartedAt: timestampToIso(data.clientDesignStartedAt),
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
          jsonPath: "",
          jsonUrl: "",
          draftJsonPath: typeof draft.draftJsonPath === "string" ? draft.draftJsonPath : undefined,
          draftJsonUrl: typeof draft.draftJsonUrl === "string" ? draft.draftJsonUrl : undefined,
          schemaVersion: 1,
          createdAt: timestampToIso(draft.createdAt),
          updatedAt: timestampToIso(draft.updatedAt),
          deadline: null,
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
    const projectData = draft.draftJsonPath ? await loadJson(draft.draftJsonPath) : null;
    const clientAccount = await findClientAccount(draft.intendedClientId);
    const clientData = clientAccount?.data;
    return res.json({
      success: true,
      draft: {
        draftId,
        ...draft,
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
    const revision = Number(req.body?.revision);
    if (!Number.isSafeInteger(revision) || revision < 1) {
      throw httpError(400, "A positive floor-plan revision is required.");
    }
    const ownerId = normalizedString(draft.intendedClientId);
    const projectData = req.body?.projectData;
    const json = validateStructure(projectData, draftId, ownerId, projectName);
    const storagePath = `adminManagedFloorPlanDrafts/${req.adminUser.uid}/${draftId}/draft-r${revision}-${randomUUID()}.json`;
    uploadedPath = storagePath;
    const jsonUrl = await uploadJson(storagePath, json);

    await adminDb.runTransaction(async transaction => {
      const currentSnapshot = await transaction.get(reference);
      if (!currentSnapshot.exists) throw httpError(404, "Floor-plan draft was removed during save.");
      const current = currentSnapshot.data();
      if (current.createdBy !== req.adminUser.uid || current.publishedProjectId) {
        throw httpError(403, "Draft ownership or status changed during save.");
      }
      transaction.set(reference, {
        projectName,
        structuralRevision: revision,
        structureInitialized: true,
        draftJsonPath: storagePath,
        draftJsonUrl: jsonUrl,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    return res.json({ success: true, draftId, revision, draftJsonPath: storagePath, draftJsonUrl: jsonUrl });
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
    const jsonUrl = await uploadJson(uploadedPath, finalJson);
    const destinationReference = adminDb.collection(PROJECTS).doc(reservedId);
    const lockReference = assignmentReference(ownerId);
    const ownerProjectsQuery = adminDb.collection(PROJECTS).where("ownerId", "==", ownerId);

    const result = await adminDb.runTransaction(async transaction => {
      const [currentDraftSnapshot, assignmentSnapshot, ownerProjectsSnapshot, destinationSnapshot] =
        await Promise.all([
          transaction.get(reference),
          transaction.get(lockReference),
          transaction.get(ownerProjectsQuery),
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
      if (currentDraft.projectName !== initial.projectName) {
        throw httpError(409, "The draft name changed while publishing. Reload and try again.");
      }
      if (assignmentSnapshot.exists || ownerProjectsSnapshot.size > 0) {
        throw httpError(409, OWNER_PROJECT_CONFLICT);
      }
      if (destinationSnapshot.exists) {
        throw httpError(409, "The generated project ID is already in use.");
      }
      const projectRecord = {
        projectId: reservedId,
        projectName,
        ownerId,
        schemaVersion: 1,
        workflowType: "admin-managed",
        structuralOwner: "admin",
        structuralStatus: "published",
        structuralRevision: revision,
        publishedStructuralRevision: revision,
        clientDesignStarted: false,
        structureInitialized: true,
        jsonPath: uploadedPath,
        jsonUrl,
        createdBy: req.adminUser.uid,
        creatorName: req.adminUser.name,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      transaction.create(lockReference, {
        ownerId,
        projectId: reservedId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(destinationReference, projectRecord);
      transaction.set(reference, {
        projectName,
        publishedProjectId: reservedId,
        publishedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
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
    const jsonUrl = await uploadJson(storagePath, json);
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
        current.draftJsonPath !== existing.draftJsonPath ||
        current.jsonUrl !== existing.jsonUrl
      ) {
        throw httpError(409, "The project changed during save. Reload before trying again.");
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
        structuralRevision: published ? revision : wasPublished ? current.structuralRevision : revision,
        structureInitialized: true,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (published) {
        Object.assign(metadata, {
          jsonPath: storagePath,
          jsonUrl,
          publishedStructuralRevision: revision,
          clientDesignStarted: typeof current.clientDesignStarted === "boolean"
            ? current.clientDesignStarted
            : false,
        });
      } else {
        Object.assign(metadata, {
          draftJsonPath: storagePath,
          draftJsonUrl: jsonUrl,
        });
      }
      transaction.set(reference, metadata, { merge: true });
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

async function saveClientInterior(req, res) {
  const projectId = normalizedString(req.params.projectId);
  const ownerId = req.clientUser.uid;
  const reference = adminDb.collection(PROJECTS).doc(projectId);
  const lockReference = assignmentReference(ownerId);
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
    const serialized = JSON.stringify(interiorData);
    if (Buffer.byteLength(serialized, "utf8") > MAX_STRUCTURE_BYTES) {
      throw httpError(413, "Interior design data exceeds the 10 MB limit.");
    }
    const estimatedCost = Number(req.body?.estimatedCost);
    if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
      throw httpError(400, "Estimated cost must be a non-negative number.");
    }
    const hasChanges = hasMeaningfulInteriorData(interiorData);
    const storagePath = `projects/${ownerId}/${projectId}.interior.json`;
    uploadedPath = storagePath;
    const jsonUrl = await uploadJson(storagePath, serialized);
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
      if (
        current.ownerId !== ownerId ||
        current.workflowType !== "admin-managed" ||
        current.structuralStatus !== "published" ||
        !Number.isSafeInteger(current.publishedStructuralRevision) ||
        !assignmentSnapshot.exists ||
        assignmentSnapshot.data().ownerId !== ownerId ||
        assignmentSnapshot.data().projectId !== projectId
      ) {
        throw httpError(403, "This published project is not assigned to the signed-in client.");
      }
      const update = {
        projectId,
        ownerId,
        schemaVersion: 1,
        estimatedCost,
        interiorJsonPath: storagePath,
        interiorJsonUrl: jsonUrl,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (hasChanges) {
        update.clientDesignStarted = true;
        if (!current.clientDesignStartedAt) {
          update.clientDesignStartedAt = FieldValue.serverTimestamp();
        }
      }
      if (thumbnailPath && thumbnailUrl) {
        update.thumbnailPath = thumbnailPath;
        update.thumbnailUrl = thumbnailUrl;
      }
      transaction.set(reference, update, { merge: true });
    });
    return res.json({ success: true, interiorJsonPath: storagePath, interiorJsonUrl: jsonUrl });
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

router.get("/admin/floor-plan-clients", requireRole("admin", "superadmin"), searchClients);
router.get("/admin/projects", requireRole("admin", "superadmin"), (req, res) => getAdminProjects(req, res, false));
router.get("/admin/floor-plans", requireRole("admin", "superadmin"), (req, res) => getAdminProjects(req, res, true));
router.get("/admin/projects/:projectId", requireRole("admin", "superadmin"), getProject);
router.get("/admin/users/:accountId/projects", requireRole("admin", "superadmin"), getAdminAccountProjects);
router.post("/admin/floor-plan-drafts", requireRole("admin", "superadmin"), createDraft);
router.get("/admin/floor-plan-drafts/:draftId", requireRole("admin", "superadmin"), getDraft);
router.put("/admin/floor-plan-drafts/:draftId", requireRole("admin", "superadmin"), saveDraft);
router.post("/admin/floor-plan-drafts/:draftId/publish", requireRole("admin", "superadmin"), publishDraft);
router.put("/admin/projects/:projectId/structure", requireRole("admin", "superadmin"), saveProjectStructure);
router.put("/projects/:projectId/managed-interior", authenticateClient, saveClientInterior);

export default router;
