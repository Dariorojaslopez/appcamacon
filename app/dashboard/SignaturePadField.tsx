'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { PointerEvent } from 'react';
import { firmaImageDisplaySrc } from '../../src/lib/firmaImageSrc';

const CSS_W = 340;
const CSS_H = 120;

export type SignaturePadFieldHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  toPngFile: () => File | null;
  loadFromUrl: (url: string) => Promise<boolean>;
};

export const SignaturePadField = forwardRef<SignaturePadFieldHandle, Record<string, unknown>>(
  function SignaturePadField(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const hasInk = useRef(false);

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
    hasInk.current = false;
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
    hasInk.current = true;
  };

  useImperativeHandle(ref, () => ({
    clear: () => layoutCanvas(),
    isEmpty: () => !hasInk.current,
    loadFromUrl: async (url: string) => {
      const c = canvasRef.current;
      if (!c || !url.trim()) return false;
      layoutCanvas();
      const ctx = c.getContext('2d');
      if (!ctx) return false;
      const src = firmaImageDisplaySrc(url) ?? url;
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('No se pudo cargar la imagen de firma'));
          img.src = src;
        });
        ctx.drawImage(img, 0, 0, CSS_W, CSS_H);
        hasInk.current = true;
        return true;
      } catch {
        hasInk.current = false;
        return false;
      }
    },
    toPngFile: () => {
      const c = canvasRef.current;
      if (!c || !hasInk.current) return null;
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
