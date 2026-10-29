"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, Sparkles, X } from "lucide-react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const SESSION_NOTICE_KEY = "mahlegha-pwa-notice-shown";
const INSTALLED_KEY = "mahlegha-pwa-installed";
const INSTALLED_EVENT = "mahlegha-pwa-install-state";

function subscribeToInstalled(callback: () => void) {
  window.addEventListener(INSTALLED_EVENT, callback);
  return () => window.removeEventListener(INSTALLED_EVENT, callback);
}

function subscribeToIosSupport() {
  return () => {};
}

function sessionNoticeShown() {
  try { return sessionStorage.getItem(SESSION_NOTICE_KEY) === "1"; } catch { return false; }
}

function markSessionNoticeShown() {
  try { sessionStorage.setItem(SESSION_NOTICE_KEY, "1"); } catch { /* The notice still stays hidden until this component unmounts. */ }
}

function isInstalled() {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  try { return standalone || localStorage.getItem(INSTALLED_KEY) === "1"; } catch { return standalone; }
}

function markInstalled() {
  try { localStorage.setItem(INSTALLED_KEY, "1"); } catch { /* Standalone display mode still detects installed launches. */ }
  window.dispatchEvent(new Event(INSTALLED_EVENT));
}

function supportsIosInstall() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function PwaInstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const installed = useSyncExternalStore(subscribeToInstalled, isInstalled, () => false);
  const iosInstallAvailable = useSyncExternalStore(subscribeToIosSupport, supportsIosInstall, () => false);
  const showToast = !dismissed && !installed && (visible || (iosInstallAvailable && !sessionNoticeShown()));

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      if (isInstalled() || sessionNoticeShown()) return;
      setPrompt(event as InstallPrompt);
      markSessionNoticeShown();
      setVisible(true);
    };
    const onInstalled = () => {
      markInstalled();
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (!isInstalled() && iosInstallAvailable && !sessionNoticeShown()) {
      markSessionNoticeShown();
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [iosInstallAvailable]);

  async function install() {
    if (iosInstallAvailable) {
      setDismissed(true);
      setVisible(false);
      setIosHelp(true);
      return;
    }
    if (!prompt) return;
    const installPrompt = prompt;
    setDismissed(true);
    setVisible(false);
    setPrompt(null);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") markInstalled();
    } catch {
      // The browser may cancel or reject an install prompt; don't bring the toast back this session.
    }
  }

  function dismiss() {
    markSessionNoticeShown();
    setDismissed(true);
    setVisible(false);
    setPrompt(null);
  }

  if (installed) return null;

  return (
    <>
      {showToast && (
        <aside className="pwa-install-toast" role="status" aria-live="polite" dir="rtl">
          <span className="pwa-install-toast-icon"><Sparkles size={19} aria-hidden="true" /></span>
          <div className="pwa-install-toast-copy">
            <b>میرانو، همراه شیرینی‌پزی شما</b>
            <span>برای دسترسی سریع‌تر، فروشگاه را به صفحهٔ اصلی اضافه کن.</span>
          </div>
          <button type="button" className="pwa-install-toast-action" onClick={install}>
            {iosInstallAvailable ? <Share size={15} aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}
            {iosInstallAvailable ? "راهنما" : "نصب"}
          </button>
          <button type="button" className="pwa-install-toast-close" onClick={dismiss} aria-label="بستن اعلان نصب"><X size={17} /></button>
        </aside>
      )}
      {iosHelp && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/45 p-4 sm:items-center" onClick={() => setIosHelp(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            className="w-full max-w-sm rounded-3xl bg-white p-6 text-right shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-800"><Share className="h-6 w-6" /></div>
            <h2 id="pwa-install-title" className="text-lg font-black text-slate-900">افزودن میرانو به صفحهٔ اصلی</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">در Safari دکمهٔ اشتراک‌گذاری را بزنید و سپس «افزودن به صفحهٔ اصلی» را انتخاب کنید.</p>
            <button type="button" onClick={() => setIosHelp(false)} className="mt-5 w-full rounded-xl bg-rose-800 px-4 py-3 text-sm font-bold text-white">متوجه شدم</button>
          </section>
        </div>
      )}
    </>
  );
}
