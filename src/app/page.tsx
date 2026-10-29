import type { Metadata } from "next";
import { MiranoHeader } from "@/components/MiranoHeader";
import { MiranoFooter } from "@/components/MiranoFooter";
import { MiranoHomeContent } from "@/components/MiranoHomeContent";
import { getPastryHomeData } from "@/lib/home-data";
import { ensureSeeded } from "@/lib/seed";
import { getSettings } from "@/lib/settings";
import { jsonLd, seoMetadata, siteBase } from "@/lib/seo";

const HOME_TITLE = "شیرین‌کده | مارکت‌پلیس لوازم قنادی و شیرینی‌پزی | میرانو";
const HOME_DESCRIPTION = "از قالب و ابزار پخت تا مواد اولیه و بسته‌بندی؛ خرید تخصصی لوازم قنادی با ارسال به سراسر کشور.";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return seoMetadata(settings, {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    keywords: "لوازم قنادی، ابزار شیرینی‌پزی، قالب کیک، مواد اولیه قنادی، بسته‌بندی شیرینی",
    path: "/",
  });
}

export default async function Home() {
  await ensureSeeded();
  const [data, settings] = await Promise.all([getPastryHomeData(), getSettings()]);
  return (
    <div className="mirano-storefront">
      <MiranoHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({
        "@context": "https://schema.org",
        "@type": "OnlineStore",
        name: "میرانو",
        description: HOME_DESCRIPTION,
        url: siteBase(settings.siteUrl).toString(),
        telephone: settings.supportPhone,
        currenciesAccepted: "IRR",
      }) }} />
      <MiranoHomeContent data={data} />
      <MiranoFooter />
    </div>
  );
}
