"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export type InterviewBoardHandle = {
  exportPng: () => Promise<Blob | null>;
  isBlank: () => boolean;
};

/** Coordinates normalized to the canvas CSS size (0–1) so redraws stay sharp. */
type Point = { x: number; y: number };

type Stroke = {
  color: string;
  /** Line width as a fraction of the shorter canvas side */
  widthRatio: number;
  points: Point[];
};

export const InterviewBoard = forwardRef<InterviewBoardHandle>(function InterviewBoard(
  _props,
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const drawing = useRef(false);
  const strokesRef = useRef<Stroke[]>([]);
  const activeRef = useRef<Stroke | null>(null);
  const sizeRef = useRef({ w: 1, h: 1 });
  const [ink, setInk] = useState("#0b0b0f");
  const [expanded, setExpanded] = useState(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w: cssW, h: cssH } = sizeRef.current;
    if (cssW < 1 || cssH < 1) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssW, cssH);

    const minSide = Math.min(cssW, cssH);
    const all = activeRef.current
      ? [...strokesRef.current, activeRef.current]
      : strokesRef.current;

    for (const stroke of all) {
      if (stroke.points.length === 0) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = Math.max(1.5, stroke.widthRatio * minSide);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      stroke.points.forEach((p, i) => {
        const x = p.x * cssW;
        const y = p.y * cssH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        ctx.lineTo(p.x * cssW + 0.01, p.y * cssH);
      }
      ctx.stroke();
    }
  }, []);

  const syncCanvasSize = useCallback(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const cssW = Math.max(1, Math.floor(surface.clientWidth));
    const cssH = Math.max(
      1,
      Math.floor(
        expanded
          ? surface.clientHeight || window.innerHeight - 112
          : Math.min(360, Math.max(240, Math.round(cssW * 0.5))),
      ),
    );
    sizeRef.current = { w: cssW, h: cssH };
    redraw();
  }, [expanded, redraw]);

  useEffect(() => {
    const run = () => syncCanvasSize();
    const id = requestAnimationFrame(() => requestAnimationFrame(run));
    window.addEventListener("resize", run);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", run);
    };
  }, [syncCanvasSize]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  useImperativeHandle(ref, () => ({
    exportPng: () =>
      new Promise((resolve) => {
        redraw();
        const canvas = canvasRef.current;
        if (!canvas || strokesRef.current.length === 0) {
          resolve(null);
          return;
        }
        canvas.toBlob((b) => resolve(b), "image/png");
      }),
    isBlank: () => strokesRef.current.length === 0,
  }));

  function normPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / Math.max(rect.width, 1),
      y: (e.clientY - rect.top) / Math.max(rect.height, 1),
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
    const minSide = Math.min(sizeRef.current.w, sizeRef.current.h);
    const widthPx = expanded ? 2.6 : 2.2;
    activeRef.current = {
      color: ink,
      widthRatio: widthPx / Math.max(minSide, 1),
      points: [normPoint(e)],
    };
    redraw();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !activeRef.current) return;
    activeRef.current.points.push(normPoint(e));
    redraw();
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (drawing.current && activeRef.current) {
      if (activeRef.current.points.length > 0) {
        strokesRef.current.push(activeRef.current);
      }
      activeRef.current = null;
      redraw();
    }
    drawing.current = false;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function clear() {
    strokesRef.current = [];
    activeRef.current = null;
    redraw();
  }

  return (
    <div
      className={`interview-board${expanded ? " interview-board-expanded" : ""}`}
      data-testid="interview-board"
    >
      <div className="board-toolbar">
        <span className="label-caps" style={{ margin: 0 }}>
          Sketch board
        </span>
        <div className="board-tools">
          <button
            type="button"
            className={`chip-btn${ink === "#0b0b0f" ? " active" : ""}`}
            onClick={() => setInk("#0b0b0f")}
          >
            Pen
          </button>
          <button
            type="button"
            className={`chip-btn${ink === "#0a7cff" ? " active" : ""}`}
            onClick={() => setInk("#0a7cff")}
          >
            Blue
          </button>
          <button type="button" className="chip-btn" onClick={clear}>
            Clear
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => setExpanded((v) => !v)}
            data-testid="board-expand"
            aria-pressed={expanded}
          >
            {expanded ? "Exit full screen" : "Full screen"}
          </button>
        </div>
      </div>
      <div className="board-surface" ref={surfaceRef}>
        <canvas
          ref={canvasRef}
          className="board-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
    </div>
  );
});
