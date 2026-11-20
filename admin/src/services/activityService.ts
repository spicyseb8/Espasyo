import { projectApi } from "@/services/assets/projectApi";

export interface ActivityRecord {
  id: string;
  action: string;
  activityType?: string;
  actorId?: string;
  actorUid?: string;
  actorRole?: string;
  actorName?: string;
  targetUserUid?: string;
  targetName?: string;
  projectId?: string | null;
  projectName?: string;
  description?: string;
  createdAt: string | null;
}

export interface ActivityPage {
  items: ActivityRecord[];
  hasMore: boolean;
  nextCursor: string | null;
}

export async function getAdminActivityPage(options: {
  userUid?: string;
  cursor?: string | null;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<ActivityPage> {
  const search = new URLSearchParams();
  if (options.cursor) search.set("cursor", options.cursor);
  if (options.from) search.set("from", options.from);
  if (options.to) search.set("to", options.to);
  if (options.limit) search.set("limit", String(options.limit));
  const suffix = search.size ? `?${search.toString()}` : "";
  const path = options.userUid
    ? `/admin/users/${encodeURIComponent(options.userUid)}/activity${suffix}`
    : `/admin/activity${suffix}`;
  const response = await projectApi<ActivityPage & { success: boolean }>(path);
  return {
    items: response.items,
    hasMore: response.hasMore,
    nextCursor: response.nextCursor,
  };
}
