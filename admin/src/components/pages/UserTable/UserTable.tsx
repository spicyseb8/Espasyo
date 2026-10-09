import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, Timestamp } from "firebase/firestore";
import { ArrowDownAZ, ArrowUpAZ } from "lucide-react";
import { db } from "@/firebase/firebase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import CreateAccountModal, { type CreateAccountType } from "@/components/createfunc/CreateAccountModal";
import { useAuth } from "@/context/AuthContext";

interface User { id: string; full_name: string; email: string; phone_number: string; created_at: string; created_ts: number; avatar?: string; }
interface FirestoreUser { full_name?: string | null; name?: string | null; email?: string | null; phone_number?: string | null; created_at?: Timestamp | string | null; profile_picture?: string | null; avatar?: string | null; role?: string | null; }
interface UserTableProps { type: "customers" | "employees" | "super_admins"; }

type SortField = "name" | "created";
type SortDirection = "asc" | "desc";

const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "created", label: "Date created" },
];

const toTime = (value: Timestamp | string | null | undefined): number => {
  if (!value) return 0;
  try {
    const time = value instanceof Timestamp ? value.toMillis() : new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  } catch { return 0; }
};

const formatDate = (value: Timestamp | string | null | undefined): string => {
  if (!value) return "—";
  try { return value instanceof Timestamp ? value.toDate().toLocaleDateString() : (isNaN(new Date(value).getTime()) ? "—" : new Date(value).toLocaleDateString()); } catch { return "—"; }
};

const initials = (name: string) => (!name || name === "—") ? "?" : name.trim().split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase();

const getTitle = (type: UserTableProps["type"]) => type === "customers" ? "Customers" : type === "employees" ? "Employees" : "Super Admins";

const getCreateAccountType = (type: UserTableProps["type"]): CreateAccountType => type === "customers" ? "user" : type === "super_admins" ? "superadmin" : "employee";

export default function UserTable({ type }: UserTableProps) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const canCreateAccounts = role === "superadmin";
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("created");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const rowsPerPage = 10;

  useEffect(() => {
    setLoading(true); setError(""); setUsers([]); setCurrentPage(1);
    const collectionName = type === "customers" ? "users" : "adminEmployees";
    const unsubscribe = onSnapshot(query(collection(db, collectionName)), (snapshot) => {
      const firestoreUsers: User[] = snapshot.docs
        .filter(d => type === "employees" ? d.data().role === "admin" : type === "super_admins" ? d.data().role === "superadmin" : true)
        .map(d => {
          const data = d.data() as FirestoreUser;
          return {
            id: d.id,
            full_name: data.full_name?.trim() || data.name?.trim() || "Unknown User",
            email: data.email?.trim() || "—",
            phone_number: data.phone_number?.trim() || "—",
            created_at: formatDate(data.created_at),
            created_ts: toTime(data.created_at),
            avatar: data.avatar || data.profile_picture || "",
          };
        });
      setUsers(firestoreUsers); setLoading(false);
    }, (err) => { console.error(`Error loading ${collectionName}:`, err); setError(`Unable to load ${getTitle(type).toLowerCase()} from Firestore.`); setLoading(false); });
    return () => unsubscribe();
  }, [type]);

  const filtered = useMemo(() => {
    const value = search.toLowerCase();
    const base = users.filter(u => `${u.full_name} ${u.email} ${u.phone_number}`.toLowerCase().includes(value));
    return [...base].sort((a, b) => {
      let comparison = sortField === "name" ? a.full_name.localeCompare(b.full_name) : a.created_ts - b.created_ts;
      if (comparison === 0) comparison = a.id.localeCompare(b.id);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [users, search, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedUsers = filtered.slice(startIndex, startIndex + rowsPerPage);

  const handleSearch = (value: string) => { setSearch(value); setCurrentPage(1); };
  const handleSortField = (value: SortField) => { setSortField(value); setCurrentPage(1); };
  const toggleSortDirection = () => { setSortDirection(current => current === "asc" ? "desc" : "asc"); setCurrentPage(1); };
  const goToPage = (page: number) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };
  const handleView = (id: string) => navigate(type === "customers" ? `/users/${id}` : `/employees/${id}`);

  return (
    <>
      <div className="rounded-lg border border-border bg-background">
        <div className="flex items-center justify-between gap-4 border-b border-border p-4">
          <div>
            <h2 className="text-sm font-semibold">{getTitle(type)}</h2>
            <p className="text-xs text-muted-foreground">Manage {getTitle(type).toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            {canCreateAccounts && (
              <Button size="sm" onClick={() => setCreateAccountOpen(true)}>Create</Button>
            )}
            <Input placeholder={`Search ${getTitle(type).toLowerCase()}...`} value={search} onChange={e => handleSearch(e.target.value)} className="w-64 bg-background" />
            <Select value={sortField} onValueChange={value => handleSortField(value as SortField)}>
              <SelectTrigger className="w-40 border-border/60">
                <SelectValue placeholder="Sort by">
                  {SORT_FIELDS.find(option => option.value === sortField)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SORT_FIELDS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={toggleSortDirection}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground hover:bg-muted"
              title={sortDirection === "asc" ? "Ascending" : "Descending"}
              aria-label={`Sort ${sortDirection === "asc" ? "ascending" : "descending"}`}
            >
              {sortDirection === "asc" ? <ArrowUpAZ size={16} /> : <ArrowDownAZ size={16} />}
            </button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">Loading {getTitle(type).toLowerCase()}...</TableCell></TableRow>}
            {!loading && error && <TableRow><TableCell colSpan={4} className="h-24 text-center text-sm text-destructive">{error}</TableCell></TableRow>}
            {!loading && !error && paginatedUsers.length > 0 && paginatedUsers.map(user => (
              <TableRow key={user.id} className="cursor-pointer border-border hover:bg-muted/50" onClick={() => handleView(user.id)}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar || ""} alt={user.full_name} />
                      <AvatarFallback>{initials(user.full_name)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{user.full_name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell className="text-muted-foreground">{user.phone_number}</TableCell>
                <TableCell className="text-muted-foreground">{user.created_at}</TableCell>
              </TableRow>
            ))}
            {!loading && !error && paginatedUsers.length === 0 && (
              <TableRow><TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">No {getTitle(type).toLowerCase()} found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {filtered.length > 0 ? `Showing ${startIndex + 1}-${Math.min(startIndex + rowsPerPage, filtered.length)} of ${filtered.length}` : "Showing 0 of 0"}
          </p>
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" onClick={e => { e.preventDefault(); goToPage(currentPage - 1); }} className={currentPage === 1 ? "pointer-events-none opacity-50" : ""} />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <PaginationItem key={page}>
                  <PaginationLink href="#" isActive={currentPage === page} onClick={e => { e.preventDefault(); goToPage(page); }}>{page}</PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext href="#" onClick={e => { e.preventDefault(); goToPage(currentPage + 1); }} className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      {canCreateAccounts && (
        <CreateAccountModal
          open={createAccountOpen}
          onOpenChange={setCreateAccountOpen}
          accountType={getCreateAccountType(type)}
        />
      )}
    </>
  );
}