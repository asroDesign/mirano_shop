import { LoginForm } from "@/components/LoginForm";
import { ensureSeeded } from "@/lib/seed";
import { getSettings } from "@/lib/settings";

export async function AuthPage({ initialIntent = "login" }: { initialIntent?: "login" | "register" }) {
  await ensureSeeded();
  const settings = await getSettings();
  return <main className="auth-page"><LoginForm siteName={settings.siteName} siteLogoMediaId={Number(settings.siteLogoMediaId)} initialIntent={initialIntent} /></main>;
}
