"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Attempt, AttemptStyle, GradeResult } from "@/lib/types";
import type { InterviewOutlinePayload } from "@/lib/interview-shared";
import { LiveInterview } from "./LiveInterview";

type Props = {
  slug: string;
  initialAttempt: Attempt | null;
};

export function SubmitForm({ slug, initialAttempt }: Props) {
  const router = useRouter();
  const [style, setStyle] = useState<AttemptStyle>(initialAttempt?.style ?? "diagram");
  const [transcript, setTranscript] = useState(initialAttempt?.transcriptText ?? "");
  const [caption, setCaption] = useState(initialAttempt?.diagramCaption ?? "");
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [grade, setGrade] = useState<GradeResult | undefined>(
    initialAttempt?.gradeOverrideJson ?? initialAttempt?.gradeJson,
  );
  const [interviewLocked, setInterviewLocked] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError("Microphone permission denied");
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  async function submitAttempt(overrides?: {
    style?: AttemptStyle;
    transcript?: string;
    caption?: string;
    diagram?: File | null;
    interviewOutline?: InterviewOutlinePayload | null;
  }) {
    setError("");
    const nextStyle = overrides?.style ?? style;
    const nextTranscript = (overrides?.transcript ?? transcript).trim();
    const nextCaption = (overrides?.caption ?? caption).trim();

    if (nextStyle === "diagram") {
      const diagram = overrides?.diagram;
      if (
        (!(diagram instanceof File) || diagram.size === 0) &&
        !initialAttempt?.diagramPath
      ) {
        setError("Diagram file required");
        return;
      }
      if (!nextCaption) {
        setError("Diagram caption required");
        return;
      }
    }

    if (!nextTranscript) {
      setError(
        nextStyle === "interview" ? "Finish the live interview first" : "Transcript required",
      );
      return;
    }

    const body = new FormData();
    body.set("slug", slug);
    body.set("style", nextStyle);
    body.set("transcript", nextTranscript);
    body.set("caption", nextCaption);
    if (overrides?.interviewOutline) {
      body.set("interviewOutline", JSON.stringify(overrides.interviewOutline));
    }
    if (overrides?.diagram instanceof File && overrides.diagram.size > 0) {
      body.set("diagram", overrides.diagram);
    }
    if (audioBlob) {
      body.set("audio", new File([audioBlob], "recording.webm", { type: "audio/webm" }));
    }

    setPending(true);
    const res = await fetch("/api/submit", { method: "POST", body });
    setPending(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Submit failed");
      return;
    }
    const data = (await res.json()) as { attempt: Attempt };
    setGrade(data.attempt.gradeOverrideJson ?? data.attempt.gradeJson);
    setStyle(data.attempt.style);
    setTranscript(data.attempt.transcriptText ?? nextTranscript);
    router.refresh();
  }

  async function onDiagramSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const diagram = fd.get("diagram");
    await submitAttempt({
      style: "diagram",
      diagram: diagram instanceof File ? diagram : null,
    });
  }

  async function onInterviewGrade(payload: {
    transcript: string;
    outline: InterviewOutlinePayload;
    diagram?: Blob | null;
  }) {
    setTranscript(payload.transcript);
    setInterviewLocked(true);
    setStyle("interview");
    const diagramFile =
      payload.diagram && payload.diagram.size > 0
        ? payload.diagram instanceof File
          ? payload.diagram
          : new File([payload.diagram], "interview-board.png", { type: "image/png" })
        : null;
    await submitAttempt({
      style: "interview",
      transcript: payload.transcript,
      caption: diagramFile
        ? "Live interview with sketch board (phase_ladder_v1 hidden rubric)"
        : "Live interview (phase_ladder_v1 hidden rubric)",
      interviewOutline: payload.outline,
      diagram: diagramFile,
    });
  }

  return (
    <div>
      <h2 className="page-title" style={{ fontSize: "1.35rem", marginTop: "2rem" }}>
        {grade ? "Review / resubmit" : "Submit attempt"}
      </h2>

      <p className="label-caps" style={{ marginTop: "1.25rem" }}>
        Attempt style
      </p>
      <div className="chip-row" style={{ justifyContent: "flex-start", marginTop: "0.5rem" }}>
        <button
          type="button"
          className={`chip-btn${style === "diagram" ? " active" : ""}`}
          onClick={() => setStyle("diagram")}
          data-testid="style-diagram"
        >
          Diagram walkthrough
        </button>
        <button
          type="button"
          className={`chip-btn${style === "interview" ? " active" : ""}`}
          onClick={() => setStyle("interview")}
          data-testid="style-interview"
        >
          Live interview
        </button>
      </div>
      <p className="hint" style={{ textAlign: "left", marginTop: "0.5rem" }}>
        {style === "diagram"
          ? "Upload a diagram, describe it, and paste your walkthrough."
          : "Free-talk with soft nudges (text or audio) and an optional sketch board. Grade uses a hidden phase ladder."}
      </p>

      {style === "interview" ? (
        <div style={{ marginTop: "1.5rem" }}>
          <LiveInterview
            slug={slug}
            initialTranscript={initialAttempt?.transcriptText}
            onReadyToGrade={(payload) => void onInterviewGrade(payload)}
          />
          {pending ? <p className="muted">Grading interview…</p> : null}
          {interviewLocked && transcript ? (
            <details style={{ marginTop: "1rem" }}>
              <summary className="caption">Saved interview transcript</summary>
              <pre className="prompt" style={{ whiteSpace: "pre-wrap" }}>
                {transcript}
              </pre>
            </details>
          ) : null}
        </div>
      ) : (
        <form onSubmit={onDiagramSubmit}>
          <label htmlFor="diagram">Diagram file</label>
          <input
            id="diagram"
            name="diagram"
            type="file"
            accept="image/*,.pdf,.svg"
            required={!initialAttempt?.diagramPath}
            data-testid="diagram-upload"
          />
          {initialAttempt?.diagramPath ? (
            <p className="caption" style={{ marginTop: "0.35rem" }}>
              Diagram on file —{" "}
              <a href={`/api/files/${initialAttempt.diagramPath}`} target="_blank" rel="noreferrer">
                view upload
              </a>
            </p>
          ) : null}

          <label>Audio (optional)</label>
          <div className="rec-controls">
            <button
              type="button"
              className="btn secondary on-light"
              onClick={startRecording}
              disabled={recording}
              data-testid="record"
            >
              Record
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={stopRecording}
              disabled={!recording}
              data-testid="stop"
            >
              Stop
            </button>
            <span className="status-pill">
              {recording
                ? "Recording…"
                : audioBlob
                  ? "Audio ready"
                  : initialAttempt?.audioPath
                    ? "Prior audio on file"
                    : "No audio"}
            </span>
          </div>

          <label htmlFor="transcript">Walkthrough transcript</label>
          <textarea
            id="transcript"
            name="transcript"
            required
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            data-testid="transcript"
          />

          <label htmlFor="caption">Diagram caption</label>
          <textarea
            id="caption"
            name="caption"
            required
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Describe components, data flow, and key boxes in your uploaded diagram."
            data-testid="caption"
          />

          <p style={{ marginTop: "1.25rem" }}>
            <button className="btn dark" type="submit" disabled={pending} data-testid="submit">
              {pending ? "Grading…" : "Submit"}
            </button>
          </p>
        </form>
      )}

      {error ? <p className="field-error">{error}</p> : null}

      {grade ? (
        <section className="scores" data-testid="scores">
          <h2 style={{ marginTop: 0, fontSize: "1.2rem" }}>
            Score: {grade.overallScore}/{grade.overallMax}
            {grade.failClosed ? " (fail closed)" : ""}
          </h2>
          <p className="caption" style={{ marginTop: 0 }}>
            Style: {style === "interview" ? "Live interview" : "Diagram walkthrough"}
          </p>
          <p>{grade.summary}</p>
          <ul>
            {grade.dimensions.map((d) => (
              <li key={d.id}>
                <strong>
                  {d.label}: {d.score}/{d.maxScore}
                </strong>
                <div className="muted">{d.feedback}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
