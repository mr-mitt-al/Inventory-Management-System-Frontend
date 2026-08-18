/**
 * Dead letter queue.
 *
 * Small screen, unusually valuable: it shows you thought about OPERATING the system,
 * not just building it. A message lands here when a consumer failed it three times,
 * and until someone acts on it the work in that message has not happened.
 *
 * Replay is manual on purpose. A message that failed deterministically will fail
 * again, so automatic replay of a poison message is a denial of service you inflict
 * on yourself.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertOctagon, CheckCircle2, RotateCcw, Trash2 } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { Table, TableWrapper, Tbody, Td, Th, Thead, Tr } from "@/components/ui/Table";
import { normalizeError } from "@/api/client";
import { ordersApi } from "@/api/orders";
import { ADMIN_PAGE_SIZE } from "@/lib/constants";
import { formatRelative } from "@/lib/format";
import type { DeadLetter } from "@/types";

const STATUS_OPTIONS = [
  { value: "PARKED", label: "Parked (needs review)" },
  { value: "REPLAYED", label: "Replayed" },
  { value: "DISCARDED", label: "Discarded" },
  { value: "", label: "All" },
];

export function AdminDlqPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("PARKED");
  const [selected, setSelected] = useState<DeadLetter | null>(null);
  const [note, setNote] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "dlq", { page, status }],
    queryFn: () =>
      ordersApi.listDeadLetters({
        page,
        size: ADMIN_PAGE_SIZE,
        status: status ? (status as "PARKED" | "REPLAYED" | "DISCARDED") : undefined,
      }),
    refetchInterval: 20_000,
  });

  const detail = useQuery({
    queryKey: ["admin", "dlq", selected?.id],
    queryFn: () => ordersApi.getDeadLetter(selected!.id),
    enabled: Boolean(selected),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["admin", "dlq"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "orderStats"] });
  }

  const replay = useMutation({
    mutationFn: (id: string) => ordersApi.replayDeadLetter(id, note || undefined),
    onSuccess: () => {
      invalidate();
      setSelected(null);
      setNote("");
    },
  });

  const discard = useMutation({
    mutationFn: (id: string) => ordersApi.discardDeadLetter(id, note || undefined),
    onSuccess: () => {
      invalidate();
      setSelected(null);
      setNote("");
    },
  });

  const actionError = replay.error ?? discard.error;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Dead letters</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Messages a consumer failed after exhausting its retries.
          </p>
        </div>
        <div className="w-full sm:w-56">
          <Select
            name="status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
            aria-label="Filter by state"
          />
        </div>
      </header>

      {error && (
        <Alert tone="error" title="Could not load the queue">
          {normalizeError(error).message}
        </Alert>
      )}

      {data && data.total === 0 && status === "PARKED" ? (
        <EmptyState
          icon={<CheckCircle2 className="h-10 w-10 text-emerald-400" />}
          title="Nothing parked"
          description="Every message has been handled. This is what you want to see here."
        />
      ) : (
        <>
          <TableWrapper>
            <Table>
              <Thead>
                <Tr>
                  <Th>Topic</Th>
                  <Th>Failed by</Th>
                  <Th>Error</Th>
                  <Th align="center">Tries</Th>
                  <Th>State</Th>
                  <Th>When</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRowSkeleton key={index} columns={7} />
                  ))
                ) : (
                  data?.items.map((row) => (
                    <Tr key={row.id}>
                      <Td>
                        <span className="font-mono text-xs text-zinc-800">
                          {row.original_topic}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-xs text-zinc-600">{row.failed_by}</span>
                      </Td>
                      <Td className="max-w-[16rem]">
                        <p className="truncate font-mono text-xs text-red-700">{row.error_type}</p>
                        <p className="truncate text-xs text-zinc-500">{row.error_message}</p>
                      </Td>
                      <Td align="center">
                        <span className="tabular">{row.attempts}</span>
                      </Td>
                      <Td>
                        <Badge
                          tone={
                            row.status === "PARKED"
                              ? "danger"
                              : row.status === "REPLAYED"
                                ? "success"
                                : "neutral"
                          }
                        >
                          {row.status}
                        </Badge>
                      </Td>
                      <Td>
                        <span className="whitespace-nowrap text-xs text-zinc-500">
                          {formatRelative(row.created_at)}
                        </span>
                      </Td>
                      <Td align="right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelected(row);
                            setNote("");
                          }}
                        >
                          Inspect
                        </Button>
                      </Td>
                    </Tr>
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
        </>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Dead letter"
        description={selected?.original_topic}
        size="lg"
        footer={
          selected?.status === "PARKED" ? (
            <>
              <Button
                variant="ghost"
                onClick={() => discard.mutate(selected.id)}
                loading={discard.isPending}
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                Discard
              </Button>
              <Button
                onClick={() => replay.mutate(selected.id)}
                loading={replay.isPending}
                // Disabled when the payload could not be deserialized: there is no
                // original event to republish, so the producer has to be fixed instead.
                disabled={detail.data?.original_event === null}
                leftIcon={<RotateCcw className="h-4 w-4" />}
              >
                Replay to {selected.original_topic}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
          )
        }
      >
        {selected && (
          <div className="space-y-4">
            {actionError && (
              <Alert tone="error" title="Action failed">
                {normalizeError(actionError).message}
              </Alert>
            )}

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Failed by" value={selected.failed_by} />
              <Field label="Attempts" value={String(selected.attempts)} />
              <Field label="Error type" value={selected.error_type} mono />
              <Field label="Partition key" value={selected.original_key ?? "—"} mono />
            </dl>

            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Message
              </p>
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                {selected.error_message}
              </p>
            </div>

            {detail.data?.original_event === null && (
              <Alert tone="warning" title="Cannot be replayed">
                This message could not be deserialized, so there is no event to republish.
                Fix the producer, then discard this row.
              </Alert>
            )}

            {detail.data?.original_event && (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-zinc-700">
                  Original event
                </summary>
                <pre className="mt-2 max-h-52 overflow-auto rounded-lg bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-100">
                  {JSON.stringify(detail.data.original_event, null, 2)}
                </pre>
              </details>
            )}

            {detail.data?.stack_trace && (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-zinc-700">
                  Stack trace
                </summary>
                <pre className="mt-2 max-h-52 overflow-auto rounded-lg bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-100">
                  {detail.data.stack_trace}
                </pre>
              </details>
            )}

            {selected.status === "PARKED" && (
              <>
                <Input
                  label="Note (optional)"
                  placeholder="Why are you replaying or discarding this?"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <Alert tone="info">
                  Replaying is safe to repeat — consumers deduplicate on{" "}
                  <code className="font-mono text-xs">event_id</code>, and the replay reuses
                  the original envelope rather than minting a new one.
                </Alert>
              </>
            )}

            {selected.note && (
              <p className="text-sm text-zinc-500">
                <AlertOctagon className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                {selected.note}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className={`mt-0.5 truncate text-zinc-900 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
