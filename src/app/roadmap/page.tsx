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
    <div className="shell-main pad">
      <p className="label-caps">Curriculum</p>
      <h1 className="page-title">Roadmap</h1>
      <p className="muted">
        Topics we cycle through for weekly practice. Deep-links go to{" "}
        <a href="https://roadmap.sh/system-design" target="_blank" rel="noreferrer">
          roadmap.sh/system-design
        </a>
        ; weekly prompts are our rewrites with links to systemdesign.io.
      </p>

      <ol
        className="roadmap-list"
        style={{ listStyle: "decimal", paddingLeft: "1.25rem" }}
      >
        {items.map((item) => (
          <li key={item.id} data-testid={`roadmap-item-${item.orderIndex}`}>
            {item.sourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                data-testid="roadmap-link"
              >
                {item.topic}
              </a>
            ) : (
              <span data-testid="roadmap-link">{item.topic}</span>
            )}
            {item.notesMd ? <div className="muted">{item.notesMd}</div> : null}
          </li>
        ))}
      </ol>

      <h2 className="page-title" style={{ fontSize: "1.35rem", marginTop: "2.5rem" }}>
        Published problems
      </h2>
      <ul className="problem-list">
        {problems.map((p) => (
          <li key={p.id}>
            <Link
              className="problem-card"
              href={`/problems/${p.slug}`}
              data-testid={`roadmap-problem-${p.slug}`}
            >
              <div className="title">{p.title}</div>
              <div className="caption">{p.weekOf}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
