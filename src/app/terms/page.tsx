import { permanentRedirect } from "next/navigation";

export default function LegacyTermsPage(): never {
  permanentRedirect("/terms-conditions");
}
