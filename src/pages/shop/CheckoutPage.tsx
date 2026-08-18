import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { CreditCard, Info, Lock } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { normalizeError } from "@/api/client";
import { ordersApi } from "@/api/orders";
import { cn } from "@/lib/cn";
import { TEST_CARDS, type TestCard } from "@/lib/constants";
import { formatMinor } from "@/lib/money";
import { selectCartCurrency, selectCartSubtotal, useCartStore } from "@/store/cartStore";

const addressSchema = z.object({
  line1: z.string().min(1, "Address is required").max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  postal_code: z
    .string()
    .min(4, "Enter a valid postal code")
    .max(12)
    .regex(/^[A-Za-z0-9\s-]+$/, "Enter a valid postal code"),
  country: z.string().min(2).max(2).default("IN"),
  phone: z.string().max(20).optional(),
});

type AddressForm = z.infer<typeof addressSchema>;

export function CheckoutPage() {
  const navigate = useNavigate();
  const lines = useCartStore((s) => s.lines);
  const clearCart = useCartStore((s) => s.clear);
  const subtotal = useCartStore(selectCartSubtotal);
  const currency = useCartStore(selectCartCurrency);

  const [selectedCard, setSelectedCard] = useState<TestCard>(TEST_CARDS[0]);

  /**
   * THE IDEMPOTENCY KEY.
   *
   * Generated once when this page mounts, in a ref so a re-render cannot change it,
   * and reused for every submit attempt from this checkout.
   *
   * Generating it per click would defeat the entire point: a double-clicked button,
   * a flaky network retry, or an impatient second submit would each carry a fresh key
   * and the backend would create a second order — reserving stock twice and charging
   * the customer twice. One key per checkout attempt is what makes the retry safe.
   */
  const idempotencyKey = useRef(crypto.randomUUID());

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: { country: "IN" },
  });

  const placeOrder = useMutation({
    mutationFn: (address: AddressForm) =>
      ordersApi.create(
        {
          // product_id + quantity ONLY. Prices are not sent — the backend reads them
          // from its own read-model, so a tampered cart cannot change what is charged.
          items: lines.map((line) => ({
            product_id: line.product_id,
            quantity: line.quantity,
          })),
          shipping_address: {
            line1: address.line1,
            line2: address.line2 || null,
            city: address.city,
            state: address.state,
            postal_code: address.postal_code,
            country: address.country,
            phone: address.phone || null,
          },
          payment_method: {
            type: "CARD",
            // A token, never the card number. The number above never leaves the browser.
            token: selectedCard.token,
            last4: selectedCard.last4,
            label: selectedCard.label,
          },
        },
        idempotencyKey.current,
      ),
    onSuccess: (response) => {
      clearCart();
      // 202 Accepted — the order is NOT confirmed yet. Send the user to tracking so
      // they watch the saga run, rather than showing a success message that a payment
      // decline would immediately contradict.
      navigate(`/orders/${response.order_id}?placed=1`, { replace: true });
    },
  });

  const error = placeOrder.error ? normalizeError(placeOrder.error) : null;

  const itemCount = useMemo(
    () => lines.reduce((total, line) => total + line.quantity, 0),
    [lines],
  );

  if (lines.length === 0) {
    return (
      <Alert tone="info" title="Your cart is empty">
        <Link to="/" className="font-medium underline">
          Browse products
        </Link>{" "}
        to add something first.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Checkout</h1>

      <form
        onSubmit={handleSubmit((values) => placeOrder.mutate(values))}
        className="grid gap-6 lg:grid-cols-[1fr_20rem]"
      >
        <div className="space-y-6">
          <Card>
            <CardHeader title="Shipping address" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input
                  label="Address line 1"
                  required
                  placeholder="Flat, house, street"
                  error={errors.line1?.message}
                  {...register("line1")}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Address line 2"
                  placeholder="Area, landmark (optional)"
                  error={errors.line2?.message}
                  {...register("line2")}
                />
              </div>
              <Input label="City" required error={errors.city?.message} {...register("city")} />
              <Input label="State" required error={errors.state?.message} {...register("state")} />
              <Input
                label="Postal code"
                required
                error={errors.postal_code?.message}
                {...register("postal_code")}
              />
              <Input
                label="Phone"
                type="tel"
                placeholder="Optional"
                error={errors.phone?.message}
                {...register("phone")}
              />
              <input type="hidden" {...register("country")} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Payment method"
              description="Test cards only — pick one to control what the payment gateway does."
            />
            <CardBody className="space-y-3">
              {/* Exposing a deliberate failure is the point: it makes the
                  compensating transaction demonstrable on demand rather than
                  something you have to take on faith. */}
              <fieldset className="space-y-2">
                <legend className="sr-only">Choose a test card</legend>
                {TEST_CARDS.map((card) => {
                  const active = selectedCard.token === card.token;
                  return (
                    <label
                      key={card.token}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                        active
                          ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500"
                          : "border-zinc-200 hover:bg-zinc-50",
                      )}
                    >
                      <input
                        type="radio"
                        name="test-card"
                        value={card.token}
                        checked={active}
                        onChange={() => setSelectedCard(card)}
                        className="mt-1 h-4 w-4 accent-brand-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm text-zinc-900">{card.number}</span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-medium",
                              card.outcome === "success"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700",
                            )}
                          >
                            {card.label}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-zinc-500">{card.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              <p className="flex items-start gap-2 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                The card number never leaves your browser. Only a token is sent to the
                server, so no card details pass through the event stream.
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader title="Order summary" />
            <CardBody className="space-y-3">
              <ul className="space-y-2 text-sm">
                {lines.map((line) => (
                  <li key={line.product_id} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate text-zinc-600">
                      {line.name} <span className="text-zinc-400">×{line.quantity}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="border-t border-zinc-200 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600">{itemCount} items</span>
                  <span className="font-medium tabular">{formatMinor(subtotal, currency)}</span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="font-semibold text-zinc-900">Total</span>
                  <span className="text-lg font-semibold text-zinc-900 tabular">
                    {formatMinor(subtotal, currency)}
                  </span>
                </div>
              </div>

              {error && (
                <Alert tone="error" title="Could not place the order">
                  {error.message}
                  {error.details?.unknown_products !== undefined && (
                    <p className="mt-1">
                      Some items are no longer available. Return to your cart and remove
                      them.
                    </p>
                  )}
                </Alert>
              )}

              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={placeOrder.isPending}
                leftIcon={<CreditCard className="h-4 w-4" />}
              >
                Place order
              </Button>

              <p className="flex items-start gap-2 text-xs text-zinc-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Your order is processed asynchronously. You will be taken to a tracking
                page while stock is reserved and payment is taken — both take a second or
                two and either can fail.
              </p>
            </CardBody>
          </Card>
        </div>
      </form>
    </div>
  );
}
