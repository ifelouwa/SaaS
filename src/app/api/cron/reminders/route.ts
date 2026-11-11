import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { sendSmsNotification } from "@/lib/notifications";

/**
 * GET /api/cron/reminders
 * Automated cron worker endpoint to dispatch 24-hour appointment reminders.
 * Can be triggered on a schedule (e.g. Vercel Cron, GitHub Actions, or cron job).
 */
export async function GET(request: Request) {
  // Simple bearer token check if CRON_SECRET is configured
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  const now = new Date();

  // Find appointments occurring in 23-25 hours from now
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  try {
    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        status: "CONFIRMED",
        startsAt: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
      include: {
        service: true,
        staff: true,
        salon: true,
      },
    });

    const results = [];

    for (const appt of upcomingAppointments) {
      const formattedTime = appt.startsAt.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      const message = `Reminder from ${appt.salon.name}: You have an appointment tomorrow at ${formattedTime} for ${appt.service.name} with ${appt.staff.name}. Reply or call ${appt.salon.phone || "the salon"} if you need to reschedule.`;

      if (appt.customerPhone) {
        await sendSmsNotification(appt.customerPhone, message);
        results.push({ id: appt.id, customer: appt.customerName, sent: true });
      }
    }

    return NextResponse.json({
      success: true,
      remindersProcessed: upcomingAppointments.length,
      dispatched: results.length,
      timestamp: now.toISOString(),
    });
  } catch (err: unknown) {
    console.error("Cron reminders error:", err);
    return NextResponse.json({ error: "Failed to process appointment reminders." }, { status: 500 });
  }
}
