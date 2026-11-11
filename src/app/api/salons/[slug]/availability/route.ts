import { NextResponse } from "next/server";
import { computeAvailability } from "@/lib/availability";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);

    const dateStr = searchParams.get("date");
    const serviceId = searchParams.get("serviceId");
    const staffId = searchParams.get("staffId") || undefined;

    if (!dateStr || !serviceId) {
      return NextResponse.json(
        { error: "Query parameters 'date' (YYYY-MM-DD) and 'serviceId' are required." },
        { status: 400 }
      );
    }

    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json(
        { error: "Invalid date format. Expected YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const availability = await computeAvailability({
      salonSlug: slug,
      dateStr,
      serviceId,
      staffId,
    });

    return NextResponse.json(availability, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: unknown) {
    console.error("Availability API error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
