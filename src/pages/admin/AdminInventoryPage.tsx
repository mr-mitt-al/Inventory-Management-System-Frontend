import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, PackagePlus, SlidersHorizontal } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { Table, TableWrapper, Tbody, Td, Th, Thead, Tr } from "@/components/ui/Table";
import { normalizeError } from "@/api/client";
import { inventoryApi } from "@/api/inventory";
import { ADMIN_PAGE_SIZE } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Stock } from "@/types";

type Mode = "restock" | "adjust";

const LEDGER_TONES: Record<string, string> = {
  RESERVE: "text-amber-700",
  RELEASE: "text-emerald-700",
  COMMIT: "text-zinc-600",
  RESTOCK: "text-brand-700",
  ADJUST: "text-purple-700",
  EXPIRE: "text-orange-700",
};

export function AdminInventoryPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState<{ stock: Stock; mode: Mode } | null>(null);
  const [ledgerFor, setLedgerFor] = useState<Stock | null>(null);
  const [amount, setAmount] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "stock", { page, lowOnly }],
    queryFn: () =>
      lowOnly
        ? inventoryApi.listLowStock({ page, size: ADMIN_PAGE_SIZE })
        : inventoryApi.listStock({ page, size: ADMIN_PAGE_SIZE }),
    placeholderData: (previous) => previous,
    refetchInterval: 20_000,
  });

  const ledger = useQuery({
    queryKey: ["admin", "ledger", ledgerFor?.product_id],
    queryFn: () =>
      inventoryApi.ledger(ledgerFor!.product_id, { page: 1, size: 25 }),
    enabled: Boolean(ledgerFor),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["admin", "stock"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "lowStock"] });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  }

  const mutate = useMutation({
    mutationFn: ({ stock, mode, value }: { stock: Stock; mode: Mode; value: number }) =>
      mode === "restock"
        ? inventoryApi.restock(stock.product_id, { quantity: value })
        : inventoryApi.adjust(stock.product_id, { available_qty: value }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      setAmount("");
    },
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Inventory</h1>
          <p className="mt-1 text-sm text-zinc-500">
            The source of truth for stock. <span className="font-medium">Available</span> can be
            sold; <span className="font-medium">held</span> is set aside for orders that have not
            paid yet.
          </p>
        </div>
        <Button
          variant={lowOnly ? "primary" : "outline"}
          onClick={() => {
            setLowOnly((value) => !value);
            setPage(1);
          }}
        >
          {lowOnly ? "Showing low stock" : "Show low stock only"}
        </Button>
      </header>

      {error && (
        <Alert tone="error" title="Could not load stock">
          {normalizeError(error).message}
        </Alert>
      )}

      <TableWrapper>
        <Table>
          <Thead>
            <Tr>
              <Th>SKU</Th>
              <Th align="center">Available</Th>
              <Th align="center">Held</Th>
              <Th align="center">Total</Th>
              <Th align="center">Threshold</Th>
              <Th align="center">State</Th>
              <Th>Updated</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRowSkeleton key={index} columns={8} />
              ))
            ) : (
              data?.items.map((stock) => (
                <Tr key={stock.product_id}>
                  <Td>
                    <span className="font-mono text-xs">{stock.sku}</span>
                  </Td>
                  <Td align="center">
                    <span className="font-medium tabular">{stock.available_qty}</span>
                  </Td>
                  <Td align="center">
                    <span className={cn("tabular", stock.reserved_qty > 0 && "text-amber-700")}>
                      {stock.reserved_qty}
                    </span>
                  </Td>
                  <Td align="center">
                    <span className="tabular text-zinc-500">{stock.total_qty}</span>
                  </Td>
                  <Td align="center">
                    <span className="tabular text-zinc-500">{stock.low_stock_threshold}</span>
                  </Td>
                  <Td align="center">
                    {stock.available_qty === 0 ? (
                      <Badge tone="danger">Out</Badge>
                    ) : stock.is_low ? (
                      <Badge tone="warning">Low</Badge>
                    ) : (
                      <Badge tone="success">OK</Badge>
                    )}
                  </Td>
                  <Td>
                    <span className="whitespace-nowrap text-xs text-zinc-500">
                      {formatDateTime(stock.updated_at)}
                    </span>
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing({ stock, mode: "restock" });
                          setAmount("");
                        }}
                        leftIcon={<PackagePlus className="h-3.5 w-3.5" />}
                      >
                        Restock
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing({ stock, mode: "adjust" });
                          setAmount(String(stock.available_qty));
                        }}
                        aria-label={`Correct count for ${stock.sku}`}
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLedgerFor(stock)}
                        aria-label={`History for ${stock.sku}`}
                      >
                        <History className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.mode === "restock" ? "Add stock" : "Correct the count"}
        description={editing?.stock.sku}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              loading={mutate.isPending}
              disabled={amount === "" || Number.isNaN(Number(amount))}
              onClick={() =>
                editing &&
                mutate.mutate({
                  stock: editing.stock,
                  mode: editing.mode,
                  value: Number(amount),
                })
              }
            >
              {editing?.mode === "restock" ? "Add" : "Set"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {mutate.error && (
            <Alert tone="error" title="Could not update">
              {normalizeError(mutate.error).message}
            </Alert>
          )}

          {/* The two operations are deliberately separate: "40 more arrived" and "we
              counted and there are 40" are different facts, and merging them would make
              the ledger unable to answer either question. */}
          <Alert tone="info">
            {editing?.mode === "restock"
              ? "Relative: this ADDS to available stock, for newly received units."
              : "Absolute: this SETS available stock, for a stock-take correction. The signed difference is recorded in the ledger."}
          </Alert>

          <Input
            label={editing?.mode === "restock" ? "Units to add" : "New available quantity"}
            type="number"
            min={editing?.mode === "restock" ? 1 : 0}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            name="amount"
          />

          {editing && (
            <dl className="grid grid-cols-3 gap-3 rounded-lg bg-zinc-50 p-3 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Available</dt>
                <dd className="tabular">{editing.stock.available_qty}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Held</dt>
                <dd className="tabular">{editing.stock.reserved_qty}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">After</dt>
                <dd className="font-medium tabular">
                  {editing.mode === "restock"
                    ? editing.stock.available_qty + (Number(amount) || 0)
                    : Number(amount) || 0}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(ledgerFor)}
        onClose={() => setLedgerFor(null)}
        title="Stock movements"
        description={ledgerFor?.sku}
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setLedgerFor(null)}>
            Close
          </Button>
        }
      >
        {ledger.isLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : ledger.data && ledger.data.items.length > 0 ? (
          <ul className="divide-y divide-zinc-100 text-sm">
            {ledger.data.items.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className={cn("font-medium", LEDGER_TONES[entry.reason] ?? "text-zinc-700")}>
                    {entry.reason}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {formatDateTime(entry.created_at)}
                    {entry.ref_order_id && (
                      <span className="ml-1 font-mono">
                        · order {entry.ref_order_id.slice(0, 8)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="shrink-0 text-right tabular">
                  <p
                    className={cn(
                      "font-medium",
                      entry.delta > 0
                        ? "text-emerald-700"
                        : entry.delta < 0
                          ? "text-red-700"
                          : "text-zinc-400",
                    )}
                  >
                    {entry.delta > 0 ? "+" : ""}
                    {entry.delta}
                  </p>
                  <p className="text-xs text-zinc-400">→ {entry.balance_after}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">No movements recorded.</p>
        )}
      </Modal>
    </div>
  );
}
