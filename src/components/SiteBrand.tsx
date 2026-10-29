import { Flower2 } from "lucide-react";
export function SiteBrand({ name, logoMediaId = 0, iconClassName = "h-5 w-5", boxClassName = "h-11 w-11" }: { name: string; logoMediaId?: number; iconClassName?: string; boxClassName?: string }) {
  return <span className={`${boxClassName} grid shrink-0 place-items-center overflow-hidden rounded-2xl boutique-brand text-white`}>{logoMediaId > 0 ? <img src={`/api/media/${logoMediaId}`} alt={name} className="h-full w-full object-contain" /> : <Flower2 className={iconClassName} />}</span>;
}
