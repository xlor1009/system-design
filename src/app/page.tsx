import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listProblems } from "@/lib/db";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const problems = listProblems();

  return (
    <>
      <h1>System Design Study Loop</h1>
      <p className="muted">
        Timed practice: diagram + audio + transcript → private AI rubric grade.
      </p>

      <h2>Problems</h2>
      <ul className="roadmap-list">
        {problems.map((p) => (
          <li key={p.id}>
            <Link href={`/problems/${p.slug}`} data-testid={`problem-link-${p.slug}`}>
              {p.title}
            </Link>
            <div className="muted">
              {p.weekOf} · due {new Date(p.dueAt).toLocaleDateString()} ·{" "}
              {p.timeboxMinutes} min
            </div>
          </li>
        ))}
      </ul>

      <p>
        <Link href="/roadmap" data-testid="roadmap-link">
          View roadmap →
        </Link>
      </p>
    </>
  );
}
