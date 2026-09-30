import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listRoomsForUser } from "@/lib/db";
import { CreateRoomForm } from "@/app/rooms/CreateRoomForm";

export default async function RoomsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const rooms = listRoomsForUser(session.userId);

  return (
    <div className="shell-main pad">
      <p className="label-caps">Group</p>
      <h1 className="page-title">Rooms</h1>
      <p className="muted">
        Create a room, share the invite link, and race the weekly problem. Winner unlocks when
        everyone has submitted.
      </p>

      <h2 className="page-title" style={{ fontSize: "1.25rem", marginTop: "2.5rem" }}>
        Create a room
      </h2>
      <CreateRoomForm />

      <h2 className="page-title" style={{ fontSize: "1.25rem", marginTop: "3rem" }}>
        Your rooms
      </h2>
      {rooms.length === 0 ? (
        <p className="muted">No rooms yet — create one above or open an invite link.</p>
      ) : (
        <ul className="problem-list">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link
                className="problem-card"
                href={`/rooms/${room.inviteCode}`}
                data-testid={`room-link-${room.inviteCode}`}
              >
                <div className="title">{room.name}</div>
                <div className="caption">Invite code · {room.inviteCode}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
