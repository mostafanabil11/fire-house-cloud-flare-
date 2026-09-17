"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bike, CreditCard, MapPin, ReceiptText, Tag } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useCart } from "@/hooks/use-cart";
import { useCartStore } from "@/store/cart";
import { useAppliedCoupon } from "@/hooks/use-applied-coupon";
import { getAddresses } from "@/lib/api/addresses";
import { getStoreSettingsClient } from "@/lib/api/settings";
import { checkout, getPaymentStatus } from "@/lib/api/orders";
import { cartLinesToPayload } from "@/lib/api/cart";
import type { CheckoutResponse } from "@/lib/api/orders";
import { formatPrice } from "@/lib/format";
import { CheckoutCard } from "@/components/checkout/checkout-card";
import { AddressSection } from "@/components/checkout/address-section";
import { DeliveryDetailsSection } from "@/components/checkout/delivery-details-section";
import { EMPTY_ADDRESS_FORM, type AddressFormValues } from "@/components/checkout/address-form-fields";
import { OrderSummary } from "@/components/checkout/order-summary";
import { CouponField } from "@/components/checkout/coupon-field";
import { PaymentSection, type PaymentMethodType } from "@/components/checkout/payment-section";
import { CartChangedBanner } from "@/components/products/cart-changed-banner";
import { RESTAURANT } from "@/config/restaurant";
import { validEmail, validPhone } from "@/lib/checkout-validation";
import { T } from "@/i18n/language-provider";
import { PageSkeleton, PageState } from "@/components/ui/page-state";

export default function CheckoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { cart, isLoading: cartLoading, isError: cartError, retry: retryCart } = useCart();
  const clearLocalCart = useCartStore((s) => s.clear);
  const { coupon, setCoupon } = useAppliedCoupon();

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  // Guest-only state. Kept here rather than in the child sections so the
  // place-order mutation can read it directly at submit time.
  const [guestEmail, setGuestEmail] = useState("");
  const [guestAddress, setGuestAddress] = useState<AddressFormValues>(EMPTY_ADDRESS_FORM);
  // Cash is the default because it is how most delivery orders are paid for.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("cod");
  const [paymentReference, setPaymentReference] = useState("");
  const [session, setSession] = useState<(CheckoutResponse["payment"] & { orderNumber: string }) | null>(
    null,
  );
  // Set the moment an order is successfully placed, so the "cart is empty ->
  // go back to /cart" guard below can't hijack the navigation to the
  // confirmation page (placing an order clears the cart).
  const [orderPlaced, setOrderPlaced] = useState(false);

  // One key per visit, reused across retries so a network blip after tapping
  // place-order can't produce a second order.
  const idempotencyKey = useRef<string>(crypto.randomUUID());

  // Guests have no address book — the query would 401 — so it only runs once
  // we know there's a session behind it.
  const addressesQuery = useQuery({ queryKey: ["addresses"], queryFn: getAddresses, enabled: !!user });
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: getStoreSettingsClient });

  const effectiveAddressId = selectedAddressId ?? addressesQuery.data?.find(address => address.isDefault)?._id ?? addressesQuery.data?.[0]?._id ?? null;

  useEffect(() => {
    // Waits for auth to resolve because until it does we don't yet know which
    // cart source is authoritative, and an empty placeholder is
    // indistinguishable from a genuinely empty order.
    // Also skipped once a payment session exists: the cart legitimately still
    // has items while the customer is mid-payment.
    if (!orderPlaced && !session && !userLoading && !cartLoading && !cartError && cart.items.length === 0) {
      router.replace("/cart");
    }
  }, [orderPlaced, session, userLoading, cartLoading, cartError, cart.items.length, router]);

  const deliveryFee = useMemo(() => {
    if (!settingsQuery.data) return null;
    if (coupon?.freeShipping) return 0;
    return cart.subtotal >= settingsQuery.data.freeShippingThresholdMinorUnits
      ? 0
      : settingsQuery.data.flatShippingRateMinorUnits;
  }, [settingsQuery.data, cart.subtotal, coupon?.freeShipping]);

  const discountAmount = coupon?.discountAmount ?? 0;
  const total = deliveryFee === null ? null : cart.subtotal + deliveryFee - discountAmount;
  const cartIsClean = !cart.hasChanges && cart.items.every((i) => i.available);
  const instapayAddress = settingsQuery.data?.instapayAddress ?? "";

  // While the payment frame is open, poll our own backend rather than trusting
  // the provider's browser redirect — that redirect is lost if the customer
  // closes the tab or a 3-D Secure step misbehaves, and the webhook is the
  // real source of truth anyway.
  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const status = await getPaymentStatus(session.orderNumber);
        if (cancelled) return;

        if (status.paymentStatus === "paid") {
          clearInterval(interval);
          setOrderPlaced(true);
          // The webhook cleared the member's server cart, but it has no way
          // to reach a guest's browser-local one — so that happens here.
          if (!user) {
            clearLocalCart();
          }
          queryClient.invalidateQueries({ queryKey: ["cart", "server"] });
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          router.push(`/order-confirmation/${session.orderNumber}`);
        } else if (status.paymentStatus === "failed") {
          clearInterval(interval);
          setSession(null);
          idempotencyKey.current = crypto.randomUUID();
          queryClient.invalidateQueries({ queryKey: ["cart", "server"] });
          toast.error("That payment didn't go through. Your order is unchanged — please try again.");
        }
      } catch {
        // Transient network error: keep polling rather than tearing down a
        // payment the customer may be halfway through.
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session, queryClient, router, user, clearLocalCart]);

  const handleSessionExpired = useCallback(() => {
    setSession(null);
    idempotencyKey.current = crypto.randomUUID();
    queryClient.invalidateQueries({ queryKey: ["cart", "server"] });
    toast.error("The payment window expired and your items were released. Please try again.");
  }, [queryClient]);

  const placeOrderMutation = useMutation({
    mutationFn: () =>
      checkout({
        idempotencyKey: idempotencyKey.current,
        paymentMethod,
        paymentReference: paymentMethod === "instapay" ? paymentReference.trim() : null,
        couponCode: coupon?.code ?? null,
        ...(user
          ? { addressId: effectiveAddressId }
          : {
              email: guestEmail.trim() || null,
              shippingAddress: guestAddress,
              // The guest's order lives only in this browser, so it travels
              // with the request. The server re-prices every line before
              // charging anything.
              items: cartLinesToPayload(cart.items),
            }),
      }),
    onSuccess: (result) => {
      // Consumed by the order that was just placed (or is now mid-payment) —
      // re-applying it to a future order would fail server-side anyway since
      // each coupon is redeemable once per person.
      setCoupon(null);
      if (result.payment) {
        setSession({ ...result.payment, orderNumber: result.order.orderNumber });
        return;
      }
      setOrderPlaced(true);
      // A member's cart was emptied server-side; a guest's lives here, so it
      // has to be cleared locally or the items would still be in the cart on
      // the confirmation page.
      if (!user) {
        clearLocalCart();
      }
      queryClient.invalidateQueries({ queryKey: ["cart", "server"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      router.push(`/order-confirmation/${result.order.orderNumber}`);
    },
    onError: (err: unknown) => {
      const response = (err as { response?: { status?: number; data?: { message?: string } } })
        .response;
      toast.error(response?.data?.message ?? "Could not place your order — please try again");
      if (response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ["cart", "server"] });
      }
    },
  });

  // Switching method mid-flow abandons the in-progress payment session; the
  // backend sweeper releases its reservation.
  function handleSelectMethod(method: PaymentMethodType) {
    if (method === paymentMethod) return;
    if (session) {
      setSession(null);
      idempotencyKey.current = crypto.randomUUID();
    }
    setPaymentMethod(method);
  }

  // Only waits for auth to resolve — not for a session to exist. Rendering
  // before it settles would flash the guest form at a signed-in customer.
  if (userLoading) {
    return <PageSkeleton />;
  }

  // A member needs a saved address selected; a guest needs the fields they
  // typed to be complete. Both are re-validated server-side — this only
  // decides whether the button is worth enabling.
  //
  // Email is no longer one of them. It is still checked when given, and still
  // demanded when a coupon is applied — the server caps a guest's redemptions
  // by email, so without one the code has nothing to be counted against.
  const guestEmailUsable = guestEmail.trim() === "" ? !coupon : validEmail(guestEmail);
  const guestDetailsComplete =
    guestEmailUsable &&
    guestAddress.firstName.trim() !== "" &&
    guestAddress.lastName.trim() !== "" &&
    validPhone(guestAddress.phone) &&
    guestAddress.addressLine.trim() !== "";

  const deliveryReady = user ? !!effectiveAddressId : guestDetailsComplete;
  const paymentReady = paymentMethod !== "instapay" || paymentReference.trim().length >= 3;

  const canPlaceOrder =
    deliveryReady &&
    paymentReady &&
    cartIsClean &&
    !cartLoading && !cartError && cart.items.length > 0 &&
    total !== null &&
    !placeOrderMutation.isPending &&
    !session;

  const actionLabel = placeOrderMutation.isPending
    ? "Placing your order…"
    : paymentMethod === "card"
      ? "Continue to payment"
      : "Place order";

  if (cartError) return <div className="page-shell"><PageState title="We couldn't load your order" description="Your selections are saved. Please try again." onRetry={retryCart} /></div>;
  if (cartLoading && !cart.items.length) return <PageSkeleton />;
  const guidance = !deliveryReady ? (user ? (addressesQuery.data?.length ? "Choose a delivery address to continue." : "Add a delivery address to continue.") : (!user && coupon && guestEmail.trim() === "" ? "Add your email to use this coupon, or remove it to continue." : "Complete your name, mobile number and address to continue.")) : !paymentReady ? "Enter your payment reference to continue." : settingsQuery.isError ? "Delivery pricing could not be loaded. Please retry." : total === null ? "Loading delivery pricing…" : !cartIsClean ? "Please review the changes to your order." : "Review your details before placing your order.";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-40 sm:px-6 lg:pb-16">
      <h1 className="font-heading text-3xl font-black tracking-[-0.04em] sm:text-4xl">Checkout</h1>
      <nav aria-label="Order steps" className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground"><Link href="/menu"><T>Menu</T></Link><span aria-hidden>/</span><Link href="/cart"><T>Your order</T></Link><span aria-hidden>/</span><span aria-current="step" className="text-primary"><T>Checkout</T></span></nav>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-start lg:gap-6">
        <div className="grid gap-4">
          {!cartIsClean && <CartChangedBanner items={cart.items} />}

          <CheckoutCard
            title="Delivery details"
            icon={<MapPin className="size-5" strokeWidth={2.25} />}
          >
            {user ? (
              <AddressSection
                addresses={addressesQuery.data ?? []}
                selectedId={effectiveAddressId}
                onSelect={setSelectedAddressId}
                loading={addressesQuery.isLoading}
                accountName={{ firstName: user.firstName, lastName: user.lastName }}
              />
            ) : (
              <DeliveryDetailsSection
                address={guestAddress}
                onAddressChange={setGuestAddress}
                email={guestEmail}
                onEmailChange={setGuestEmail}
                signedInEmail={null}
                disabled={placeOrderMutation.isPending || !!session}
              />
            )}
          </CheckoutCard>

          <CheckoutCard
            title="Delivery time"
            icon={<Bike className="size-5" strokeWidth={2.25} />}
          >
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-foreground bg-foreground/[0.04] p-4">
              <div>
                <p className="text-[15px] font-black">As soon as possible</p>
                <p className="text-xs text-muted-foreground">
                  Usually {RESTAURANT.estimatedDelivery} from when we confirm your order
                </p>
              </div>
              <p className="shrink-0 text-sm font-black">
                {deliveryFee === null
                  ? "Loading…"
                  : deliveryFee === 0
                    ? "Free"
                    : formatPrice(deliveryFee)}
              </p>
            </div>
          </CheckoutCard>

          <CheckoutCard
            title="Payment"
            icon={<CreditCard className="size-5" strokeWidth={2.25} />}
          >
            <PaymentSection
              selected={paymentMethod}
              onSelect={handleSelectMethod}
              instapayAddress={instapayAddress}
              paymentReference={paymentReference}
              onPaymentReferenceChange={setPaymentReference}
              total={total}
              formatAmount={formatPrice}
              iframeUrl={session?.iframeUrl ?? null}
              expiresAt={session?.expiresAt ?? null}
              onExpire={handleSessionExpired}
              disabled={placeOrderMutation.isPending}
            />
          </CheckoutCard>

          <details className="rounded-2xl border bg-card p-5"><summary className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-bold"><Tag className="size-4 text-primary" aria-hidden /><T>Have a promo code?</T></summary><div className="pt-3">
            <CouponField
              items={cart.items}
              isAuthenticated={!!user}
              guestEmail={user ? null : guestEmail.trim()}
            />
          </div></details>
        </div>

        {/* The order itself stays visible beside the form on a large screen and
            sits under it on a phone, where the sticky bar below carries the
            total instead. */}
        <CheckoutCard
          title="Your order"
          icon={<ReceiptText className="size-5" strokeWidth={2.25} />}
          action={
            <Link href="/cart" className="text-sm font-bold text-primary hover:underline">
              Edit
            </Link>
          }
          className="lg:sticky lg:top-[calc(var(--header-height)+24px)]"
        >
          <OrderSummary
            items={cart.items}
            subtotal={cart.subtotal}
            shippingCost={deliveryFee}
            discountAmount={discountAmount}
            couponCode={coupon?.code ?? null}
            total={total}
          />

          <p id="checkout-guidance" role="status" className="mt-4 text-xs leading-6 text-muted-foreground"><T>{guidance}</T></p>
          {settingsQuery.isError && <button type="button" onClick={() => settingsQuery.refetch()} className="action-secondary mt-3"><T>Retry delivery pricing</T></button>}

          {session ? (
            <p className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
              Finish entering your card details above. We&apos;ll confirm your order automatically
              once the payment goes through.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => placeOrderMutation.mutate()}
              disabled={!canPlaceOrder}
              className="mt-5 hidden min-h-13 w-full items-center justify-between gap-3 rounded-full bg-primary px-6 text-sm font-black text-primary-foreground transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-45 lg:flex"
            >
              <span>{actionLabel}</span>
              <span>{total === null ? "" : formatPrice(total)}</span>
            </button>
          )}
        </CheckoutCard>
      </div>

      {/* The phone action bar. A food order ends in one tap on a button that
          is always on screen — not a submit button at the bottom of a long
          form the customer has to scroll back to. */}
      {!session && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur-md lg:hidden">
          {!canPlaceOrder && <p className="mb-2 text-center text-[11px] leading-5 text-muted-foreground"><T>{guidance}</T></p>}
          <button
            type="button"
            onClick={() => placeOrderMutation.mutate()}
            disabled={!canPlaceOrder}
            className="flex min-h-13 w-full items-center justify-between gap-3 rounded-full bg-primary px-6 text-sm font-black text-primary-foreground transition-transform enabled:active:scale-[0.99] disabled:opacity-45"
          >
            <span>{actionLabel}</span>
            <span>{total === null ? "" : formatPrice(total)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
