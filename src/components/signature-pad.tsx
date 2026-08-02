import { Eraser } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  /** Signature déjà apposée (data URL PNG). Si présente, le canvas est verrouillé. */
  value: string | null;
  disabled?: boolean;
  onSign: (dataUrl: string) => void;
  label: string;
  signedAt?: string | null;
  signedBy?: string | null;
  isPending?: boolean;
};

export function SignaturePad({
  value,
  disabled,
  onSign,
  label,
  signedAt,
  signedBy,
  isPending,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || value) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
  }, [value]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || value) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasStroke(true);
  };

  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        {value && signedAt && (
          <span className="text-xs text-muted-foreground">
            Signé le {new Date(signedAt).toLocaleString("fr-FR")}
          </span>
        )}
      </div>

      {value ? (
        <div className="mt-3">
          <img
            src={value}
            alt={`Signature — ${label}`}
            className="h-32 w-full rounded-md border border-border bg-background object-contain"
          />
          {signedBy && (
            <p className="mt-2 text-xs text-muted-foreground">Par {signedBy}</p>
          )}
        </div>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            className={`mt-3 h-32 w-full touch-none rounded-md border border-dashed border-border bg-background ${
              disabled ? "opacity-50" : "cursor-crosshair"
            }`}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={disabled || !hasStroke || isPending}
              onClick={() => {
                const url = canvasRef.current?.toDataURL("image/png");
                if (url) onSign(url);
              }}
            >
              Valider la signature
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled || !hasStroke}
              onClick={clear}
            >
              <Eraser className="mr-2 h-4 w-4" />
              Effacer
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
