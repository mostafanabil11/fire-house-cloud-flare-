"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Plus } from "lucide-react";
import { createAddress } from "@/lib/api/addresses";
import { addressText } from "@/lib/address-text";
import type { Address } from "@/types/address";
import { AddressFormFields, EMPTY_ADDRESS_FORM, type AddressFormValues } from "./address-form-fields";

/**
 * A new-address form that starts off as filled in as it honestly can be.
 *
 * The name comes from the account, since that is who is ordering. The phone
 * comes from an address already in the book: it is the same person, and
 * retyping their own number is the kind of friction that loses an order. The
 * address line is deliberately left blank — it is the one thing that is
 * genuinely new, and a guessed one would be worse than an empty one.
 */
function prefilled(
  addresses: Address[],
  accountName?: { firstName: string; lastName: string },
): AddressFormValues {
  const known = addresses.find((address) => address.isDefault) ?? addresses[0];
  return {
    ...EMPTY_ADDRESS_FORM,
    firstName: accountName?.firstName ?? "",
    lastName: accountName?.lastName ?? "",
    phone: known?.phone ?? "",
  };
}

// The signed-in delivery step: pick a saved address, or add one to the book.
// Guests get DeliveryDetailsSection instead — same fields, but nowhere to
// save them to.
export function AddressSection({
  addresses,
  selectedId,
  onSelect,
  loading = false,
  accountName,
}: {
  addresses: Address[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** True while the address book is still being fetched. */
  loading?: boolean;
  /** The signed-in customer's name, used to start the form off filled in. */
  accountName?: { firstName: string; lastName: string };
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AddressFormValues>(() => prefilled(addresses, accountName));
  const queryClient = useQueryClient();

  // Derived, not seeded into state. It used to be `useState(addresses.length
  // === 0)`, which read the address book on the very first render — before
  // the query answering it had returned, so it was always empty and the form
  // always opened. Once the saved addresses arrived they appeared *above* a
  // blank form that stayed open, and a customer filling that form in and
  // pressing "Place order" (rather than "Save address") sent their food to
  // whichever saved address happened to be selected above.
  const showForm = formOpen || (!loading && addresses.length === 0);

  const createMutation = useMutation({
    mutationFn: createAddress,
    onSuccess: (address) => {
      queryClient.setQueryData<Address[]>(["addresses"], (prev) => [...(prev ?? []), address]);
      onSelect(address._id);
      setFormOpen(false);
      setForm(prefilled([...addresses, address], accountName));
      toast.success("Address added");
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Could not save address";
      toast.error(message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      addressLine: form.addressLine,
      isDefault: addresses.length === 0,
    });
  }

  return (
    <div>
      {addresses.length > 0 && (
        <div role="radiogroup" aria-label="Saved addresses" className="grid gap-2.5">
          {addresses.map((address) => {
            const isSelected = selectedId === address._id;
            return (
              <button
                key={address._id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelect(address._id)}
                className={`flex w-full items-start gap-3.5 rounded-2xl border p-4 text-left transition-colors ${
                  isSelected
                    ? "border-foreground bg-foreground/[0.04] ring-2 ring-foreground/15"
                    : "border-border bg-background hover:border-foreground/30"
                }`}
              >
                <span
                  aria-hidden
                  className={`grid size-10 shrink-0 place-items-center rounded-full ${
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <MapPin className="size-5" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-black">
                      {address.firstName} {address.lastName}
                    </span>
                    {address.isDefault && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-black tracking-wide text-muted-foreground uppercase">
                        Default
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                    {addressText(address)}
                  </span>
                  <span className="block text-sm text-muted-foreground">{address.phone}</span>
                </span>
              </button>
            );
          })}

          {!showForm && (
            <button
              type="button"
              // Filled in here rather than at mount: the address book has not
              // arrived yet on the first render, so there is no phone number
              // to carry over until the customer actually asks for the form.
              onClick={() => {
                setForm(prefilled(addresses, accountName));
                setFormOpen(true);
              }}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm font-bold text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            >
              <Plus className="size-4" strokeWidth={2.5} aria-hidden />
              Deliver somewhere else
            </button>
          )}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className={`space-y-4 ${addresses.length > 0 ? "mt-5 border-t border-border pt-5" : ""}`}
        >
          <AddressFormFields
            value={form}
            onChange={setForm}
            idPrefix="saved"
            disabled={createMutation.isPending}
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex min-h-12 items-center rounded-full bg-primary px-6 text-sm font-black text-primary-foreground transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-50"
            >
              {createMutation.isPending ? "Saving…" : "Save address"}
            </button>
            {addresses.length > 0 && (
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="inline-flex min-h-12 items-center px-4 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
