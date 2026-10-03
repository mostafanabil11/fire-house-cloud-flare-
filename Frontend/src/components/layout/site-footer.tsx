import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { T } from "@/i18n/language-provider";
import { RESTAURANT } from "@/config/restaurant";
export function SiteFooter() {
  return <footer className="mt-auto bg-foreground text-background">
    <div className="mx-auto max-w-7xl px-5 pt-10 pb-24 sm:px-6 md:pb-7">
      <div className="grid gap-8 md:grid-cols-[1.6fr_1fr_1fr] md:gap-16">
        <div><p className="flex items-center gap-2.5 font-heading text-2xl"><span className="grid size-9 place-items-center rounded-xl bg-background"><Image src="/images/brand/fire-house-mark.webp" alt="" width={28} height={28} className="size-7 object-contain" /></span><T>{RESTAURANT.name}</T></p><p className="mt-3 max-w-xs text-sm leading-7 text-background/65"><T>Good food, made your way. Order directly from our kitchen for your next favourite meal.</T></p></div>
        <div className="grid grid-cols-2 gap-6 md:contents">
          <FooterColumn title="Your next meal" links={[["/menu","Menu"],["/cart","Your order"],["/track-order","Track order"],["/account/orders","My orders"]]} />
          <FooterColumn title="Here to help" links={[["/contact","Contact"],["/faq","FAQ"],["/shipping-returns","Delivery information"]]} />
        </div>
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-white/15 pt-5 text-[11px] text-background/65">
        <p>© {new Date().getFullYear()} <T>{RESTAURANT.name}</T>. <T>All rights reserved.</T></p>
        <div className="flex flex-wrap gap-5"><Link href="/terms" className="py-2 hover:text-white"><T>Terms</T></Link><Link href="/privacy" className="py-2 hover:text-white"><T>Privacy</T></Link>{RESTAURANT.instagram && <a href={RESTAURANT.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}{RESTAURANT.facebook && <a href={RESTAURANT.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>}</div>
      </div>
    </div>
  </footer>;
}
function FooterColumn({title,links}:{title:string;links:string[][]}) {
 return <div><h2 className="mb-3 text-xs font-bold text-background/50"><T>{title}</T></h2><ul>{links.map(([href,label])=><li key={href}><Link href={href} className="group inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-background/85 hover:text-white"><T>{label}</T><ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden /></Link></li>)}</ul></div>;
}
