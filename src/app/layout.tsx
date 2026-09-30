import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/app/LogoutButton";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Study Loop",
  description: "Friends-only weekly system-design practice",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="en" className={sans.variable}>
      <body className="shell">
        <div className="pill-nav-wrap">
          <nav className="pill-nav" aria-label="Primary">
            <Link href={session ? "/" : "/login"} className="wordmark">
              Study Loop
            </Link>
            {session ? (
              <>
                <div className="links">
                  <Link href="/">Home</Link>
                  <Link href="/rooms" data-testid="nav-rooms">
                    Rooms
                  </Link>
                  <Link href="/roadmap" data-testid="nav-roadmap">
                    Roadmap
                  </Link>
                  <Link href="/admin/new">Admin</Link>
                  <span className="nav-name">{session.displayName}</span>
                </div>
                <LogoutButton />
              </>
            ) : (
              <Link href="/login" className="nav-cta">
                Join
              </Link>
            )}
          </nav>
        </div>
        <div className="shell-main">{children}</div>
      </body>
    </html>
  );
}
