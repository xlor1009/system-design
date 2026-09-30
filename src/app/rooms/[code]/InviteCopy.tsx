"use client";

import { useState } from "react";

export function InviteCopy({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="tile" style={{ marginTop: "1.25rem" }}>
      <p className="label-caps" style={{ margin: 0 }}>
        Invite link
      </p>
      <p className="muted" style={{ margin: "0.35rem 0 0.85rem", wordBreak: "break-all" }}>
        {url}
      </p>
      <button
        type="button"
        className="btn secondary on-light"
        onClick={onCopy}
        data-testid="copy-invite"
      >
        {copied ? "Copied" : "Copy invite link"}
      </button>
    </div>
  );
}
