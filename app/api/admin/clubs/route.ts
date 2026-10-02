import { NextResponse } from "next/server";
import { requireAdmin, textColourFor, slugify, HEX } from "@/lib/adminApi";

type ClubInput = {
  id?: string;
  name?: string;
  short_name?: string;
  slug?: string;
  fundraiser_name?: string;
  primary_color?: string;
  secondary_color?: string;
};

function clean(body: ClubInput) {
  const name = (body.name || "").trim();
  const short_name = (body.short_name || "").trim() || name;
  const slug = slugify(body.slug || short_name);
  const fundraiser_name = (body.fundraiser_name || "").trim() || "Club Fund";
  const primary_color = body.primary_color || "#F2A900";
  const secondary_color = body.secondary_color || "#161412";
  if (!name) return { error: "Give the club a name." };
  if (!slug) return { error: "The web address needs some letters or numbers." };
  if (!HEX.test(primary_color) || !HEX.test(secondary_color)) return { error: "Pick the club colours again." };
  return {
    row: {
      name,
      short_name,
      slug,
      fundraiser_name,
      primary_color,
      secondary_color,
      text_on_primary: textColourFor(primary_color),
    },
  };
}

function friendly(error: { code?: string; message: string }) {
  // 23505 = a duplicate of something that must be unique.
  if (error.code === "23505" && error.message.includes("slug"))
    return "Another club already uses that web address — choose a different one.";
  if (error.code === "23505" && error.message.includes("short_name"))
    return "Another club already uses that short name.";
  if (error.message.includes("slug"))
    return "The database hasn't been updated for club links yet — run the club organisers SQL in Supabase first.";
  return error.message;
}

// Add a club.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const result = clean((await request.json()) as ClubInput);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  const { data, error } = await auth.service.from("clubs").insert(result.row).select().single();
  if (error) return NextResponse.json({ error: friendly(error) }, { status: 400 });
  return NextResponse.json({ club: data });
}

// Edit a club's name, web address, fundraiser name or colours.
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const body = (await request.json()) as ClubInput;
  if (!body.id) return NextResponse.json({ error: "Which club?" }, { status: 400 });
  const result = clean(body);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  const { error } = await auth.service.from("clubs").update(result.row).eq("id", body.id);
  if (error) return NextResponse.json({ error: friendly(error) }, { status: 400 });
  return NextResponse.json({ ok: true });
}
