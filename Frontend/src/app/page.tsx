import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChefHat, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { getBestSellersServer } from "@/lib/api/products";
import { getCategoryTreeServer } from "@/lib/api/categories";
import { DishCard } from "@/components/menu/dish-card";
import { T } from "@/i18n/language-provider";

export default async function Home() {
  const [sections, popular] = await Promise.all([getCategoryTreeServer(), getBestSellersServer()]);
  return <div className="pb-16">
    <section className="px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="relative mx-auto min-h-[460px] max-w-7xl overflow-hidden rounded-[2rem] bg-foreground sm:min-h-[520px] lg:min-h-[570px]">
        <Image src="/images/restaurant/hero.webp" alt="Burgers, crispy chicken and loaded fries" fill priority sizes="(max-width: 1280px) 100vw, 1280px" className="object-cover object-[center_35%] sm:object-center" />
        {/* Bottom-up scrim on phones, where the copy spans the full width; a
            side scrim from sm up, so the food stays visible beside the text.
            The side scrim flips in RTL because the copy moves to the right. */}
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(20,19,17,0.95)_0%,rgba(20,19,17,0.78)_45%,rgba(20,19,17,0.2)_100%)] sm:bg-[linear-gradient(90deg,rgba(20,19,17,0.92)_0%,rgba(20,19,17,0.7)_42%,rgba(20,19,17,0.12)_78%)] sm:rtl:bg-[linear-gradient(270deg,rgba(20,19,17,0.92)_0%,rgba(20,19,17,0.7)_42%,rgba(20,19,17,0.12)_78%)]" />

        <div className="relative z-10 flex min-h-[460px] max-w-xl flex-col justify-end p-6 text-white sm:min-h-[520px] sm:p-10 lg:min-h-[570px] lg:p-14">
          <div className="mb-auto flex flex-wrap gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs font-bold backdrop-blur-sm"><ShoppingBag className="size-3.5" aria-hidden /><T>Order direct. No account needed.</T></span>
          </div>
          <p className="eyebrow flex items-center gap-2 !text-[oklch(0.68_0.2_38)]"><span className="h-px w-7 bg-[oklch(0.68_0.2_38)]" /><T>Fresh from our kitchen</T></p>
          <h1 className="mt-4 font-heading text-[clamp(2.6rem,6vw,4.75rem)] leading-[1] font-extrabold"><T>Big flavour.</T><br /><span className="text-[oklch(0.68_0.2_38)]"><T>Your way.</T></span></h1>
          <p className="mt-4 max-w-md text-[15px] leading-7 text-white/80 sm:mt-5 sm:text-lg"><T>Burgers, crispy chicken and all the good sides. Made to order, delivered to your door.</T></p>
          <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:flex-wrap">
            <Link href="/menu" className="action-primary w-full sm:w-auto"><T>Explore the menu</T><ArrowRight className="size-4" aria-hidden /></Link>
            <Link href="/track-order" className="action-secondary w-full !border-white/25 !bg-white/10 !text-white backdrop-blur-sm hover:!bg-white/20 sm:w-auto"><T>Track an order</T></Link>
          </div>
        </div>
      </div>
    </section>

    <section className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-6 py-8 sm:grid-cols-3 sm:gap-8 sm:py-10">
      {[
        {icon: ChefHat, title:"Made to order", copy:"Prepared by our kitchen, just for you."},
        {icon: SlidersHorizontal, title:"Make it yours", copy:"Choose your extras and favourite sauces."},
        {icon: ShoppingBag, title:"Straight to your door", copy:"One simple order, from our kitchen to you."}
      ].map(({icon:Icon,title,copy})=><div key={title} className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary/65 text-primary"><Icon className="size-5" aria-hidden /></span>
        <div><h2 className="text-sm font-extrabold"><T>{title}</T></h2><p className="mt-0.5 text-xs leading-5 text-muted-foreground"><T>{copy}</T></p></div>
      </div>)}
    </section>

    <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow"><T>Find your favourite</T></p><h2 className="mt-2 font-heading text-3xl sm:text-4xl"><T>What are you craving?</T></h2></div>
        <Link href="/menu" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary"><T>See full menu</T><ArrowRight className="size-4" aria-hidden /></Link>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {sections.map(section=><Link key={section._id} href={`/menu#${section.slug}`} className="action-secondary"><T>{section.name}</T><ArrowRight className="size-3.5" aria-hidden /></Link>)}
      </div>
    </section>

    {popular.length > 0 && <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14">
      <div className="mb-6 flex items-end justify-between gap-4"><div><p className="eyebrow"><T>The crowd favourites</T></p><h2 className="mt-2 font-heading text-3xl sm:text-4xl"><T>Most ordered</T></h2></div></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{popular.slice(0,6).map(dish=><DishCard key={dish._id} product={dish} featured />)}</div>
    </section>}
    <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6">
      <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-foreground px-6 py-8 text-background sm:flex-row sm:items-center sm:p-10">
        <div><p className="text-xs font-bold uppercase tracking-widest text-background/65"><T>Something for everyone</T></p><h2 className="mt-2 font-heading text-2xl sm:text-3xl"><T>Make a meal of it.</T></h2><p className="mt-2 text-sm text-background/75"><T>Add a side, pick a drink, and settle in.</T></p></div>
        <Link href="/menu" className="action-primary shrink-0"><T>Build your order</T><ArrowRight className="size-4" aria-hidden /></Link>
      </div>
    </section>
  </div>;
}
