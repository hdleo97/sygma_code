import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExportFormat } from "@/lib/exports";

export function ExportMenu({
  onExport,
  disabled,
  label = "Exporter",
}: {
  onExport: (format: ExportFormat) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Download className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onExport("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport("csv")}>CSV (.csv)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport("pdf")}>PDF (.pdf)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
