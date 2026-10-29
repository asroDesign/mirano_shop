"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpLeft, Search, Wallet, WalletCards } from "lucide-react";
import { api, toast } from "./client";
import { Card, PageHeader, Stat } from "./ui";

type Customer = { id: number; name: string; phone: string; balance: number };
type Entry = { id: number; userId: number; customerName: string; phone: string; amount: number; type: string; description: string; createdAt: string };
type Stats = { balance: number; holders: number; credits: number; debits: number };
type ChargeResult = { entry: Entry; balance: number };

const toman = (amount: number) => `${Number(amount || 0).toLocaleString("fa-IR")} تومان`;
const ENTRY_LABELS: Record<string, string> = {
  admin_charge: "شارژ مدیر", charge: "شارژ", credit: "واریز", points: "تبدیل امتیاز",
  withdrawal: "برداشت", withdrawal_refund: "بازگشت برداشت", order_payment: "پرداخت سفارش", refund: "بازپرداخت",
};

export function CustomerWalletManager({ customers: initialCustomers, entries: initialEntries, stats: initialStats }: { customers: Customer[]; entries: Entry[]; stats: Stats }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [entries, setEntries] = useState(initialEntries);
  const [stats, setStats] = useState(initialStats);
  const [customerSearch, setCustomerSearch] = useState("");
  const [entrySearch, setEntrySearch] = useState("");
  const [direction, setDirection] = useState("all");
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const visibleCustomers = useMemo(() => {
    const query = customerSearch.trim().toLocaleLowerCase();
    if (!query) return customers.slice(0, 100);
    return customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.id}`.toLocaleLowerCase().includes(query)).slice(0, 100);
  }, [customerSearch, customers]);
  const visibleEntries = useMemo(() => {
    const query = entrySearch.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
      const matchesDirection = direction === "all" || (direction === "credit" ? entry.amount > 0 : entry.amount < 0);
      const matchesSearch = !query || `${entry.customerName} ${entry.phone} ${entry.description} ${entry.userId}`.toLocaleLowerCase().includes(query);
      return matchesDirection && matchesSearch;
    });
  }, [direction, entries, entrySearch]);

  const charge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(amount);
    if (!customerId || !Number.isSafeInteger(value) || value <= 0) {
      toast("مشتری و مبلغ معتبر را انتخاب کنید", false);
      return;
    }
    setBusy(true);
    try {
      const result = await api<ChargeResult>("/api/admin/customer-wallet/charge", "POST", { customerId: Number(customerId), amount: value, description });
      const previousBalance = customers.find((customer) => customer.id === result.entry.userId)?.balance ?? 0;
      setEntries((current) => [result.entry, ...current.filter((entry) => entry.id !== result.entry.id)].slice(0, 300));
      setCustomers((current) => current.map((customer) => customer.id === result.entry.userId ? { ...customer, balance: result.balance } : customer));
      setStats((current) => ({ ...current, balance: current.balance + value, credits: current.credits + value, holders: current.holders + (previousBalance > 0 ? 0 : 1) }));
      setAmount("");
      setDescription("");
      toast("کیف پول مشتری با موفقیت شارژ شد");
    } catch (error) {
      toast((error as Error).message, false);
    } finally {
      setBusy(false);
    }
  };

  return <div className="space-y-5">
    <PageHeader title="کیف پول مشتریان" subtitle="مشاهدهٔ موجودی و گردش حساب مشتریان، همراه با ثبت شارژ دستی" />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="کل اعتبار کیف پول‌ها" value={toman(stats.balance)} icon={Wallet} tone="green" />
      <Stat label="مشتریان دارای موجودی" value={stats.holders.toLocaleString("fa-IR")} icon={WalletCards} tone="violet" />
      <Stat label="مجموع واریزهای ثبت‌شده" value={toman(stats.credits)} icon={ArrowDownLeft} tone="blue" />
      <Stat label="مجموع برداشت‌ها" value={toman(stats.debits)} icon={ArrowUpLeft} tone="yellow" />
    </div>

    <Card title="شارژ کیف پول توسط مدیر">
      <form onSubmit={charge} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(15rem,1.3fr)_minmax(11rem,.8fr)_minmax(13rem,1fr)_auto] xl:items-end">
        <label className="block text-xs font-bold text-slate-600">جست‌وجوی مشتری
          <div className="relative mt-1.5"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400"/><input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} className="input pr-9" placeholder="نام، شماره موبایل یا شناسه" /></div>
        </label>
        <label className="block text-xs font-bold text-slate-600">انتخاب مشتری
          <select className="input mt-1.5" value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
            <option value="">انتخاب کنید</option>
            {visibleCustomers.map((customer) => <option key={customer.id} value={customer.id}>#{customer.id} · {customer.name} · {customer.phone} · موجودی {customer.balance.toLocaleString("fa-IR")}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold text-slate-600">مبلغ (تومان)
          <input className="input mt-1.5" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="مثلاً ۵۰۰٬۰۰۰" required />
        </label>
        <button type="submit" disabled={busy || !customerId || !amount} className="btn-primary min-h-11">{busy ? "در حال ثبت…" : "ثبت شارژ"}</button>
        <label className="block text-xs font-bold text-slate-600 md:col-span-2 xl:col-span-4">توضیحات (اختیاری)
          <input className="input mt-1.5" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} placeholder="علت یا یادداشت شارژ را بنویسید" />
        </label>
      </form>
      <p className="mt-3 text-[11px] leading-6 text-slate-400">شارژ به‌صورت تراکنش مثبت در دفترکل ثبت می‌شود، در گزارش ممیزی می‌آید و به مشتری اطلاع‌رسانی می‌شود.</p>
    </Card>

    <Card title="گردش کیف پول" action={<span className="text-xs text-slate-400">{visibleEntries.length.toLocaleString("fa-IR")} تراکنش از {entries.length.toLocaleString("fa-IR")}</span>}>
      <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="relative"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400"/><input className="input pr-9" value={entrySearch} onChange={(event) => setEntrySearch(event.target.value)} placeholder="جست‌وجو در مشتری، موبایل و توضیحات" /></div>
        <select className="input" value={direction} onChange={(event) => setDirection(event.target.value)} aria-label="فیلتر نوع گردش">
          <option value="all">همهٔ تراکنش‌ها</option><option value="credit">واریزها</option><option value="debit">برداشت‌ها</option>
        </select>
      </div>
      {visibleEntries.length ? <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-right text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">مشتری</th><th className="px-4 py-3 font-medium">نوع</th><th className="px-4 py-3 font-medium">مبلغ</th><th className="px-4 py-3 font-medium">توضیحات</th><th className="px-4 py-3 font-medium">تاریخ</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{visibleEntries.map((entry) => <tr key={entry.id} className="hover:bg-slate-50/70">
            <td className="px-4 py-3"><div className="font-bold text-slate-800">{entry.customerName}</div><div className="mt-0.5 text-xs text-slate-400" dir="ltr">{entry.phone} · #{entry.userId}</div></td>
            <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${entry.amount >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{ENTRY_LABELS[entry.type] ?? entry.type}</span></td>
            <td className={`whitespace-nowrap px-4 py-3 font-black ${entry.amount >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{entry.amount > 0 ? "+" : ""}{toman(entry.amount)}</td>
            <td className="max-w-[18rem] truncate px-4 py-3 text-slate-500" title={entry.description}>{entry.description || "—"}</td>
            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString("fa-IR")}</td>
          </tr>)}</tbody>
        </table>
      </div> : <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">تراکنشی با این فیلتر پیدا نشد.</div>}
      <p className="mt-3 text-[11px] text-slate-400">آخرین {entries.length.toLocaleString("fa-IR")} تراکنش نمایش داده شده است.</p>
    </Card>
  </div>;
}
