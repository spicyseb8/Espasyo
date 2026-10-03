import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

import {
  FolderKanban,
  CalendarDays,
  Clock3,
  Loader2,
  FolderOpen,
  Eye,
} from "lucide-react";

import { db, auth } from "@/firebase/firebase";

import {
  Card,
  CardContent,
} from "@/components/ui/card";


//==================================================
// PROJECT TYPE
//==================================================

interface UserProject {
  projectId: string;
  projectName: string;
  ownerId: string;
  jsonPath: string;
  jsonUrl: string;
  schemaVersion: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}


//==================================================
// PROPS
//==================================================

interface ProjectsTabProps {
  ownerId: string;
}


//==================================================
// FORMAT DATE
//==================================================

function formatProjectDate(value: unknown): string {
  if (!value) return "Unknown date";

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (value instanceof Date) {
    return value.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  }

  return "Unknown date";
}


//==================================================
// GET PROJECT TIME (for sorting)
//==================================================

function getProjectTime(value: unknown): number {
  if (!value) return 0;

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (value instanceof Date) return value.getTime();

  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }

  return 0;
}


//==================================================
// PROJECTS TAB
//==================================================

export default function ProjectsTab({ ownerId }: ProjectsTabProps) {
  const navigate = useNavigate();

  //==================================================
  // STATE
  //==================================================

  const [projects, setProjects] = useState<UserProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  //==================================================
  // AUTH CHECK
  //==================================================
  //
  // Wait until Firebase Auth reports the current
  // user before deciding whether to load projects.
  //==================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setProjects([]);
        setError("Please log in to view projects.");
        setLoading(false);
      }
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  //==================================================
  // FETCH USER PROJECTS
  //==================================================

  useEffect(() => {
    //--------------------------------------------------
    // Wait for auth to be resolved
    //--------------------------------------------------
    if (!authChecked) return;

    //--------------------------------------------------
    // No owner ID
    //--------------------------------------------------
    if (!ownerId) {
      setProjects([]);
      setLoading(false);
      setError("No user was selected.");
      return;
    }

    setLoading(true);
    setError(null);

    //--------------------------------------------------
    // Query projects belonging to this user
    //--------------------------------------------------
    const projectsQuery = query(
      collection(db, "projects"),
      where("ownerId", "==", ownerId)
    );

    //--------------------------------------------------
    // Listen for project changes
    //--------------------------------------------------
    const unsubscribe = onSnapshot(
      projectsQuery,

      (snapshot) => {
        const loadedProjects: UserProject[] = [];

        snapshot.docs.forEach((projectDocument) => {
          const data = projectDocument.data();

          loadedProjects.push({
            projectId:
              typeof data.projectId === "string"
                ? data.projectId
                : projectDocument.id,

            projectName:
              typeof data.projectName === "string"
                ? data.projectName
                : "Unnamed Project",

            ownerId:
              typeof data.ownerId === "string"
                ? data.ownerId
                : ownerId,

            jsonPath:
              typeof data.jsonPath === "string"
                ? data.jsonPath
                : "",

            jsonUrl:
              typeof data.jsonUrl === "string"
                ? data.jsonUrl
                : "",

            schemaVersion:
              typeof data.schemaVersion === "number"
                ? data.schemaVersion
                : 1,

            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });

        //--------------------------------------------------
        // Newest projects first
        //--------------------------------------------------
        loadedProjects.sort(
          (first, second) =>
            getProjectTime(second.updatedAt) -
            getProjectTime(first.updatedAt)
        );

        setProjects(loadedProjects);
        setLoading(false);
        setError(null);
      },

      //--------------------------------------------------
      // FIRESTORE ERROR
      //--------------------------------------------------
      (snapshotError) => {
        console.error(
          "Failed to load user projects:",
          snapshotError
        );

        setError(snapshotError.message);
        setProjects([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ownerId, authChecked]);

  //==================================================
  // VIEW PROJECT
  //==================================================

  function handleViewProject(project: UserProject) {
    navigate(`/projects/view/${project.projectId}`);
  }

  //==================================================
  // LOADING
  //==================================================

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading projects...
        </div>
      </div>
    );
  }

  //==================================================
  // ERROR
  //==================================================

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  //==================================================
  // NO PROJECTS
  //==================================================

  if (projects.length === 0) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-zinc-200 bg-white text-center">
        <FolderOpen className="mb-3 h-10 w-10 text-zinc-400" />
        <p className="text-sm font-medium text-zinc-900">
          No projects
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          This user has not created any projects yet.
        </p>
      </div>
    );
  }

  //==================================================
  // PROJECT LIST
  //==================================================

  return (
    <div className="space-y-4">
      {/* PROJECT COUNT */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-medium text-zinc-900">
            Projects
          </span>
        </div>

        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
          {projects.length}
        </span>
      </div>

      {/* PROJECT CARDS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <Card
            key={project.projectId}
            className="overflow-hidden border-zinc-200 bg-white text-zinc-900 shadow-none transition-shadow hover:shadow-sm"
          >
            {/* PROJECT PREVIEW */}
            <div className="flex h-36 items-center justify-center border-b border-zinc-200 bg-zinc-50">
              <FolderKanban className="h-10 w-10 text-zinc-400" />
            </div>

            {/* PROJECT INFORMATION */}
            <CardContent className="p-4">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-zinc-900">
                  {project.projectName}
                </h3>

                {/* CREATED */}
                <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Created {formatProjectDate(project.createdAt)}
                  </span>
                </div>

                {/* UPDATED */}
                <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                  <Clock3 className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Updated {formatProjectDate(project.updatedAt)}
                  </span>
                </div>

                {/* VIEW PROJECT */}
<button
  type="button"
  onClick={() => handleViewProject(project)}
  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-900 transition hover:border-zinc-300 hover:bg-zinc-50"
>
  <Eye className="h-3.5 w-3.5" />
  View Project
</button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}