import { requirePage } from "@/lib/auth";
import LocationsManager from "@/components/LocationsManager";

export default async function LocationsPage() {
  await requirePage({ perm: "SETTINGS_MANAGE" });
  return <LocationsManager/>;
}
