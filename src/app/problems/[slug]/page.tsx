import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAttempt, getProblemBySlug } from "@/lib/db";
import { SubmitForm } from "./SubmitForm";

export default async function ProblemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { slug } = await params;
  const problem = getProblemBySlug(slug);
  if (!problem) notFound();

  const attempt = getAttempt(problem.id, session.userId);

  return (
    <div className="shell-main pad">
      <p className="label-caps">This week</p>
      <h1 className="page-title">{problem.title}</h1>
      <p className="muted">
        {problem.weekOf} · {problem.timeboxMinutes} min · due{" "}
        {new Date(problem.dueAt).toLocaleString()}
        {problem.sourceRoadmapTopic
          ? ` · topic: ${problem.sourceRoadmapTopic}`
          : null}
      </p>
      {problem.sourceUrl ? (
        <p className="caption" style={{ marginTop: "0.5rem" }}>
          Source:{" "}
          <a href={problem.sourceUrl} target="_blank" rel="noreferrer">
            {problem.sourceUrl.replace(/^https?:\/\//, "")}
          </a>
        </p>
      ) : null}
      <div className="prompt" style={{ whiteSpace: "pre-wrap" }}>
        {problem.promptMd}
      </div>
      <SubmitForm slug={problem.slug} initialAttempt={attempt} />
    </div>
  );
}
