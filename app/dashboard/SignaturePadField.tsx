'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { PointerEvent } from 'react';

const CSS_W = 340;
const CSS_H = 120;

export type SignaturePadFieldHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  toPngFile: () => File | null;
};

function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx || !canvas.width || !canvas.height) return true;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 255;
    const g = data[i + 1] ?? 255;
    const b = data[i + 2] ?? 255;
    if (r < 245 || g < 245 || b < 245) return false;
  }
  return true;
}

export const SignaturePadField = forwardRef<SignaturePadFieldHandle, Record<string, unknown>>(
  function SignaturePadField(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const layoutCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    c.width = Math.floor(CSS_W * dpr);
    c.height = Math.floor(CSS_H * dpr);
    c.style.width = `${CSS_W}px`;
    c.style.height = `${CSS_H}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CSS_W, CSS_H);
  }, []);

  useEffect(() => {
    layoutCanvas();
  }, [layoutCanvas]);

  const pos = (e: PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const drawSegment = (x1: number, y1: number, x2: number, y2: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  useImperativeHandle(ref, () => ({
    clear: () => layoutCanvas(),
    isEmpty: () => (canvasRef.current ? isCanvasBlank(canvasRef.current) : true),
    toPngFile: () => {
      const c = canvasRef.current;
      if (!c || isCanvasBlank(c)) return null;
      const dataUrl = c.toDataURL('image/png');
      const b64 = dataUrl.split(',')[1];
      if (!b64) return null;
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
      return new File([arr], 'firma.png', { type: 'image/png' });
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      className="signature-pad-canvas"
      aria-label="Área de firma"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        const p = pos(e);
        last.current = p;
      }}
      onPointerMove={(e) => {
        if (!drawing.current || !last.current) return;
        const p = pos(e);
        drawSegment(last.current.x, last.current.y, p.x, p.y);
        last.current = p;
      }}
      onPointerUp={() => {
        drawing.current = false;
        last.current = null;
      }}
      onPointerLeave={() => {
        drawing.current = false;
        last.current = null;
      }}
    />
  );
});
