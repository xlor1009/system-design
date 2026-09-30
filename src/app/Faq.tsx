"use client";

const ITEMS = [
  {
    q: "Who is this for?",
    a: "Just our friend group. Shared password, private grades — not a public product.",
  },
  {
    q: "What do I submit each week?",
    a: "Pick diagram walkthrough, or a live interview (text/audio) with a sketch board. The AI mostly listens and soft-nudges; grading still uses a hidden phase ladder.",
  },
  {
    q: "Are grades shared with everyone?",
    a: "No. Rubric scores stay private to you. The group only sees that a problem is live.",
  },
  {
    q: "Do I need Loom or Drive?",
    a: "No. Record in the browser and upload the diagram here. Everything stays on our server volume.",
  },
  {
    q: "What if the AI grade feels unfair?",
    a: "Resubmit with a clearer transcript or caption. Admins can also set a human override when needed.",
  },
  {
    q: "How do new problems show up?",
    a: "Weekly publish (or Admin → Publish next) advances the roadmap and can ping Discord once — never double-post.",
  },
];

export function Faq() {
  return (
    <div className="faq" id="faq">
      {ITEMS.map((item) => (
        <details key={item.q} className="faq-item">
          <summary>
            {item.q}
            <span className="plus" aria-hidden />
          </summary>
          <div className="answer">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
