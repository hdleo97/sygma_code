import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";

import { getPhotoUrl } from "@/lib/equipements";
import { cn } from "@/lib/utils";

export function EquipementPhoto({
  path,
  alt,
  className,
}: {
  path: string | null;
  alt: string;
  className?: string;
}) {
  const { data: url } = useQuery({
    queryKey: ["equipement-photo", path],
    queryFn: () => getPhotoUrl(path),
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
  });

  if (!path || !url) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="h-5 w-5" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={cn("rounded-md border border-border object-cover", className)}
    />
  );
}
