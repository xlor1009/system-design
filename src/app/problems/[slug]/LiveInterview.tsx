"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  INTERVIEW_OUTLINE_VERSION,
  formatInterviewTranscript,
  type InterviewMessage,
  type InterviewOutlinePayload,
  type InterviewSessionState,
} from "@/lib/interview-shared";
import { InterviewBoard, type InterviewBoardHandle } from "./InterviewBoard";
import { speakInterview, stopInterviewSpeech } from "@/lib/interview-tts";

type Channel = "text" | "audio";

type Props = {
  slug: string;
  onReadyToGrade: (payload: {
    transcript: string;
    outline: InterviewOutlinePayload;
    diagram?: Blob | null;
  }) => void;
  initialTranscript?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((ev: {
        resultIndex: number;
        results: ArrayLike<{
          0: { transcript: string };
          isFinal: boolean;
          length: number;
        }>;
      }) => void)
    | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function LiveInterview({ slug, onReadyToGrade, initialTranscript }: Props) {
  const [channel, setChannel] = useState<Channel>("text");
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [session, setSession] = useState<InterviewSessionState | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [upload, setUpload] = useState<{
    name: string;
    dataUrl: string;
    blob: Blob;
  } | null>(null);
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const boardRef = useRef<InterviewBoardHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const speechTextRef = useRef("");
  const messagesRef = useRef(messages);
  const sessionRef = useRef(session);
  const stuckRef = useRef(stuck);
  const pendingRef = useRef(pending);
  const sendLockRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    stuckRef.current = stuck;
  }, [stuck]);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  async function boardDataUrl(): Promise<string | null> {
    const blob = await boardRef.current?.exportPng();
    if (!blob) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }

  /** Prefer mid-interview upload; fall back to sketch board. */
  async function visionDataUrl(): Promise<string | null> {
    if (upload?.dataUrl) return upload.dataUrl;
    return boardDataUrl();
  }

  function onPickUpload(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Upload an image (PNG, JPG, WebP, etc.)");
      return;
    }
    if (file.size > 4_000_000) {
      setError("Image too large (max ~4MB)");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setUpload({ name: file.name, dataUrl: reader.result, blob: file });
    };
    reader.onerror = () => setError("Could not read upload");
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    const log = chatLogRef.current;
    if (!log) return;
    log.scrollTop = log.scrollHeight;
  }, [messages, interim, pending]);

  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
        recognitionRef.current = null;
      }
      stopInterviewSpeech();
    };
  }, []);

  async function speak(text: string) {
    if (!text || channel !== "audio") return;
    setSpeaking(true);
    try {
      await speakInterview(text, { enabled: true });
    } finally {
      setSpeaking(false);
    }
  }

  function stopSpeaking() {
    stopInterviewSpeech();
    setSpeaking(false);
  }

  async function requestTurn(
    nextMessages: InterviewMessage[],
    nextSession: InterviewSessionState | null,
    isStuck: boolean,
  ) {
    setPending(true);
    pendingRef.current = true;
    setError("");
    try {
      const boardImageDataUrl = await visionDataUrl();
      const res = await fetch("/api/interview/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          messages: nextMessages,
          session: nextSession,
          stuck: isStuck,
          boardImageDataUrl,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Interview turn failed");
        return null;
      }
      return (await res.json()) as {
        reply: string;
        session: InterviewSessionState;
        suggestEnd: boolean;
      };
    } catch {
      setError("Interview turn failed — check your connection.");
      return null;
    } finally {
      setPending(false);
      pendingRef.current = false;
    }
  }

  async function startInterview() {
    setStarted(true);
    setMessages([]);
    setSession(null);
    setStuck(false);
    const data = await requestTurn([], null, false);
    if (!data) {
      setStarted(false);
      return;
    }
    setSession(data.session);
    if (data.reply.trim()) {
      setMessages([{ role: "interviewer", content: data.reply }]);
      void speak(data.reply);
    }
  }

  async function sendCandidate(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (pendingRef.current || sendLockRef.current) {
      setError("Still waiting on the last reply — try Stop & send again in a moment.");
      return;
    }
    sendLockRef.current = true;
    const next: InterviewMessage[] = [
      ...messagesRef.current,
      { role: "candidate", content: trimmed },
    ];
    setMessages(next);
    messagesRef.current = next;
    setDraft("");
    setInterim("");
    speechTextRef.current = "";
    try {
      const data = await requestTurn(next, sessionRef.current, stuckRef.current);
      if (!data) return;
      setSession(data.session);
      sessionRef.current = data.session;
      setStuck(false);
      if (data.reply.trim()) {
        const withReply: InterviewMessage[] = [
          ...next,
          { role: "interviewer", content: data.reply },
        ];
        setMessages(withReply);
        messagesRef.current = withReply;
        void speak(data.reply);
      }
    } finally {
      sendLockRef.current = false;
    }
  }

  function onTextSubmit(e: FormEvent) {
    e.preventDefault();
    void sendCandidate(draft);
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!pending && draft.trim() && !session?.complete) {
        void sendCandidate(draft);
      }
    }
  }

  function cancelListening() {
    const rec = recognitionRef.current;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }
      recognitionRef.current = null;
    }
    setListening(false);
    setInterim("");
  }

  /** User clicked Stop & send — submit whatever speech we already captured. */
  function stopListening() {
    const text = speechTextRef.current.trim();
    cancelListening();
    if (text) {
      void sendCandidate(text);
    } else {
      setError("Didn't catch any speech — click Talk and try again.");
    }
  }

  function startListening() {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setError("Speech recognition isn’t supported here. Use text mode or Chrome/Edge.");
      return;
    }
    if (speaking) stopSpeaking();
    setError("");
    speechTextRef.current = "";
    setDraft("");
    setInterim("");
    cancelListening();

    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (ev) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < ev.results.length; i++) {
        const r = ev.results[i];
        const piece = r[0]?.transcript ?? "";
        if (r.isFinal) finalText += piece;
        else interimText += piece;
      }
      const combined = `${finalText} ${interimText}`.replace(/\s+/g, " ").trim();
      speechTextRef.current = combined;
      setDraft(combined);
      setInterim(interimText.trim());
    };

    rec.onerror = (ev) => {
      // 'no-speech' / 'aborted' are common when stopping — don't block send
      if (ev.error && ev.error !== "aborted" && ev.error !== "no-speech") {
        setError(`Mic error: ${ev.error}`);
      }
    };

    rec.onend = () => {
      // Unexpected end (browser timeout / permission). Prefer keep draft;
      // intentional Stop & send already detached this handler.
      if (recognitionRef.current !== rec) return;
      recognitionRef.current = null;
      setListening(false);
      setInterim("");
      const text = speechTextRef.current.trim();
      if (text) void sendCandidate(text);
    };

    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
      recognitionRef.current = null;
      setError("Could not start the mic — check permissions.");
    }
  }

  async function finishForGrading() {
    if (!session) {
      setError("Start the interview first.");
      return;
    }
    if (session.problemSlug !== slug) {
      setError("Session is locked to a different problem URL.");
      return;
    }
    if (messages.filter((m) => m.role === "candidate").length < 1) {
      setError("Say something before finishing.");
      return;
    }
    const transcript = formatInterviewTranscript(messages);
    const diagram =
      upload?.blob ??
      (await boardRef.current?.exportPng()) ??
      null;
    const outline: InterviewOutlinePayload = {
      ...session,
      outlineVersion: INTERVIEW_OUTLINE_VERSION,
      problemSlug: slug,
      messages,
    };
    onReadyToGrade({ transcript, outline, diagram });
  }

  return (
    <div className="interview-panel" data-testid="live-interview">
      <p className="label-caps">Live interview</p>
      <p className="muted" style={{ marginTop: "0.25rem" }}>
        Free-talk like a real interview — sketch or upload a diagram anytime. The interviewer
        sees your latest image on each reply; grading uses that upload (or the board) too.
      </p>

      <div className="chip-row" style={{ justifyContent: "flex-start", marginTop: "0.75rem" }}>
        <button
          type="button"
          className={`chip-btn${channel === "text" ? " active" : ""}`}
          onClick={() => {
            cancelListening();
            stopSpeaking();
            setChannel("text");
          }}
          data-testid="channel-text"
        >
          Text mode
        </button>
        <button
          type="button"
          className={`chip-btn${channel === "audio" ? " active" : ""}`}
          onClick={() => setChannel("audio")}
          data-testid="channel-audio"
        >
          Audio mode
        </button>
        {channel === "audio" && speaking ? (
          <button
            type="button"
            className="chip-btn"
            onClick={stopSpeaking}
            data-testid="stop-speaking"
          >
            Stop speaking
          </button>
        ) : null}
      </div>

      {!started ? (
        <div style={{ marginTop: "1.25rem" }}>
          {initialTranscript ? (
            <p className="caption">
              Prior attempt on file — start a new interview to replace it for grading.
            </p>
          ) : null}
          <button
            type="button"
            className="btn dark"
            onClick={() => void startInterview()}
            disabled={pending}
            data-testid="start-interview"
          >
            {pending ? "Starting…" : "Start interview"}
          </button>
        </div>
      ) : (
        <div className="interview-layout">
          <div className="interview-main">
            <div className="chat-log" data-testid="interview-log" ref={chatLogRef}>
              {messages.map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={`chat-bubble ${m.role === "interviewer" ? "interviewer" : "candidate"}`}
                >
                  <div className="chat-role">
                    {m.role === "interviewer" ? "Interviewer" : "You"}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                </div>
              ))}
              {pending ? (
                <div className="chat-bubble interviewer muted">…</div>
              ) : null}
              {listening && (draft || interim) ? (
                <div className="chat-bubble candidate muted" data-testid="interview-hearing">
                  Hearing: {draft || interim}
                </div>
              ) : null}
            </div>

            {channel === "text" ? (
              <form onSubmit={onTextSubmit} className="chat-compose">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onComposerKeyDown}
                  placeholder="Think aloud… (Enter to send, Shift+Enter for new line)"
                  rows={3}
                  disabled={pending || session?.complete}
                  data-testid="interview-reply"
                />
                <button
                  className="btn dark"
                  type="submit"
                  disabled={pending || !draft.trim() || session?.complete}
                >
                  Send
                </button>
                <button
                  type="button"
                  className="btn secondary on-light"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pending}
                  data-testid="interview-upload"
                >
                  Upload diagram
                </button>
              </form>
            ) : (
              <div className="rec-controls" style={{ marginTop: "1rem" }}>
                {!listening ? (
                  <button
                    type="button"
                    className="btn dark"
                    onClick={startListening}
                    disabled={pending || session?.complete}
                    data-testid="interview-talk"
                  >
                    Click to talk
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn danger"
                    onClick={stopListening}
                    data-testid="interview-stop-talk"
                  >
                    Stop & send
                  </button>
                )}
                <button
                  type="button"
                  className="btn secondary on-light"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pending}
                  data-testid="interview-upload-audio"
                >
                  Upload diagram
                </button>
                <span className="status-pill">
                  {listening
                    ? "Listening…"
                    : speaking
                      ? "Interviewer speaking…"
                      : "Neural TTS when available"}
                </span>
                {speaking ? (
                  <button
                    type="button"
                    className="btn secondary on-light"
                    onClick={stopSpeaking}
                    data-testid="stop-speaking-audio"
                  >
                    Stop speaking
                  </button>
                ) : null}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                onPickUpload(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
              data-testid="interview-upload-input"
            />

            {upload ? (
              <div className="upload-chip" data-testid="interview-upload-preview">
                <img src={upload.dataUrl} alt="" />
                <div>
                  <div className="caption">{upload.name}</div>
                  <button
                    type="button"
                    className="chip-btn"
                    onClick={() => setUpload(null)}
                  >
                    Remove upload
                  </button>
                </div>
              </div>
            ) : null}
            <label className="stuck-toggle">
              <input
                type="checkbox"
                checked={stuck}
                onChange={(e) => setStuck(e.target.checked)}
                data-testid="interview-stuck"
              />
              I&apos;m stuck — interviewer can help a bit more
            </label>

            <div className="btn-row" style={{ justifyContent: "flex-start", marginTop: "1rem" }}>
              <button
                type="button"
                className="btn secondary on-light"
                onClick={() => void finishForGrading()}
                disabled={messages.length < 2 || pending}
                data-testid="finish-interview"
              >
                Finish & grade
              </button>
            </div>
          </div>

          <InterviewBoard ref={boardRef} />
        </div>
      )}

      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
