import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listRoadmapItems, listProblems } from "@/lib/db";

export default async function RoadmapPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const items = listRoadmapItems();
  const problems = listProblems();

  return (
    <>
      <h1>Roadmap</h1>
      <p className="muted">Topics we cycle through for weekly practice.</p>

      <ol className="roadmap-list" style={{ listStyle: "decimal", paddingLeft: "1.25rem" }}>
        {items.map((item) => (
          <li key={item.id} data-testid={`roadmap-item-${item.orderIndex}`}>
            <span data-testid="roadmap-link">{item.topic}</span>
            {item.notesMd ? <div className="muted">{item.notesMd}</div> : null}
          </li>
        ))}
      </ol>

      <h2>Published problems</h2>
      <ul className="roadmap-list">
        {problems.map((p) => (
          <li key={p.id}>
            <Link href={`/problems/${p.slug}`} data-testid={`roadmap-problem-${p.slug}`}>
              {p.title}
            </Link>
            <span className="muted"> · {p.weekOf}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
