import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export function EtablissementSelector() {
  const [open, setOpen] = useState(false);
  const {
    etablissements,
    currentEtablissementId,
    setCurrentEtablissementId,
    isGlobal,
  } = useAuth();

  if (etablissements.length === 0) return null;

  // Single-establishment users: show as a static badge.
  if (!isGlobal && etablissements.length === 1) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" />
        <span className="max-w-[16rem] truncate">
          {etablissements[0].nom}
        </span>
      </div>
    );
  }

  const current = etablissements.find((e) => e.id === currentEtablissementId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          size="sm"
          aria-expanded={open}
          className="w-[16rem] justify-between"
        >
          <span className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">
              {current?.nom ?? "Choisir un établissement"}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[20rem] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher un établissement…" />
          <CommandList>
            <CommandEmpty>Aucun établissement</CommandEmpty>
            <CommandGroup>
              {etablissements.map((e) => (
                <CommandItem
                  key={e.id}
                  value={e.nom}
                  onSelect={() => {
                    setCurrentEtablissementId(e.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      currentEtablissementId === e.id
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  {e.nom}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
