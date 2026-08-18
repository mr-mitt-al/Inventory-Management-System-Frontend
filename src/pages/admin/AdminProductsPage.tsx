import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Search, Trash2 } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { Table, TableWrapper, Tbody, Td, Th, Thead, Tr } from "@/components/ui/Table";
import { normalizeError } from "@/api/client";
import { catalogApi } from "@/api/catalog";
import { useDebounce } from "@/hooks/useDebounce";
import { useCategories } from "@/hooks/useProducts";
import { ADMIN_PAGE_SIZE } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import type { Product } from "@/types";

const productSchema = z.object({
  sku: z.string().min(1, "SKU is required").max(64),
  name: z.string().min(1, "Name is required").max(250),
  description: z.string().max(5000).optional(),
  // Kept as a string all the way to the wire, matching the backend's NUMERIC column.
  // Parsing to a float here would be the one place a rounding error could creep in.
  price: z
    .string()
    .min(1, "Price is required")
    .regex(/^\d+(\.\d{1,2})?$/, "Use a number with up to two decimals"),
  category_id: z.string().optional(),
  image_url: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  initial_stock: z.coerce.number().int().min(0).default(0),
});

type ProductForm = z.infer<typeof productSchema>;

export function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const { data: categories = [] } = useCategories();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "products", { page, q: debouncedSearch }],
    queryFn: () =>
      catalogApi.adminListProducts({
        page,
        size: ADMIN_PAGE_SIZE,
        q: debouncedSearch || undefined,
      }),
    placeholderData: (previous) => previous,
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  }

  const create = useMutation({
    mutationFn: (values: ProductForm) =>
      catalogApi.createProduct({
        sku: values.sku,
        name: values.name,
        description: values.description || null,
        price: values.price,
        category_id: values.category_id || null,
        image_url: values.image_url || null,
        initial_stock: values.initial_stock,
      }),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
    },
  });

  const update = useMutation({
    mutationFn: ({ id, price, name }: { id: string; price: string; name: string }) =>
      catalogApi.updateProduct(id, { price, name }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => catalogApi.deactivateProduct(id),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Products</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Editing a price publishes an event, so the order service prices new checkouts
            correctly. Historical orders keep the price they were placed at.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
          New product
        </Button>
      </header>

      <div className="max-w-sm">
        <Input
          name="q"
          placeholder="Search name or SKU…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          leftIcon={<Search className="h-4 w-4" />}
          aria-label="Search products"
        />
      </div>

      {error && (
        <Alert tone="error" title="Could not load products">
          {normalizeError(error).message}
        </Alert>
      )}
      {deactivate.error && (
        <Alert tone="error" title="Could not withdraw the product">
          {normalizeError(deactivate.error).message}
        </Alert>
      )}

      <TableWrapper>
        <Table>
          <Thead>
            <Tr>
              <Th>SKU</Th>
              <Th>Name</Th>
              <Th>Category</Th>
              <Th align="right">Price</Th>
              <Th align="center">Display stock</Th>
              <Th align="center">State</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRowSkeleton key={index} columns={7} />
              ))
            ) : (
              data?.items.map((product) => (
                <Tr key={product.id}>
                  <Td>
                    <span className="font-mono text-xs">{product.sku}</span>
                  </Td>
                  <Td className="max-w-[16rem]">
                    <span className="block truncate">{product.name}</span>
                  </Td>
                  <Td>
                    <span className="text-xs text-zinc-500">
                      {product.category?.name ?? "—"}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="font-medium tabular">
                      {formatMoney(product.price, product.currency)}
                    </span>
                  </Td>
                  <Td align="center">
                    <span className="tabular text-zinc-600">{product.cached_stock}</span>
                  </Td>
                  <Td align="center">
                    <Badge tone={product.is_active ? "success" : "neutral"}>
                      {product.is_active ? "Active" : "Withdrawn"}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setEditing(product)}>
                        Edit
                      </Button>
                      {product.is_active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={deactivate.isPending && deactivate.variables === product.id}
                          onClick={() => deactivate.mutate(product.id)}
                          aria-label={`Withdraw ${product.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
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

      <CreateProductModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        categories={categories.map((c) => ({ value: c.id, label: c.name }))}
        onSubmit={(values) => create.mutate(values)}
        pending={create.isPending}
        error={create.error ? normalizeError(create.error).message : null}
      />

      <EditProductModal
        product={editing}
        onClose={() => setEditing(null)}
        onSubmit={(values) => editing && update.mutate({ id: editing.id, ...values })}
        pending={update.isPending}
        error={update.error ? normalizeError(update.error).message : null}
      />
    </div>
  );
}

function CreateProductModal({
  open,
  onClose,
  categories,
  onSubmit,
  pending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  categories: { value: string; label: string }[];
  onSubmit: (values: ProductForm) => void;
  pending: boolean;
  error: string | null;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { initial_stock: 0 },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New product"
      description="Creating a product publishes catalog.product.upserted so orders can price it."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="create-product" type="submit" loading={pending}>
            Create
          </Button>
        </>
      }
    >
      <form id="create-product" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <Alert tone="error" title="Could not create">
            {error}
          </Alert>
        )}
        <Input label="SKU" required error={errors.sku?.message} {...register("sku")} />
        <Input label="Name" required error={errors.name?.message} {...register("name")} />
        <Input
          label="Price"
          required
          placeholder="1999.00"
          hint="Up to two decimal places."
          error={errors.price?.message}
          {...register("price")}
        />
        <Select
          label="Category"
          options={[{ value: "", label: "No category" }, ...categories]}
          {...register("category_id")}
        />
        <Input
          label="Image URL"
          placeholder="https://…"
          error={errors.image_url?.message}
          {...register("image_url")}
        />
        <Input
          label="Opening stock"
          type="number"
          min={0}
          hint="Display only. Create the real stock record from the Inventory page."
          error={errors.initial_stock?.message}
          {...register("initial_stock")}
        />
        <Input label="Description" error={errors.description?.message} {...register("description")} />
      </form>
    </Modal>
  );
}

function EditProductModal({
  product,
  onClose,
  onSubmit,
  pending,
  error,
}: {
  product: Product | null;
  onClose: () => void;
  onSubmit: (values: { price: string; name: string }) => void;
  pending: boolean;
  error: string | null;
}) {
  const [price, setPrice] = useState("");
  const [name, setName] = useState("");

  // Seed the fields when a different product is opened.
  const key = product?.id ?? "";
  const [seededFor, setSeededFor] = useState("");
  if (product && seededFor !== key) {
    setSeededFor(key);
    setPrice(product.price);
    setName(product.name);
  }

  return (
    <Modal
      open={Boolean(product)}
      onClose={onClose}
      title="Edit product"
      description={product?.sku}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={pending} onClick={() => onSubmit({ price, name })}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <Alert tone="error" title="Could not save">
            {error}
          </Alert>
        )}
        <Input
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          name="edit-name"
        />
        <Input
          label="Price"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          name="edit-price"
          hint="Existing orders keep the price they were placed at."
        />
        <Alert tone="info">
          Stock is not editable here — it belongs to the inventory service. Use the
          Inventory page to restock or correct a count.
        </Alert>
      </div>
    </Modal>
  );
}
