import { NextResponse } from "next/server";
import { canSeeClinical, requireUser } from "@/lib/access";
import { ServiceError } from "@/lib/errors";
import { readClinicalPhoto } from "@/services/clinical-photo.service";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canSeeClinical(user)) {
    return NextResponse.json({ message: "Foto rekam medis hanya untuk dokter dan pemilik" }, { status: 403 });
  }
  const { id } = await context.params;
  try {
    const photo = await readClinicalPhoto(user, id);
    if (!photo) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(photo.bytes), {
      headers: {
        "Content-Type": photo.contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    throw error;
  }
}
