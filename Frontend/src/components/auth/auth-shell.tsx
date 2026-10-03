import Image from "next/image";
import type { ReactNode } from "react";
import { Clock3, ShieldCheck, UtensilsCrossed } from "lucide-react";
import { RESTAURANT } from "@/config/restaurant";

const SELLING_POINTS = [
  { icon: UtensilsCrossed, text: "Reorder your favourites in two taps" },
  { icon: Clock3, text: `Delivery in about ${RESTAURANT.estimatedDelivery}` },
  { icon: ShieldCheck, text: "Your addresses saved for next time" },
];

/**
 * The frame every auth screen sits in.
 *
 * Mobile gets the form and nothing else — the food photograph is a 2 MB asset
 * that would push the password field below the fold on a phone, which is
 * where most people sign in. From `lg` up there is room for both, so the
 * picture returns as a column beside the form rather than above it.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <Image
          src="/images/restaurant/menu-hero.webp"
          alt=""
          fill
          className="object-cover"
          sizes="50vw"
          priority
        />
        {/* Dark at the top, clear at the bottom. The photograph puts the food
            in its lower half, so the copy sits over the blurred restaurant
            interior above it and the dishes stay visible underneath. */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,19,17,0.92)_0%,rgba(20,19,17,0.72)_38%,rgba(20,19,17,0.15)_70%,rgba(20,19,17,0)_100%)]" />

        <div className="relative flex h-full flex-col justify-start p-12 text-white">
          <p className="text-sm font-black tracking-[0.18em] text-[#ff7a5c] uppercase">
            {RESTAURANT.name}
          </p>
          <p className="mt-3 max-w-sm font-heading text-4xl leading-[1.05] font-black tracking-[-0.04em]">
            Good food, ordered direct.
          </p>
          <ul className="mt-8 grid gap-3">
            {SELLING_POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <li key={point.text} className="flex items-center gap-3 text-sm font-semibold text-white/80">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/12 backdrop-blur-sm">
                    <Icon className="size-4" strokeWidth={2.25} aria-hidden />
                  </span>
                  {point.text}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="flex flex-col justify-center px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto w-full max-w-md">

          <h1 className="font-heading text-3xl font-black tracking-[-0.04em] sm:text-4xl">{title}</h1>
          <p className="mt-2 text-base leading-7 text-muted-foreground">{subtitle}</p>

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-8">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
