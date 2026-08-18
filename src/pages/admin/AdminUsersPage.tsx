import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShieldCheck, ShieldOff, UserCheck, UserX } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { Table, TableWrapper, Tbody, Td, Th, Thead, Tr } from "@/components/ui/Table";
import { normalizeError } from "@/api/client";
import { authApi } from "@/api/auth";
import { useDebounce } from "@/hooks/useDebounce";
import { ADMIN_PAGE_SIZE } from "@/lib/constants";
import { formatRelative } from "@/lib/format";
import { useAuthStore } from "@/store/authStore";
import type { Role, User } from "@/types";

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users", { page, q: debouncedSearch }],
    queryFn: () =>
      authApi.listUsers({ page, size: ADMIN_PAGE_SIZE, q: debouncedSearch || undefined }),
    placeholderData: (previous) => previous,
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  }

  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => authApi.setRole(id, role),
    onSuccess: invalidate,
  });

  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      authApi.setActive(id, active),
    onSuccess: invalidate,
  });

  const actionError = setRole.error ?? setActive.error;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Users</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Signup always creates a customer — admins are promoted here or seeded at startup.
        </p>
      </header>

      {/* The role lives inside the JWT, so a change only takes effect when the target's
          current access token expires. Saying so avoids an admin thinking the promotion
          silently failed. */}
      <Alert tone="info" title="Role changes take up to 15 minutes to take effect">
        The role is a token claim, so it applies when the user&apos;s current access token
        expires. That is the trade-off of stateless auth — no service has to call the auth
        service to authorize a request.
      </Alert>

      <div className="max-w-sm">
        <Input
          name="q"
          placeholder="Search name or email…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          leftIcon={<Search className="h-4 w-4" />}
          aria-label="Search users"
        />
      </div>

      {error && (
        <Alert tone="error" title="Could not load users">
          {normalizeError(error).message}
        </Alert>
      )}
      {actionError && (
        <Alert tone="error" title="Action failed">
          {normalizeError(actionError).message}
        </Alert>
      )}

      <TableWrapper>
        <Table>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th align="center">Role</Th>
              <Th align="center">State</Th>
              <Th>Last sign-in</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRowSkeleton key={index} columns={6} />
              ))
            ) : (
              data?.items.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSelf={user.id === currentUserId}
                  onSetRole={(role) => setRole.mutate({ id: user.id, role })}
                  onSetActive={(active) => setActive.mutate({ id: user.id, active })}
                  pending={
                    (setRole.isPending && setRole.variables?.id === user.id) ||
                    (setActive.isPending && setActive.variables?.id === user.id)
                  }
                />
              ))
            )}
          </Tbody>
        </Table>
      </TableWrapper>

      {data && (
        <Pagination
          page={data.page}
          pages={data.pages}
          total={data.total}
          size={data.size}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

function UserRow({
  user,
  isSelf,
  onSetRole,
  onSetActive,
  pending,
}: {
  user: User;
  isSelf: boolean;
  onSetRole: (role: Role) => void;
  onSetActive: (active: boolean) => void;
  pending: boolean;
}) {
  const isAdmin = user.role === "admin";

  return (
    <Tr>
      <Td>
        <span className="flex items-center gap-2">
          {user.full_name}
          {isSelf && (
            <Badge tone="brand" className="text-[10px]">
              you
            </Badge>
          )}
        </span>
      </Td>
      <Td>
        <span className="text-zinc-600">{user.email}</span>
      </Td>
      <Td align="center">
        <Badge tone={isAdmin ? "brand" : "neutral"}>{user.role}</Badge>
      </Td>
      <Td align="center">
        <Badge tone={user.is_active ? "success" : "danger"}>
          {user.is_active ? "Active" : "Deactivated"}
        </Badge>
      </Td>
      <Td>
        <span className="whitespace-nowrap text-xs text-zinc-500">
          {user.last_login_at ? formatRelative(user.last_login_at) : "never"}
        </span>
      </Td>
      <Td align="right">
        <div className="flex justify-end gap-1.5">
          {/* Self-actions are disabled here as well as rejected by the backend. An admin
              demoting or deactivating themselves can lock every admin out of the system,
              with no way back through the UI. */}
          <Button
            size="sm"
            variant="outline"
            disabled={isSelf || pending}
            onClick={() => onSetRole(isAdmin ? "customer" : "admin")}
            title={isSelf ? "You cannot change your own role" : undefined}
            leftIcon={
              isAdmin ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />
            }
          >
            {isAdmin ? "Demote" : "Make admin"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isSelf || pending}
            onClick={() => onSetActive(!user.is_active)}
            title={isSelf ? "You cannot deactivate your own account" : undefined}
            aria-label={user.is_active ? `Deactivate ${user.email}` : `Activate ${user.email}`}
          >
            {user.is_active ? (
              <UserX className="h-3.5 w-3.5" />
            ) : (
              <UserCheck className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </Td>
    </Tr>
  );
}
