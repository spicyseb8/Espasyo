import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";

import {
  collection,
  onSnapshot,
  query,
  Timestamp,
} from "firebase/firestore";

import { db } from "@/firebase/firebase";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Checkbox } from "@/components/ui/checkbox";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface User {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  created_at: string;
}

interface FirestoreUser {
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  created_at?: Timestamp | string | null;
  profile_picture?: string | null;
  role?: string | null;
}

interface UserTableProps {
  type: "customers" | "employees" | "super_admins";
}

function formatDate(
  value: Timestamp | string | null | undefined
): string {
  if (!value) {
    return "—";
  }

  try {
    if (value instanceof Timestamp) {
      return value.toDate().toLocaleDateString();
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString();
  } catch {
    return "—";
  }
}

function initials(name: string) {
  if (!name || name === "—") {
    return "?";
  }

  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getTitle(type: UserTableProps["type"]) {
  switch (type) {
    case "customers":
      return "Customers";

    case "employees":
      return "Employees";

    case "super_admins":
      return "Super Admins";
  }
}

export default function UserTable({
  type,
}: UserTableProps) {
  const navigate = useNavigate();

  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    new Set()
  );

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const rowsPerPage = 10;

  /*
   * Load the correct Firestore collection.
   *
   * customers   → users
   * employees   → adminEmployees
   * super_admins → adminEmployees
   */
  useEffect(() => {
    setLoading(true);
    setError("");
    setUsers([]);
    setSelected(new Set());
    setCurrentPage(1);

    const collectionName =
      type === "customers"
        ? "users"
        : "adminEmployees";

    const dataQuery = query(
      collection(db, collectionName)
    );

    const unsubscribe = onSnapshot(
      dataQuery,
      (snapshot) => {
        const firestoreUsers: User[] = snapshot.docs
          .filter((document) => {
            const data =
              document.data() as FirestoreUser;

            /*
             * Employees:
             * Show only role = admin.
             * Superadmin is excluded.
             */
            if (type === "employees") {
              return data.role === "admin";
            }

            /*
             * Super Admins:
             * Show only role = superadmin.
             */
            if (type === "super_admins") {
              return data.role === "superadmin";
            }

            /*
             * Customers:
             * All documents inside users.
             */
            return true;
          })
          .map((document) => {
            const data =
              document.data() as FirestoreUser;

            return {
              id: document.id,

              full_name:
                data.full_name?.trim() ||
                data.name?.trim() ||
                "Unknown User",

              email:
                data.email?.trim() || "—",

              phone_number:
                data.phone_number?.trim() || "—",

              created_at:
                formatDate(data.created_at),
            };
          });

        /*
         * Newest first.
         */
        firestoreUsers.sort((a, b) => {
          if (a.created_at === "—") return 1;
          if (b.created_at === "—") return -1;

          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
        });

        setUsers(firestoreUsers);
        setLoading(false);
      },
      (snapshotError) => {
        console.error(
          `Error loading ${collectionName}:`,
          snapshotError
        );

        setError(
          `Unable to load ${getTitle(
            type
          ).toLowerCase()} from Firestore.`
        );

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [type]);

  /*
   * Search
   */
  const filtered = users.filter((user) =>
    `${user.full_name} ${user.email} ${user.phone_number}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  /*
   * Pagination
   */
  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / rowsPerPage)
  );

  const startIndex =
    (currentPage - 1) * rowsPerPage;

  const paginatedUsers = filtered.slice(
    startIndex,
    startIndex + rowsPerPage
  );

  /*
   * Selection
   */
  const allSelected =
    paginatedUsers.length > 0 &&
    paginatedUsers.every((user) =>
      selected.has(user.id)
    );

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);

      if (allSelected) {
        paginatedUsers.forEach((user) => {
          next.delete(user.id);
        });
      } else {
        paginatedUsers.forEach((user) => {
          next.add(user.id);
        });
      }

      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    if (
      page >= 1 &&
      page <= totalPages
    ) {
      setCurrentPage(page);
    }
  };

  /*
   * Navigate to the account settings page.
   *
   * customers → /users/:id
   * employees → /employees/:id
   */
  const handleView = (id: string) => {
    if (type === "customers") {
      navigate(`/users/${id}`);
      return;
    }

    if (type === "employees") {
      navigate(`/employees/${id}`);
      return;
    }

    if (type === "super_admins") {
      navigate(`/employees/${id}`);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-background">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 className="text-sm font-semibold">
            {getTitle(type)}
          </h2>

          <p className="text-xs text-muted-foreground">
            Manage {getTitle(type).toLowerCase()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder={`Search ${getTitle(
              type
            ).toLowerCase()}...`}
            value={search}
            onChange={(event) =>
              handleSearch(event.target.value)
            }
            className="w-64 bg-background"
          />

          <Button size="sm">
            Create user
          </Button>
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
              />
            </TableHead>

            <TableHead>Name</TableHead>

            <TableHead>Email</TableHead>

            <TableHead>Phone</TableHead>

            <TableHead>Created</TableHead>

            <TableHead className="text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>

          {/* Loading */}
          {loading && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                Loading{" "}
                {getTitle(type).toLowerCase()}...
              </TableCell>
            </TableRow>
          )}

          {/* Error */}
          {!loading && error && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-24 text-center text-sm text-destructive"
              >
                {error}
              </TableCell>
            </TableRow>
          )}

          {/* Data */}
          {!loading &&
            !error &&
            paginatedUsers.length > 0 &&
            paginatedUsers.map((user) => (
              <TableRow
                key={user.id}
                className="border-border"
              >
                <TableCell>
                  <Checkbox
                    checked={selected.has(user.id)}
                    onCheckedChange={() =>
                      toggleRow(user.id)
                    }
                  />
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src=""
                        alt={user.full_name}
                      />

                      <AvatarFallback>
                        {initials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    <span className="font-medium">
                      {user.full_name}
                    </span>
                  </div>
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {user.email}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {user.phone_number}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {user.created_at}
                </TableCell>

                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Row actions"
                        />
                      }
                    >
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          handleView(user.id)
                        }
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>

                      <DropdownMenuItem>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>

                      <DropdownMenuItem className="text-red-500">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}

          {/* Empty */}
          {!loading &&
            !error &&
            paginatedUsers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No{" "}
                  {getTitle(type).toLowerCase()} found.
                </TableCell>
              </TableRow>
            )}

        </TableBody>
      </Table>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {filtered.length > 0
            ? `Showing ${startIndex + 1}-${Math.min(
                startIndex + rowsPerPage,
                filtered.length
              )} of ${filtered.length}`
            : "Showing 0 of 0"}
        </p>

        <Pagination className="mx-0 w-auto">
          <PaginationContent>

            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  goToPage(currentPage - 1);
                }}
                className={
                  currentPage === 1
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>

            {Array.from(
              { length: totalPages },
              (_, index) => index + 1
            ).map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  href="#"
                  isActive={
                    currentPage === page
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    goToPage(page);
                  }}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  goToPage(currentPage + 1);
                }}
                className={
                  currentPage === totalPages
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>

          </PaginationContent>
        </Pagination>
      </div>

    </div>
  );
}