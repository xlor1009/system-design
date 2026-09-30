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
    <>
      <h1>{problem.title}</h1>
      <p className="muted">
        {problem.weekOf} · {problem.timeboxMinutes} min · due{" "}
        {new Date(problem.dueAt).toLocaleString()}
      </p>
      <div className="prompt">{problem.promptMd}</div>
      <SubmitForm slug={problem.slug} initialAttempt={attempt} />
    </>
  );
}
