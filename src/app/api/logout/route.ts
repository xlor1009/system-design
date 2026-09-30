import { logoutResponse } from "@/lib/auth";

export async function POST() {
  return logoutResponse();
}
