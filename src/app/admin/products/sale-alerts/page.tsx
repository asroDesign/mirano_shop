import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { Badge, PageHeader, Table, Td } from "@/components/ui";
import { db } from "@/db";
import { productAlertDeliveries, productAlertEvents, productAlertSubscriptions, productVariants, products } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { faNum, jdate } from "@/lib/util";

export default async function SaleAlertSubscriptionsPage() {
  await requirePage({ perm: "PRODUCTS_VIEW" });
  const [subscriptions, deliveries] = await Promise.all([
    db.select({ subscription: productAlertSubscriptions, productName: products.nameFa, variantTitle: productVariants.title, latestStatus: sql<string | null>`(select d.status from product_alert_deliveries d join product_alert_events e on e.id = d.event_id where d.subscription_id = ${productAlertSubscriptions.id} and e.event_type = 'price_drop' order by d.created_at desc limit 1)` })
      .from(productAlertSubscriptions).innerJoin(products, eq(products.id, productAlertSubscriptions.productId)).leftJoin(productVariants, eq(productVariants.id, productAlertSubscriptions.variantId))
      .where(and(eq(productAlertSubscriptions.active, true), eq(productAlertSubscriptions.alertPriceDrop, true))).orderBy(desc(productAlertSubscriptions.createdAt)).limit(500),
    db.select({ phone: productAlertSubscriptions.phone, productName: products.nameFa, status: productAlertDeliveries.status, createdAt: productAlertDeliveries.createdAt })
      .from(productAlertDeliveries).innerJoin(productAlertSubscriptions, eq(productAlertSubscriptions.id, productAlertDeliveries.subscriptionId)).innerJoin(productAlertEvents, eq(productAlertEvents.id, productAlertDeliveries.eventId)).innerJoin(products, eq(products.id, productAlertEvents.productId))
      .where(eq(productAlertEvents.eventType, "price_drop")).orderBy(desc(productAlertDeliveries.createdAt)).limit(100),
  ]);
  return <>
    <PageHeader title="اعلان‌های تخفیف محصولات" subtitle={`${faNum(subscriptions.length)} اشتراک فعال؛ مشتریان پس از کاهش قیمت پیامک می‌گیرند`} actions={<Link href="/admin/products/stock-alerts" className="btn-ghost">اعلان‌های موجودی</Link>} />
    <Table head={["محصول / تنوع", "شماره مشتری", "تاریخ ثبت", "وضعیت"]} empty={!subscriptions.length}>
      {subscriptions.map(({ subscription, productName, variantTitle, latestStatus }) => <tr key={subscription.id}>
        <Td><b>{productName}</b>{subscription.variantId > 0 && <div className="text-xs text-slate-500">{variantTitle ?? "تنوع حذف‌شده"}</div>}</Td>
        <Td><span dir="ltr">{subscription.phone}</span></Td>
        <Td>{jdate(subscription.createdAt, true)}</Td>
        <Td><Badge tone={latestStatus === "sent" ? "blue" : latestStatus === "simulated" || latestStatus === "pending" || latestStatus === "processing" ? "yellow" : latestStatus === "failed" ? "red" : "green"}>{latestStatus === "sent" ? "آخرین پیام ارسال شد" : latestStatus === "simulated" ? "ارسال آزمایشی" : latestStatus === "pending" || latestStatus === "processing" ? "در صف ارسال" : latestStatus === "failed" ? "ارسال ناموفق" : "در انتظار تخفیف"}</Badge></Td>
      </tr>)}
    </Table>
    <h2 className="mb-3 mt-8 text-lg font-extrabold text-slate-800">ارسال‌های اخیر</h2>
    <Table head={["محصول", "شماره مشتری", "وضعیت پیامک", "تاریخ"]} empty={!deliveries.length}>
      {deliveries.map((delivery, index) => <tr key={`${delivery.phone}:${delivery.createdAt.toISOString()}:${index}`}>
        <Td>{delivery.productName}</Td><Td><span dir="ltr">{delivery.phone}</span></Td>
        <Td><Badge tone={delivery.status === "sent" ? "green" : delivery.status === "simulated" ? "yellow" : delivery.status === "pending" || delivery.status === "processing" ? "yellow" : "red"}>{delivery.status === "sent" ? "ارسال شد" : delivery.status === "simulated" ? "آزمایشی" : delivery.status === "pending" || delivery.status === "processing" ? "در صف ارسال" : "ناموفق"}</Badge></Td>
        <Td>{jdate(delivery.createdAt, true)}</Td>
      </tr>)}
    </Table>
  </>;
}
