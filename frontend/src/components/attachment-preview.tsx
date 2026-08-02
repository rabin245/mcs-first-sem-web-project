import { useEffect, useRef, useState } from "react";
import { ImageIcon, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i;

export function isImageAttachment(fileName: string): boolean {
  return IMAGE_EXT.test(fileName);
}

function useAttachmentObjectUrl(id: string, enabled: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let objectUrl: string | null = null;

    const load = async () => {
      try {
        const res = await api.get(`/api/attachments/${id}/download`, {
          responseType: "blob",
        });
        if (!active) return;
        objectUrl = URL.createObjectURL(res.data as Blob);
        setUrl(objectUrl);
      } catch {
        if (active) setUrl(null);
      }
    };

    void load();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, enabled]);

  return url;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const SCALE_STEP = 0.25;

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function ZoomableImage({ url, fileName }: { url: string; fileName: string }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const zoomTo = (next: number) => {
    const clamped = clampScale(next);
    setScale(clamped);
    if (clamped === 1) setOffset({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomTo(scale + (e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (scale === 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    });
  };

  const endDrag = () => {
    dragStart.current = null;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-8"
          onClick={() => zoomTo(scale - SCALE_STEP)}
          disabled={scale <= MIN_SCALE}
          aria-label="Zoom out"
        >
          <ZoomOut />
        </Button>
        <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
          {Math.round(scale * 100)}%
        </span>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-8"
          onClick={() => zoomTo(scale + SCALE_STEP)}
          disabled={scale >= MAX_SCALE}
          aria-label="Zoom in"
        >
          <ZoomIn />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-8"
          onClick={reset}
          disabled={scale === 1 && offset.x === 0 && offset.y === 0}
          aria-label="Reset zoom"
        >
          <Maximize2 />
        </Button>
      </div>

      <div
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md bg-muted/30"
        onWheel={handleWheel}
      >
        <img
          src={url}
          alt={fileName}
          draggable={false}
          onDoubleClick={() => (scale === 1 ? zoomTo(2) : reset())}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            cursor:
              scale > 1 ? (dragStart.current ? "grabbing" : "grab") : "default",
            transition: dragStart.current ? "none" : "transform 0.15s ease-out",
          }}
          className="max-h-full w-auto max-w-full touch-none select-none object-contain"
        />
      </div>
    </div>
  );
}

export function AttachmentThumbnail({
  id,
  fileName,
}: {
  id: string;
  fileName: string;
}) {
  const [open, setOpen] = useState(false);
  const url = useAttachmentObjectUrl(id, true);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="size-10 shrink-0 overflow-hidden rounded border bg-muted"
        aria-label={`Preview ${fileName}`}
      >
        {url ? (
          <img src={url} alt={fileName} className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-4" />
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="left-0 top-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-3 rounded-none border-0">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{fileName}</DialogTitle>
            <DialogDescription className="sr-only">
              Image preview
            </DialogDescription>
          </DialogHeader>
          {url ? (
            <ZoomableImage key={url} url={url} fileName={fileName} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading preview...
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
