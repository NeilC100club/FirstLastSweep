import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

// For super-user-only API routes. Returns the service client if the caller is a super user.
export async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  if (!(await isAdmin(supabase, user.id))) {
    return { error: NextResponse.json({ error: "Super users only." }, { status: 403 }) };
  }
  return { service: createServiceClient(), user };
}

// Black or white text, whichever reads better on the given background colour.
export function textColourFor(hex: string): string {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.substring(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.55 ? "#161412" : "#FFFFFF";
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export const HEX = /^#[0-9a-fA-F]{6}$/;
