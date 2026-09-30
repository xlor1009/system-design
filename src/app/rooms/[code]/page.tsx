import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ensureRoomMember, getRoomBoard, getRoomByInviteCode } from "@/lib/db";
import { InviteCopy } from "@/app/rooms/[code]/InviteCopy";

async function inviteUrl(code: string): Promise<string> {
  const base = process.env.APP_BASE_URL?.replace(/\/$/, "");
  if (base) return `${base}/rooms/${code}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}/rooms/${code}`;
  return `/rooms/${code}`;
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { code } = await params;
  const room = getRoomByInviteCode(code);
  if (!room) notFound();

  ensureRoomMember(room.id, session.userId);
  const board = getRoomBoard(room.id);
  if (!board) notFound();

  const url = await inviteUrl(room.inviteCode);

  return (
    <div className="shell-main pad">
      <p className="label-caps">Room</p>
      <h1 className="page-title">{board.room.name}</h1>
      <p className="muted">
        Weekly problem for everyone in this room. Scores stay private until all members submit —
        then the winner is revealed.
      </p>

      <InviteCopy url={url} />

      <section style={{ marginTop: "2.5rem" }}>
        <p className="label-caps">This week</p>
        {board.problem ? (
          <div className="tile">
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>{board.problem.title}</h2>
            <p className="muted" style={{ margin: "0.35rem 0 1rem" }}>
              {board.problem.weekOf} · {board.problem.timeboxMinutes} min · due{" "}
              {new Date(board.problem.dueAt).toLocaleDateString()}
            </p>
            <Link
              className="btn dark"
              href={`/problems/${board.problem.slug}`}
              data-testid="room-open-problem"
            >
              Open problem
            </Link>
          </div>
        ) : (
          <p className="muted">No problem published yet. Ask an admin to publish one.</p>
        )}
      </section>

      {board.allSubmitted && board.winner ? (
        <section className="tile" style={{ marginTop: "2rem" }} data-testid="room-winner">
          <p className="label-caps">Winner</p>
          <h2 style={{ margin: "0.25rem 0", fontSize: "1.5rem" }}>
            {board.winner.displayName}
          </h2>
          <p className="muted" style={{ margin: "0 0 1rem" }}>
            {board.winner.overallScore}/{board.winner.overallMax}
          </p>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{board.winner.why}</p>
        </section>
      ) : null}

      <section style={{ marginTop: "2rem" }}>
        <h2 className="page-title" style={{ fontSize: "1.2rem" }}>
          Waiting on
        </h2>
        {board.waiting.length === 0 ? (
          <p className="muted">Everyone has submitted.</p>
        ) : (
          <ul className="roadmap-list" data-testid="room-waiting">
            {board.waiting.map((m) => (
              <li key={m.userId}>
                <strong>{m.displayName}</strong>
                <div className="caption">Not submitted yet</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2 className="page-title" style={{ fontSize: "1.2rem" }}>
          Submitted
        </h2>
        {board.submitted.length === 0 ? (
          <p className="muted">No submissions yet.</p>
        ) : (
          <ul className="roadmap-list" data-testid="room-submitted">
            {board.submitted.map((m) => (
              <li key={m.userId}>
                <strong>{m.displayName}</strong>
                <div className="caption">
                  {m.style === "interview" ? "Live interview" : "Diagram"}
                  {" · "}
                  {board.allSubmitted
                    ? "In"
                    : "Score hidden until everyone finishes"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p style={{ marginTop: "2rem" }}>
        <Link href="/rooms">← All rooms</Link>
      </p>
    </div>
  );
}
