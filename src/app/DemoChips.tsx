"use client";

import { useState } from "react";

const STEPS = [
  {
    id: "open",
    label: "Open this week’s problem",
    title: "URL Shortener",
    body: "45-minute timebox. Read the prompt, then sketch your design.",
  },
  {
    id: "diagram",
    label: "Upload a diagram",
    title: "Diagram on file",
    body: "PNG, SVG, or PDF — stored under your attempt for same-URL review.",
  },
  {
    id: "record",
    label: "Record the walkthrough (optional)",
    title: "Audio optional",
    body: "Browser MediaRecorder if you want playback later. Transcript still required for grading.",
  },
  {
    id: "grade",
    label: "Get a private rubric grade",
    title: "Score · rubric_v1",
    body: "Strengths, gaps, and next practice — visible only to you.",
  },
];

export function DemoChips() {
  const [active, setActive] = useState(STEPS[0].id);
  const step = STEPS.find((s) => s.id === active) ?? STEPS[0];

  return (
    <div id="how">
      <div className="desktop-mock" style={{ marginTop: "2.5rem" }}>
        <div className="chrome">
          <span className="dot-r" />
          <span className="dot-y" />
          <span className="dot-g" />
          <span className="chrome-title">study loop · practice</span>
        </div>
        <div className="screen">
          <div className="label-caps" style={{ color: "rgba(255,255,255,0.4)" }}>
            Live step
          </div>
          <h3>{step.title}</h3>
          <p className="meta">{step.body}</p>
          <div className="accent-bar" />
          <div className="row">
            <span className="chip">diagram</span>
            <span className="chip">audio</span>
            <span className="chip">transcript</span>
            <span className="chip">private grade</span>
          </div>
        </div>
      </div>
      <div className="chip-row">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`chip-btn${active === s.id ? " active" : ""}`}
            onClick={() => setActive(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="hint">Tap a step to preview the flow — nothing leaves your group.</p>
    </div>
  );
}
