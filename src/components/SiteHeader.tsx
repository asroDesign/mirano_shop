import { MiranoHeader } from "./MiranoHeader";

export function SiteHeader({ minimal = false }: { minimal?: boolean } = {}) {
  return <MiranoHeader minimal={minimal} />;
}
