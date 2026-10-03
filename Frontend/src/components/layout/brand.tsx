import Image from "next/image";
import Link from "next/link";
import { T } from "@/i18n/language-provider";
import { RESTAURANT } from "@/config/restaurant";

export function Brand() {
  return <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5" aria-label="Fire House home">
    <Image src="/images/brand/fire-house-mark.webp" alt="" width={40} height={40} className="size-10 shrink-0 object-contain" />
    <span className="whitespace-nowrap font-heading text-base font-extrabold sm:text-xl"><T>{RESTAURANT.name}</T><span className="block text-[9px] font-semibold tracking-[.2em] uppercase text-muted-foreground"><T>Kitchen & delivery</T></span></span>
  </Link>;
}
