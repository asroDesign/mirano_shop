"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Smartphone, KeyRound, ArrowRight, ShieldCheck, Pencil, LockKeyhole, BadgeCheck } from "lucide-react";
import { api } from "./client";
import { SiteBrand } from "./SiteBrand";
import ProvinceCitySelect from "./ProvinceCitySelect";

const toEn = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

export function LoginForm({ siteName, siteLogoMediaId = 0, initialIntent = "login" }: { siteName: string; siteLogoMediaId?: number; initialIntent?: "login" | "register" }) {
  const router = useRouter();
  const [authIntent, setAuthIntent] = useState<"login" | "register">(initialIntent);
  const [mode, setMode] = useState<"otp" | "password">("otp");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", ""]);
  const [info, setInfo] = useState<{ isNew: boolean; canSellerSignup: boolean; devCode?: string } | null>(null);
  const [name, setName] = useState("");
  const [asSeller, setAsSeller] = useState(false);
  const [shop, setShop] = useState({ shopName: "", province: "", city: "" });
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [timer, setTimer] = useState(0);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const sellerIntent = () => new URLSearchParams(window.location.search).get("seller") === "1";

  useEffect(() => { if (timer <= 0) return; const t = setTimeout(() => setTimer(timer - 1), 1000); return () => clearTimeout(t); }, [timer]);
  const next = () => { const n = new URLSearchParams(window.location.search).get("next"); return n && n.startsWith("/") && !n.startsWith("//") ? n : null; };

  const request = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await api<{ isNew: boolean; canSellerSignup: boolean; devCode?: string }>("/api/auth/otp/request", "POST", { phone: toEn(phone), sellerIntent: sellerIntent() });
      if (authIntent === "register" && !r.isNew) setAuthIntent("login");
      setInfo(r); setStep("code"); setTimer(60); setDigits(r.devCode ? r.devCode.split("") : ["", "", "", "", ""]);
      if (authIntent === "register" && !r.isNew) setErr("برای این شماره قبلاً حساب ساخته شده؛ با همان کد وارد شوید.");
      setTimeout(() => refs.current[r.devCode ? 4 : 0]?.focus(), 50);
    } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };
  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = digits.join("");
    if (code.length !== 5) { setErr("کد ۵ رقمی را کامل وارد کنید"); return; }
    setBusy(true); setErr("");
    try {
      const referralCode = new URLSearchParams(window.location.search).get("ref") || "";
      const r = await api<{ redirect: string }>("/api/auth/otp/verify", "POST", { phone: toEn(phone), code, name, asSeller, sellerIntent: sellerIntent(), referralCode, ...shop });
      router.push(next() ?? r.redirect); router.refresh();
    } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };
  const pwLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { const r = await api<{ redirect: string }>("/api/auth/login", "POST", { phone: toEn(phone), password }); router.push(next() ?? r.redirect); router.refresh(); }
    catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };
  const setDigit = (i: number, v: string) => {
    const clean = toEn(v).replace(/\D/g, "");
    if (clean.length > 1) { const arr = clean.slice(0, 5).split(""); setDigits([...arr, ...Array(5 - arr.length).fill("")]); refs.current[Math.min(4, arr.length)]?.focus(); return; }
    const d = [...digits]; d[i] = clean; setDigits(d);
    if (clean && i < 4) refs.current[i + 1]?.focus();
  };
  const ready = digits.join("").length === 5 && (!info?.isNew || name.trim().length >= 2);

  const changeIntent = (intent: "login" | "register") => {
    setAuthIntent(intent); setMode("otp"); setStep("phone"); setInfo(null); setErr("");
  };

  return (
    <div className="auth-card">
      <section className="auth-form-panel">
        <Link href="/" className="auth-brand"><SiteBrand name="میرانو" logoMediaId={siteLogoMediaId}/><span>میرانو<small>فروشگاه لوازم قنادی و شیرینی‌پزی</small></span></Link>
        {mode === "otp" && step === "phone" && <div className="auth-tabs" role="tablist" aria-label="ورود یا ساخت حساب">
          <button type="button" role="tab" aria-selected={authIntent === "login"} className={authIntent === "login" ? "is-active" : ""} onClick={() => changeIntent("login")}>ورود</button>
          <button type="button" role="tab" aria-selected={authIntent === "register"} className={authIntent === "register" ? "is-active" : ""} onClick={() => changeIntent("register")}>ساخت حساب</button>
        </div>}
        {mode === "otp" ? (
          step === "phone" ? (
            <form onSubmit={request} className="auth-form">
              <div><span className="auth-kicker">{authIntent === "register" ? "به جمع ما خوش آمدید" : "به میرانو خوش برگشتید"}</span><h1>{authIntent === "register" ? "ساخت حساب کاربری" : "ورود به حساب"}</h1><p>شماره موبایلتان را وارد کنید تا کد امن ورود برایتان پیامک شود.</p></div>
              <label className="auth-field"><span>شماره موبایل</span><span className="auth-input-wrap"><Smartphone aria-hidden="true"/><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel-national" required placeholder="09xxxxxxxxx" dir="ltr" /></span></label>
              {err && <div role="alert" className="auth-error">{err}</div>}
              <button disabled={busy} className="auth-submit">{busy ? <Loader2 className="size-5 animate-spin" /> : <ArrowRight className="size-5 rotate-180" />}دریافت کد تأیید</button>
              <p className="auth-terms">با ادامه، <Link href="/faq">شرایط و قوانین</Link> {siteName} را می‌پذیرید.</p>
            </form>
          ) : (
            <form onSubmit={verify} className="auth-form">
              <button type="button" onClick={() => { setStep("phone"); setErr(""); }} className="auth-back"><ArrowRight className="size-4"/>تغییر شماره</button>
              <div><span className="auth-kicker">تأیید شماره تلفن</span><h1>کد پیامک‌شده را وارد کنید</h1><p className="auth-phone-line">کد ۵ رقمی به <b dir="ltr">{toEn(phone)}</b> ارسال شد<button type="button" onClick={() => setStep("phone")} aria-label="ویرایش شماره"><Pencil className="size-3.5"/></button></p></div>
              {info?.devCode && <div className="auth-note">سرویس پیامک تنظیم نشده؛ کد آزمایشی <b dir="ltr" className="font-mono">{info.devCode}</b> وارد شد.</div>}
              <div className="auth-code" dir="ltr">
                {digits.map((d, i) => <input key={i} ref={(el) => { refs.current[i] = el; }} value={d} inputMode="numeric" maxLength={5} aria-label={`رقم ${i + 1} کد`} autoComplete={i === 0 ? "one-time-code" : "off"} onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => { if (e.key === "Backspace" && !d && i > 0) refs.current[i - 1]?.focus(); }} className={d ? "has-value" : ""} />)}
              </div>
              {info?.isNew && <div className="auth-new-user"><b>برای ساخت حسابت، نامت را بنویس</b><input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام و نام خانوادگی" className="input" />{info.canSellerSignup && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={asSeller} onChange={(e) => setAsSeller(e.target.checked)} />همکاری به عنوان فروشنده</label>}{asSeller && <div className="grid gap-2 sm:grid-cols-2"><input value={shop.shopName} onChange={(e) => setShop({ ...shop, shopName: e.target.value })} placeholder="نام فروشگاه" className="input"/><ProvinceCitySelect province={shop.province} city={shop.city} onProvince={(province) => setShop((value) => ({ ...value, province, city: "" }))} onCity={(city) => setShop((value) => ({ ...value, city }))} required /></div>}</div>}
              {err && <div role="alert" className="auth-error">{err}</div>}
              <button disabled={busy || !ready} className="auth-submit">{busy ? <Loader2 className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />}{info?.isNew ? "تأیید و ساخت حساب" : "تأیید و ورود"}</button>
              <div className="auth-resend">{timer > 0 ? <span>ارسال دوباره کد تا <b>{timer.toLocaleString("fa-IR")}</b> ثانیهٔ دیگر</span> : <button type="button" onClick={() => request()}>ارسال دوبارهٔ کد</button>}</div>
            </form>
          )
        ) : (
          <form onSubmit={pwLogin} className="auth-form">
            <div><span className="auth-kicker">ورود امن</span><h1>ورود با رمز عبور</h1><p>این روش برای کارکنان و کاربرانی است که رمز عبور دارند.</p></div>
            <label className="auth-field"><span>شماره موبایل</span><input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="09xxxxxxxxx" className="input !h-12" dir="ltr" /></label>
            <label className="auth-field"><span>رمز عبور</span><input value={password} onChange={(e) => setPassword(e.target.value)} required type="password" placeholder="رمز عبور" className="input !h-12" dir="ltr" /></label>
            {err && <div role="alert" className="auth-error">{err}</div>}
            <button disabled={busy} className="auth-submit">{busy && <Loader2 className="size-5 animate-spin"/>}ورود</button>
          </form>
        )}
        <button type="button" onClick={() => { setMode(mode === "otp" ? "password" : "otp"); setStep("phone"); setErr(""); }} className="auth-password-toggle">{mode === "otp" ? <><KeyRound className="size-4"/>ورود با رمز عبور</> : <><Smartphone className="size-4"/>ورود با کد یک‌بارمصرف</>}</button>
      </section>
      <aside className="auth-story">
        <div className="auth-story-image" role="img" aria-label="ابزار و مواد اولیهٔ قنادی میرانو" />
        <div className="auth-story-shade" />
        <Link href="/" className="auth-story-top"><LockKeyhole className="size-4"/> خرید امن و مطمئن</Link>
        <div className="auth-story-copy"><span>MIRANO · BAKING SUPPLIES</span><h2>شیرینی‌پزی<br/>با ابزار درست.</h2><p>ابزار و مواد اولیهٔ تخصصی برای پختی دقیق‌تر و شیرین‌تر.</p><div className="auth-story-points"><span><BadgeCheck/>ابزار مناسب برای هر مرحله از پخت</span><span><ShieldCheck/>پرداخت و خرید امن</span></div></div>
        <Link href="/shop" className="auth-story-link">دیدن تازه‌رسیده‌ها <ArrowRight className="size-4 rotate-180"/></Link>
      </aside>
    </div>
  );
}
