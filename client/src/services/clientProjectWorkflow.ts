import { projectApi } from "./projectApi";

export const ACCESS_AGREEMENT_VERSION = "2026-01";
export const SUBMISSION_AGREEMENT_VERSION = "2026-01";

export interface ClientProjectWorkflow {
    projectId: string;
    projectName: string;
    projectStatus: "available" | "ongoing" | "submitted" | "revision-requested" | "approved";
    deadline: string | null;
    currentDesignVersionId: string | null;
    currentDesignVersionNumber: number | null;
    clientDesignStarted: boolean;
    submittedVersionId: string | null;
    submittedVersionNumber: number | null;
    submittedAt: string | null;
    revisionFeedback: string | null;
    revisionRequestedAt: string | null;
    approvedAt: string | null;
    accessAcknowledged: boolean;
    submissionAgreementAcknowledged: boolean;
}

export interface ProjectActivity {
    id: string;
    action: string;
    actorRole: string;
    actorId: string;
    actorName?: string;
    description?: string;
    versionId?: string;
    createdAt: unknown;
    previousValue?: unknown;
    newValue?: unknown;
}

export async function getClientProjectWorkflow(projectId: string): Promise<ClientProjectWorkflow> {
    const result = await projectApi<{ workflow: ClientProjectWorkflow }>(
        `/projects/${encodeURIComponent(projectId)}/workflow`
    );
    return result.workflow;
}

export async function getClientManagedProjectFile<T = Record<string, unknown>>(
    projectId: string,
    kind: "structure" | "interior" | "version" | "submission" | "submitted" | "approved",
    fileId?: string,
    init: RequestInit = {}
): Promise<T> {
    const suffix = fileId ? `/${encodeURIComponent(fileId)}` : "";
    return projectApi<T>(
        `/projects/${encodeURIComponent(projectId)}/files/${kind}${suffix}`,
        init
    );
}

export async function acknowledgeProjectAccess(projectId: string): Promise<void> {
    await projectApi(`/projects/${encodeURIComponent(projectId)}/access-acknowledgement`, {
        method: "POST",
        body: JSON.stringify({ agreementVersion: ACCESS_AGREEMENT_VERSION })
    });
}

export async function acknowledgeSubmissionAgreement(projectId: string): Promise<void> {
    await projectApi(`/projects/${encodeURIComponent(projectId)}/submission-agreement`, {
        method: "POST",
        body: JSON.stringify({
            agreementVersion: SUBMISSION_AGREEMENT_VERSION,
            accepted: true
        })
    });
}

export async function submitClientProject(
    projectId: string,
    publicConsent: boolean
): Promise<{
    submissionId: string;
    versionId: string;
    versionNumber: number;
}> {
    return projectApi<{
        submissionId: string;
        versionId: string;
        versionNumber: number;
    }>(`/projects/${encodeURIComponent(projectId)}/submit`, {
        method: "POST",
        body: JSON.stringify({ publicConsent })
    });
}

export async function getClientProjectActivity(projectId: string): Promise<ProjectActivity[]> {
    const result = await projectApi<{ activities: ProjectActivity[] }>(
        `/projects/${encodeURIComponent(projectId)}/activity`
    );
    return result.activities;
}
