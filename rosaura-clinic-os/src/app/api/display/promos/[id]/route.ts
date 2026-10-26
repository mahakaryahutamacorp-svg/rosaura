import { NextResponse } from "next/server";
import { requireUser } from "@/lib/access";
import { ServiceError } from "@/lib/errors";
import { readDisplayPromo } from "@/services/display-promo.service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await context.params;
  try {
    const photo = await readDisplayPromo(id);
    if (!photo) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(photo.bytes), {
      headers: {
        "Content-Type": photo.contentType,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    throw error;
  }
}
