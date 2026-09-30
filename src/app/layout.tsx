import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/app/LogoutButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "System Design Study Loop",
  description: "Friends-only weekly system-design practice",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="en">
      <body>
        {session ? (
          <nav className="nav">
            <Link href="/">Home</Link>
            <Link href="/roadmap" data-testid="nav-roadmap">
              Roadmap
            </Link>
            <Link href="/admin/new">Admin</Link>
            <span className="spacer" />
            <span className="muted">{session.displayName}</span>
            <LogoutButton />
          </nav>
        ) : null}
        <main>{children}</main>
      </body>
    </html>
  );
}
