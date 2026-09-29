import {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    onAuthStateChanged
} from "firebase/auth";

import {
    useNavigate
} from "react-router-dom";

import {
    auth
} from "@/firebase/firebase";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";

import {
    Input
} from "@/components/ui/input";

import {
    Badge
} from "@/components/ui/badge";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";

import {
    Search,
    FolderOpen,
    User,
    ArrowUpDown
} from "lucide-react";

import {
    getAdminProjects,
    type AdminProject
} from "../../../services/assets/projectService";

import ProjectDetailsModal
    from "./ProjectDetailsModal";


//==================================================
// SORT
//==================================================

type SortOption =
    | "updated-desc"
    | "updated-asc"
    | "created-desc"
    | "created-asc"
    | "name-asc"
    | "name-desc"
    | "owner-asc"
    | "owner-desc";


const SORT_OPTIONS: {
    value:
        SortOption;

    label:
        string;
}[] = [

    {
        value:
            "updated-desc",

        label:
            "Last updated (newest)"
    },

    {
        value:
            "updated-asc",

        label:
            "Last updated (oldest)"
    },

    {
        value:
            "created-desc",

        label:
            "Date created (newest)"
    },

    {
        value:
            "created-asc",

        label:
            "Date created (oldest)"
    },

    {
        value:
            "name-asc",

        label:
            "Project name (A–Z)"
    },

    {
        value:
            "name-desc",

        label:
            "Project name (Z–A)"
    },

    {
        value:
            "owner-asc",

        label:
            "Owner (A–Z)"
    },

    {
        value:
            "owner-desc",

        label:
            "Owner (Z–A)"
    }

];


//==================================================
// DATE
//==================================================

export function formatProjectDate(
    value:
        unknown
): string {

    if (!value) {

        return "Unknown";

    }


    if (
        typeof value === "object" &&
        value !== null &&
        "toDate" in value &&
        typeof (
            value as {
                toDate:
                    unknown;
            }
        ).toDate === "function"
    ) {

        return (
            value as {
                toDate:
                    () => Date;
            }
        ).toDate().toLocaleDateString(
            undefined,
            {
                year:
                    "numeric",

                month:
                    "long",

                day:
                    "numeric"
            }
        );

    }


    if (
        value instanceof Date
    ) {

        return value.toLocaleDateString(
            undefined,
            {
                year:
                    "numeric",

                month:
                    "long",

                day:
                    "numeric"
            }
        );

    }


    if (
        typeof value === "string"
    ) {

        const date =
            new Date(
                value
            );


        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {

            return date.toLocaleDateString(
                undefined,
                {
                    year:
                        "numeric",

                    month:
                        "long",

                    day:
                        "numeric"
                }
            );

        }

    }


    return "Unknown";

}


//==================================================
// PROJECT TIME
//==================================================

function getProjectTime(
    value:
        unknown
): number {

    if (!value) {

        return 0;

    }


    if (
        typeof value === "object" &&
        value !== null &&
        "toMillis" in value &&
        typeof (
            value as {
                toMillis:
                    unknown;
            }
        ).toMillis === "function"
    ) {

        return (
            value as {
                toMillis:
                    () => number;
            }
        ).toMillis();

    }


    if (
        value instanceof Date
    ) {

        return value.getTime();

    }


    if (
        typeof value === "string"
    ) {

        const date =
            new Date(
                value
            );


        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {

            return date.getTime();

        }

    }


    return 0;

}


//==================================================
// COST
//==================================================

export function formatCost(
    project:
        AdminProject
): string {

    const cost =
        project.totalCost ??
        project.estimatedCost;


    if (
        typeof cost !== "number" ||
        !Number.isFinite(
            cost
        )
    ) {

        return "Not available";

    }


    return new Intl.NumberFormat(
        "en-PH",
        {
            style:
                "currency",

            currency:
                "PHP",

            maximumFractionDigits:
                2
        }
    ).format(
        cost
    );

}


//==================================================
// PROJECT MANAGEMENT
//==================================================

export default function ProjectManagement() {

    const navigate =
        useNavigate();


    const [
        projects,
        setProjects
    ] = useState<
        AdminProject[]
    >([]);


    const [
        loading,
        setLoading
    ] = useState(
        true
    );


    const [
        error,
        setError
    ] = useState(
        ""
    );


    const [
        search,
        setSearch
    ] = useState(
        ""
    );


    const [
        sortOption,
        setSortOption
    ] = useState<
        SortOption
    >(
        "updated-desc"
    );


    const [
        selectedProject,
        setSelectedProject
    ] = useState<
        AdminProject | null
    >(
        null
    );


    //==================================================
    // LOAD ALL PROJECTS
    //==================================================

    useEffect(() => {

        let cancelled =
            false;


        const unsubscribe =
            onAuthStateChanged(
                auth,
                async user => {

                    if (
                        !user
                    ) {

                        if (
                            !cancelled
                        ) {

                            setProjects(
                                []
                            );

                            setError(
                                "Please log in to view projects."
                            );

                            setLoading(
                                false
                            );

                        }

                        return;

                    }


                    try {

                        if (
                            !cancelled
                        ) {

                            setLoading(
                                true
                            );

                            setError("");

                        }


                        //--------------------------------------------------
                        // ADMIN PROJECT LIST
                        //--------------------------------------------------
                        //
                        // This returns ALL projects.
                        //
                        //--------------------------------------------------

                        const loadedProjects =
                            await getAdminProjects();


                        if (
                            !cancelled
                        ) {

                            setProjects(
                                loadedProjects
                            );

                        }

                    } catch (
                        loadError
                    ) {

                        console.error(
                            "Failed to load projects:",
                            loadError
                        );


                        if (
                            !cancelled
                        ) {

                            const firebaseError =
                                loadError as {
                                    code?:
                                        string;
                                };


                            setError(

                                firebaseError.code

                                    ? `Failed to load projects: ${firebaseError.code}`

                                    : "Failed to load projects."

                            );

                        }

                    } finally {

                        if (
                            !cancelled
                        ) {

                            setLoading(
                                false
                            );

                        }

                    }

                }
            );


        return () => {

            cancelled =
                true;

            unsubscribe();

        };

    }, []);


    //==================================================
    // FILTER + SORT
    //==================================================

    const filteredProjects =
        useMemo(() => {

            const value =
                search
                    .trim()
                    .toLowerCase();


            const base =
                !value

                    ? projects

                    : projects.filter(
                        project =>

                            project.projectName
                                .toLowerCase()
                                .includes(
                                    value
                                ) ||

                            (
                                project.ownerName ??
                                ""
                            )
                                .toLowerCase()
                                .includes(
                                    value
                                ) ||

                            project.ownerId
                                .toLowerCase()
                                .includes(
                                    value
                                ) ||

                            project.projectId
                                .toLowerCase()
                                .includes(
                                    value
                                )
                    );


            const sorted =
                [
                    ...base
                ];


            switch (
                sortOption
            ) {

                case "updated-desc":

                    sorted.sort(
                        (
                            a,
                            b
                        ) =>
                            getProjectTime(
                                b.updatedAt
                            ) -
                            getProjectTime(
                                a.updatedAt
                            )
                    );

                    break;


                case "updated-asc":

                    sorted.sort(
                        (
                            a,
                            b
                        ) =>
                            getProjectTime(
                                a.updatedAt
                            ) -
                            getProjectTime(
                                b.updatedAt
                            )
                    );

                    break;


                case "created-desc":

                    sorted.sort(
                        (
                            a,
                            b
                        ) =>
                            getProjectTime(
                                b.createdAt
                            ) -
                            getProjectTime(
                                a.createdAt
                            )
                    );

                    break;


                case "created-asc":

                    sorted.sort(
                        (
                            a,
                            b
                        ) =>
                            getProjectTime(
                                a.createdAt
                            ) -
                            getProjectTime(
                                b.createdAt
                            )
                    );

                    break;


                case "name-asc":

                    sorted.sort(
                        (
                            a,
                            b
                        ) =>
                            a.projectName.localeCompare(
                                b.projectName
                            )
                    );

                    break;


                case "name-desc":

                    sorted.sort(
                        (
                            a,
                            b
                        ) =>
                            b.projectName.localeCompare(
                                a.projectName
                            )
                    );

                    break;


                case "owner-asc":

                    sorted.sort(
                        (
                            a,
                            b
                        ) =>
                            (
                                a.ownerName ??
                                ""
                            ).localeCompare(
                                b.ownerName ??
                                ""
                            )
                    );

                    break;


                case "owner-desc":

                    sorted.sort(
                        (
                            a,
                            b
                        ) =>
                            (
                                b.ownerName ??
                                ""
                            ).localeCompare(
                                a.ownerName ??
                                ""
                            )
                    );

                    break;

            }


            return sorted;

        }, [
            projects,
            search,
            sortOption
        ]);


    //==================================================
    // OPEN PROJECT
    //==================================================
    //
    // IMPORTANT:
    //
    // This opens the ADMIN view-only loader.
    //
    // It does NOT open:
    // /studio/load/:projectId
    //
    //==================================================

    function handleOpenProject(
        project:
            AdminProject
    ) {

        setSelectedProject(
            null
        );


        navigate(
            `/projects/view/${project.projectId}`
        );

    }


    //==================================================
    // RENDER
    //==================================================

    return (

        <div className="w-full">

            <Card className="border-border/60 shadow-none">

                <CardHeader className="border-b border-border/60">

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                        <div>

                            <CardTitle className="text-base">
                                User Projects
                            </CardTitle>

                            <CardDescription>
                                Select a project to view its details.
                            </CardDescription>

                        </div>


                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

                            <div className="relative w-full sm:w-64">

                                <Search
                                    size={16}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                />

                                <Input

                                    value={
                                        search
                                    }

                                    onChange={
                                        event =>
                                            setSearch(
                                                event.target.value
                                            )
                                    }

                                    placeholder="Search projects..."

                                    className="border-border/60 pl-9"

                                />

                            </div>


                            <Select

                                value={
                                    sortOption
                                }

                                onValueChange={
                                    value =>
                                        setSortOption(
                                            value as SortOption
                                        )
                                }

                            >

                                <SelectTrigger className="w-full border-border/60 sm:w-56">

                                    <div className="flex items-center gap-2">

                                        <ArrowUpDown
                                            size={14}
                                            className="text-muted-foreground"
                                        />

                                        <SelectValue
                                            placeholder="Sort by"
                                        />

                                    </div>

                                </SelectTrigger>


                                <SelectContent>

                                    {
                                        SORT_OPTIONS.map(
                                            option => (

                                                <SelectItem

                                                    key={
                                                        option.value
                                                    }

                                                    value={
                                                        option.value
                                                    }

                                                >

                                                    {
                                                        option.label
                                                    }

                                                </SelectItem>

                                            )
                                        )
                                    }

                                </SelectContent>

                            </Select>

                        </div>

                    </div>

                </CardHeader>


                <CardContent className="p-0">

                    {/*==================================================
                        LOADING
                    ==================================================*/}

                    {
                        loading && (

                            <div className="flex min-h-64 items-center justify-center">

                                <p className="text-sm text-muted-foreground">
                                    Loading projects...
                                </p>

                            </div>

                        )
                    }


                    {/*==================================================
                        ERROR
                    ==================================================*/}

                    {
                        !loading &&
                        error && (

                            <div className="flex min-h-64 items-center justify-center p-6">

                                <div className="text-center">

                                    <p className="text-sm font-medium">
                                        Unable to load projects
                                    </p>

                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {
                                            error
                                        }
                                    </p>

                                </div>

                            </div>

                        )
                    }


                    {/*==================================================
                        EMPTY
                    ==================================================*/}

                    {
                        !loading &&
                        !error &&
                        filteredProjects.length === 0 && (

                            <div className="flex min-h-64 flex-col items-center justify-center gap-3">

                                <div className="rounded-full bg-muted p-3">

                                    <FolderOpen
                                        size={24}
                                        className="text-muted-foreground"
                                    />

                                </div>


                                <div className="text-center">

                                    <p className="text-sm font-medium">
                                        No projects found
                                    </p>

                                    <p className="mt-1 text-xs text-muted-foreground">

                                        {
                                            search

                                                ? "Try a different search."

                                                : "There are no saved projects yet."

                                        }

                                    </p>

                                </div>

                            </div>

                        )
                    }


                    {/*==================================================
                        TABLE
                    ==================================================*/}

                    {
                        !loading &&
                        !error &&
                        filteredProjects.length > 0 && (

                            <div className="overflow-x-auto">

                                <Table>

                                    <TableHeader>

                                        <TableRow className="border-border/60 hover:bg-transparent">

                                            <TableHead>
                                                Project
                                            </TableHead>

                                            <TableHead>
                                                Owner
                                            </TableHead>

                                            <TableHead>
                                                Created
                                            </TableHead>

                                            <TableHead>
                                                Last Updated
                                            </TableHead>

                                            <TableHead>
                                                Estimated Cost
                                            </TableHead>

                                            <TableHead>
                                                Status
                                            </TableHead>

                                        </TableRow>

                                    </TableHeader>


                                    <TableBody>

                                        {
                                            filteredProjects.map(
                                                project => (

                                                    <TableRow

                                                        key={
                                                            project.projectId
                                                        }

                                                        className="cursor-pointer border-border/60 hover:bg-muted/30"

                                                        onClick={() =>
                                                            setSelectedProject(
                                                                project
                                                            )
                                                        }

                                                    >

                                                        <TableCell>

                                                            <div className="flex items-center gap-3">

                                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40">

                                                                    <FolderOpen
                                                                        size={17}
                                                                        className="text-muted-foreground"
                                                                    />

                                                                </div>


                                                                <div className="min-w-0">

                                                                    <p className="truncate font-medium">

                                                                        {
                                                                            project.projectName
                                                                        }

                                                                    </p>


                                                                    <p className="truncate text-xs text-muted-foreground">

                                                                        ID:
                                                                        {" "}
                                                                        {
                                                                            project.projectId
                                                                        }

                                                                    </p>

                                                                </div>

                                                            </div>

                                                        </TableCell>


                                                        <TableCell>

                                                            <div className="flex items-center gap-2">

                                                                <User
                                                                    size={14}
                                                                    className="text-muted-foreground"
                                                                />

                                                                <span className="max-w-40 truncate text-sm">

                                                                    {
                                                                        project.ownerName ||
                                                                        "Unknown User"
                                                                    }

                                                                </span>

                                                            </div>

                                                        </TableCell>


                                                        <TableCell>

                                                            <span className="text-sm text-muted-foreground">

                                                                {
                                                                    formatProjectDate(
                                                                        project.createdAt
                                                                    )
                                                                }

                                                            </span>

                                                        </TableCell>


                                                        <TableCell>

                                                            <span className="text-sm text-muted-foreground">

                                                                {
                                                                    formatProjectDate(
                                                                        project.updatedAt
                                                                    )
                                                                }

                                                            </span>

                                                        </TableCell>


                                                        <TableCell>

                                                            <span className="text-sm font-medium">

                                                                {
                                                                    formatCost(
                                                                        project
                                                                    )
                                                                }

                                                            </span>

                                                        </TableCell>


                                                        <TableCell>

                                                            <Badge
                                                                variant="outline"
                                                            >
                                                                Saved
                                                            </Badge>

                                                        </TableCell>

                                                    </TableRow>

                                                )
                                            )
                                        }

                                    </TableBody>

                                </Table>

                            </div>

                        )
                    }

                </CardContent>

            </Card>


            {/*==================================================
                PROJECT DETAILS MODAL
            ==================================================*/}

            <ProjectDetailsModal

                project={
                    selectedProject
                }

                onOpenChange={
                    open => {

                        if (
                            !open
                        ) {

                            setSelectedProject(
                                null
                            );

                        }

                    }
                }

                onOpenProject={
                    handleOpenProject
                }

            />

        </div>

    );

}