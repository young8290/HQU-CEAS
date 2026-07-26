import { useEffect, useRef, useState } from 'react';

type Point = { x: number; y: number };

export default function SignaturePad({
  signerName,
  purpose,
  onSaved,
}: {
  signerName: string;
  purpose: string;
  onSaved: (imageData: string) => void;
}) {
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokeRef = useRef<{ active: boolean; last: Point | null }>({ active: false, last: null });
  const [open, setOpen] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [draftImage, setDraftImage] = useState('');

  useEffect(() => {
    if (!open || !draftImage) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = draftImage;
  }, [open, draftImage]);

  function toPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function redrawPreview() {
    const canvas = canvasRef.current;
    const preview = previewRef.current;
    const previewCtx = preview?.getContext('2d');
    if (!canvas || !preview || !previewCtx) return;
    previewCtx.clearRect(0, 0, preview.width, preview.height);
    previewCtx.drawImage(canvas, 0, 0, preview.width, preview.height);
    setDraftImage(canvas.toDataURL('image/png'));
  }

  function startDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toPoint(event);
    ctx.beginPath();
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1f2937';
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x + 0.01, point.y + 0.01);
    ctx.stroke();
    strokeRef.current = { active: true, last: point };
    setHasInk(true);
  }

  function moveDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !strokeRef.current.active) return;
    const point = toPoint(event);
    const last = strokeRef.current.last || point;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    strokeRef.current.last = point;
    setHasInk(true);
  }

  function endDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    strokeRef.current = { active: false, last: null };
    redrawPreview();
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    const preview = previewRef.current;
    const previewCtx = preview?.getContext('2d');
    if (preview && previewCtx) {
      previewCtx.clearRect(0, 0, preview.width, preview.height);
    }
    strokeRef.current = { active: false, last: null };
    setHasInk(false);
    setDraftImage('');
  }

  function save() {
    const imageData = canvasRef.current?.toDataURL('image/png');
    if (!imageData) return;
    redrawPreview();
    setOpen(false);
    onSaved(imageData);
  }

  return (
    <div className="rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-900 dark:text-white">{signerName || '签名人'}</p>
          <p className="text-xs text-neutral-500">{purpose}</p>
        </div>
        <button
          type="button"
          onClick={clear}
          className="rounded-md border border-[#d8c9b8] bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-[#f6f1e8] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
        >
          清除
        </button>
      </div>

      <canvas
        ref={previewRef}
        width={520}
        height={180}
        onClick={() => setOpen(true)}
        className="h-44 w-full cursor-zoom-in rounded-lg border border-dashed border-[#d8c9b8] bg-white dark:border-neutral-700"
      />

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded-md bg-[#9a5b3d] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#7c4a34]"
      >
        {hasInk ? '继续签名' : '点击放大签名'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-5xl rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-4 flex flex-col gap-3 border-b border-[#e4d8ca] pb-4 dark:border-neutral-800 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-base font-semibold text-neutral-950 dark:text-white">{signerName || '签名人'}</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{purpose}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={clear} className="rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-[#f6f1e8] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">清除</button>
                <button type="button" onClick={() => { redrawPreview(); setOpen(false); }} className="rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-[#f6f1e8] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">关闭</button>
                <button type="button" onClick={save} className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#7c4a34]">确认签名</button>
              </div>
            </div>

            <canvas
              ref={canvasRef}
              width={1200}
              height={420}
              onPointerDown={startDraw}
              onPointerMove={moveDraw}
              onPointerUp={endDraw}
              onPointerCancel={endDraw}
              onPointerLeave={() => {
                strokeRef.current = { active: false, last: null };
                redrawPreview();
              }}
              className="h-[58vh] max-h-[520px] min-h-[320px] w-full touch-none rounded-lg border border-dashed border-[#d8c9b8] bg-white dark:border-neutral-700"
            />
          </div>
        </div>
      )}
    </div>
  );
}
