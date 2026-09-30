import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listProblems } from "@/lib/db";
import { DemoChips } from "@/app/DemoChips";
import { Faq } from "@/app/Faq";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const problems = listProblems();
  const featured = problems[0];
  const updated = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <header className="hero">
        <div className="status-badge">
          <span className="dot" aria-hidden />
          <span>Friends-only · updated {updated}</span>
        </div>
        <h1 className="hero-title">
          Weekly system design
          <span className="glyph" aria-hidden />
          with your crew
        </h1>
        <p className="hero-sub">
          Timed problem, diagram + walkthrough, private AI rubric — same URL for
          review. Built for friends, not a public SaaS.
        </p>
        <div className="btn-row">
          {featured ? (
            <Link
              className="btn"
              href={`/problems/${featured.slug}`}
              data-testid={`problem-link-${featured.slug}`}
            >
              Open this week
            </Link>
          ) : null}
          <Link className="btn secondary" href="/roadmap" data-testid="roadmap-link">
            View roadmap
          </Link>
          <Link className="btn secondary" href="/rooms" data-testid="rooms-link">
            Your rooms
          </Link>
        </div>
        <div className="trust-meta">
          <span>Shared password</span>
          <span>·</span>
          <span>Private grades</span>
          <span>·</span>
          <span>Audio stays on server</span>
        </div>

        <div className="desktop-mock" aria-hidden={false}>
          <div className="chrome">
            <span className="dot-r" />
            <span className="dot-y" />
            <span className="dot-g" />
            <span className="chrome-title">study loop · this week</span>
          </div>
          <div className="screen">
            <div className="label-caps" style={{ color: "rgba(255,255,255,0.4)" }}>
              Active problem
            </div>
            <h3>{featured?.title ?? "No problem published yet"}</h3>
            <p className="meta">
              {featured
                ? `${featured.weekOf} · due ${new Date(featured.dueAt).toLocaleDateString()} · ${featured.timeboxMinutes} min`
                : "Publish from Admin when you’re ready."}
            </p>
            <div className="accent-bar" />
            <div className="row">
              <span className="chip">diagram upload</span>
              <span className="chip">MediaRecorder</span>
              <span className="chip">rubric_v1</span>
            </div>
          </div>
        </div>
      </header>

      <section className="section">
        <h2 className="section-head">Don&apos;t just read the prompt</h2>
        <p className="section-sub">
          Walk the weekly loop once — diagram, talk it through, get a private score.
        </p>
        <DemoChips />
      </section>

      <section className="section" id="practice" style={{ paddingTop: "2rem" }}>
        <h2 className="section-head">Every step, in context</h2>
        <p className="section-sub">
          Capture and review live in the app — no Loom, no Drive links.
        </p>
        <div className="card-grid cols-3">
          {[
            { t: "Roadmap topics", c: "Ordered deep-links we cycle through each week.", p: "sky" },
            { t: "Timed problem", c: "Stable slug, rewrite of a real design prompt.", p: "soft" },
            { t: "Diagram file", c: "Upload PNG, SVG, or PDF under your attempt.", p: "" },
            { t: "Audio walkthrough", c: "Record in-browser; keep the .webm for review.", p: "soft" },
            { t: "Pasted transcript", c: "Required for V1 grading — Whisper later.", p: "sky" },
            { t: "Caption for grader", c: "Describe the diagram in words — no vision model.", p: "" },
            { t: "Private rubric", c: "Dimensions, strengths, gaps — only you see scores.", p: "soft" },
            { t: "Same-URL review", c: "Reload the problem page to see artifacts + grade.", p: "sky" },
            { t: "Discord ping", c: "Idempotent weekly publish — no double posts.", p: "" },
          ].map((card) => (
            <article key={card.t} className="tile">
              <div className={`preview ${card.p}`}>{card.t}</div>
              <p className="caption">{card.c}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section bento">
        <h2 className="section-head">Built for one group</h2>
        <p className="section-sub">Small surface area. One password. Private grades.</p>
        <div className="card-grid cols-2">
          <article className="tile">
            <div className="preview sky">This week → submit</div>
            <h3>Problem first</h3>
            <p>Home drops you into the live slug with timebox and due date.</p>
          </article>
          <article className="tile">
            <div className="preview soft">SQLite · /data</div>
            <h3>Server-side capture</h3>
            <p>Uploads land on the volume beside the database — not third-party links.</p>
          </article>
          <article className="tile">
            <div className="preview soft">rubric_v1 JSON</div>
            <h3>Fail-closed grading</h3>
            <p>Empty transcript or missing diagram never invents a score.</p>
          </article>
          <article className="tile">
            <div className="preview sky">Publish next</div>
            <h3>Quiet until publish</h3>
            <p>Cron or Admin advances the cursor; Discord fires once per problem.</p>
          </article>
        </div>
      </section>

      <section className="section">
        <h2 className="section-head">Private until it matters</h2>
        <p className="section-sub">
          Practice is shared as a ritual; scores stay between you and the rubric.
        </p>
        <div className="card-grid cols-3">
          {[
            {
              title: "Attempt",
              body: "One row per person per problem. Resubmit overwrites paths and clears the grade until regrade.",
            },
            {
              title: "Review",
              body: "Diagram, audio, transcript, and scores reload on the same problem URL.",
            },
            {
              title: "Notify",
              body: "Discord webhook with notified_at guard — the cron is a no-op if already sent.",
            },
            {
              title: "Auth",
              body: "Group password cookie plus display name. No Clerk, no public signup.",
            },
            {
              title: "Roadmap",
              body: "Eight-plus topics deep-linked out — we store our rewrite, not scraped solutions.",
            },
            {
              title: "Override",
              body: "Human grade_override when the model misses — unfair grades get a backstop.",
            },
          ].map((c) => (
            <article key={c.title} className="tile">
              <div className="slim-preview" />
              <h3>{c.title}</h3>
              <p>{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-head">Problems on the board</h2>
        <p className="section-sub">Jump into a slug whenever you’re ready.</p>
        <ul className="problem-list">
          {problems.map((p) => (
            <li key={p.id}>
              <Link
                className="problem-card"
                href={`/problems/${p.slug}`}
                data-testid={`problem-link-${p.slug}`}
              >
                <div className="title">{p.title}</div>
                <div className="caption">
                  {p.weekOf} · due {new Date(p.dueAt).toLocaleDateString()} ·{" "}
                  {p.timeboxMinutes} min
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2 className="section-head">Trust the boundary</h2>
        <p className="section-sub">Friends-only by design — three quiet guarantees.</p>
        <div className="trust-row">
          <article className="tile">
            <div className="preview soft">password gate</div>
            <h3>Shared secret</h3>
            <p>No public directory. You need the group password to enter.</p>
          </article>
          <article className="tile">
            <div className="preview soft">grade_json</div>
            <h3>Private scores</h3>
            <p>Rubric output never appears on a leaderboard in V1.</p>
          </article>
          <article className="tile">
            <div className="preview soft">DATA_DIR</div>
            <h3>Files on volume</h3>
            <p>Diagrams and audio stay under your attempt paths on the server.</p>
          </article>
        </div>
      </section>

      <section className="statement">
        <div className="mark" aria-hidden>
          SL
        </div>
        <p className="statement-text">Diagram. Talk. Grade. Repeat.</p>
        <p className="statement-prompt">One problem a week. Same friends. Better systems sense.</p>
      </section>

      <section className="section">
        <h2 className="section-head">Questions from the group</h2>
        <p className="section-sub">Short answers for how Study Loop actually runs.</p>
        <Faq />
      </section>

      <section className="final-cta">
        <div className="mark" aria-hidden>
          SL
        </div>
        <h2 className="section-head">Ready for this week?</h2>
        <p className="section-sub">
          Open the live problem, record a walkthrough, and keep the grade private.
        </p>
        <div className="btn-row">
          {featured ? (
            <Link className="btn dark" href={`/problems/${featured.slug}`}>
              Start practice
            </Link>
          ) : null}
          <Link className="btn secondary on-light" href="/roadmap">
            Browse roadmap
          </Link>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <strong>Study Loop</strong>
            Friends-only system-design practice. Weekly problem, private rubric,
            Discord when we publish.
          </div>
          <div className="footer-col">
            <h4>Practice</h4>
            <Link href="/">This week</Link>
            <Link href="/roadmap">Roadmap</Link>
            {featured ? <Link href={`/problems/${featured.slug}`}>Open problem</Link> : null}
          </div>
          <div className="footer-col">
            <h4>Group</h4>
            <Link href="/rooms">Rooms</Link>
            <Link href="/admin/new">Admin</Link>
            <a href="#faq">FAQ</a>
            <a href="#how">How it works</a>
          </div>
          <div className="footer-col">
            <h4>Notes</h4>
            <span>Private grades</span>
            <span style={{ display: "block", marginTop: "0.4rem" }}>No public signup</span>
            <span style={{ display: "block", marginTop: "0.4rem" }}>Server-side capture</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Study Loop · friends only</span>
          <span>Built for system-design practice</span>
        </div>
      </footer>
    </>
  );
}
