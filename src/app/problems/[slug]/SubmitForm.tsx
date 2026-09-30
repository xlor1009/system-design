"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Attempt, GradeResult } from "@/lib/types";

type Props = {
  slug: string;
  initialAttempt: Attempt | null;
};

export function SubmitForm({ slug, initialAttempt }: Props) {
  const router = useRouter();
  const [transcript, setTranscript] = useState(initialAttempt?.transcriptText ?? "");
  const [caption, setCaption] = useState(initialAttempt?.diagramCaption ?? "");
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [grade, setGrade] = useState<GradeResult | undefined>(
    initialAttempt?.gradeOverrideJson ?? initialAttempt?.gradeJson,
  );
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

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const diagram = fd.get("diagram");
    if (
      (!(diagram instanceof File) || diagram.size === 0) &&
      !initialAttempt?.diagramPath
    ) {
      setError("Diagram file required");
      return;
    }
    if (!audioBlob && !initialAttempt?.audioPath) {
      setError("Record audio before submitting");
      return;
    }
    if (!transcript.trim()) {
      setError("Transcript required");
      return;
    }
    if (!caption.trim()) {
      setError("Diagram caption required");
      return;
    }

    const body = new FormData();
    body.set("slug", slug);
    body.set("transcript", transcript);
    body.set("caption", caption);
    if (diagram instanceof File && diagram.size > 0) {
      body.set("diagram", diagram);
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
    router.refresh();
  }

  return (
    <div>
      <h2>{grade ? "Review / resubmit" : "Submit attempt"}</h2>
      <form onSubmit={onSubmit}>
        <label htmlFor="diagram">Diagram file</label>
        <input
          id="diagram"
          name="diagram"
          type="file"
          accept="image/*,.pdf,.svg"
          required={!initialAttempt?.diagramPath}
          data-testid="diagram-upload"
        />

        <label>Audio walkthrough</label>
        <div className="rec-controls">
          <button
            type="button"
            className="btn secondary"
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
            {recording ? "Recording…" : audioBlob ? "Audio ready" : initialAttempt?.audioPath ? "Prior audio on file" : "No audio"}
          </span>
        </div>

        <label htmlFor="transcript">Transcript</label>
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
          data-testid="caption"
        />

        {error ? <p className="field-error">{error}</p> : null}

        <p style={{ marginTop: "1.25rem" }}>
          <button className="btn" type="submit" disabled={pending} data-testid="submit">
            {pending ? "Grading…" : "Submit"}
          </button>
        </p>
      </form>

      {grade ? (
        <section className="scores" data-testid="scores">
          <h2>
            Score: {grade.overallScore}/{grade.overallMax}
            {grade.failClosed ? " (fail closed)" : ""}
          </h2>
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
