import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customerWalletEntries, customerWallets, users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { CustomerWalletManager } from "@/components/CustomerWalletManager";

export default async function AdminWalletPage() {
  await requirePage({ perm: "WITHDRAWALS_MANAGE" });
  const [customers, entries, [walletStats], [flowStats]] = await Promise.all([
    db.select({ id: users.id, name: users.name, phone: users.phone, balance: sql<number>`coalesce(${customerWallets.balance}, 0)::float8` })
      .from(users).leftJoin(customerWallets, eq(customerWallets.userId, users.id)).where(eq(users.role, "customer")).orderBy(desc(users.createdAt)).limit(1000),
    db.select({ id: customerWalletEntries.id, userId: users.id, customerName: users.name, phone: users.phone, amount: customerWalletEntries.amount, type: customerWalletEntries.type, description: customerWalletEntries.description, createdAt: customerWalletEntries.createdAt })
      .from(customerWalletEntries).innerJoin(users, eq(users.id, customerWalletEntries.userId)).orderBy(desc(customerWalletEntries.createdAt)).limit(300),
    db.select({ balance: sql<number>`coalesce(sum(${customerWallets.balance}), 0)::float8`, holders: sql<number>`count(*) filter (where ${customerWallets.balance} > 0)::int` }).from(customerWallets),
    db.select({ credits: sql<number>`coalesce(sum(case when ${customerWalletEntries.amount} > 0 then ${customerWalletEntries.amount} else 0 end), 0)::float8`, debits: sql<number>`coalesce(sum(case when ${customerWalletEntries.amount} < 0 then abs(${customerWalletEntries.amount}) else 0 end), 0)::float8` }).from(customerWalletEntries),
  ]);
  return <CustomerWalletManager
    customers={customers.map((customer) => ({ ...customer, balance: Number(customer.balance) }))}
    entries={entries.map((entry) => ({ ...entry, amount: Number(entry.amount), createdAt: entry.createdAt.toISOString() }))}
    stats={{ balance: Number(walletStats?.balance ?? 0), holders: Number(walletStats?.holders ?? 0), credits: Number(flowStats?.credits ?? 0), debits: Number(flowStats?.debits ?? 0) }}
  />;
}
