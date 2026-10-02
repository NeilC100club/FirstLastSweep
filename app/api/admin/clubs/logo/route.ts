import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminApi";

const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

// Upload a club badge. Stored in the public "club-logos" bucket in Supabase.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const form = await request.formData();
  const clubId = String(form.get("clubId") || "");
  const file = form.get("file");
  if (!clubId || !file || typeof file === "string") {
    return NextResponse.json({ error: "Choose an image first." }, { status: 400 });
  }
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "The badge needs to be a PNG, JPG, WebP or SVG image." }, { status: 400 });
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "That image is over 2MB — try a smaller one." }, { status: 400 });

  const path = `${clubId}-${Date.now()}.${ext}`;
  const { error: uploadError } = await auth.service.storage
    .from("club-logos")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data } = auth.service.storage.from("club-logos").getPublicUrl(path);
  const { error } = await auth.service.from("clubs").update({ logo_url: data.publicUrl }).eq("id", clubId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logo_url: data.publicUrl });
}
