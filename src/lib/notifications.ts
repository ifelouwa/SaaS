/**
 * Automated notifications module for Atelier.
 * Supports Resend for transactional emails (with .ics calendar attachment)
 * and Twilio for SMS reminders, with graceful console simulation when keys are absent.
 */

export type BookingNotificationPayload = {
  appointmentId: string;
  salonName: string;
  salonSlug: string;
  salonEmail?: string | null;
  salonPhone?: string | null;
  salonAddress?: string | null;
  ownerEmail?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  serviceName: string;
  serviceDuration: number;
  servicePriceCents: number;
  staffName: string;
  startsAt: Date;
  endsAt: Date;
};

/**
 * Generates an RFC 5545 compliant iCalendar (.ics) string
 */
export function generateIcsCalendar(payload: BookingNotificationPayload): string {
  function formatUtc(d: Date): string {
    return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  }

  const dtStamp = formatUtc(new Date());
  const dtStart = formatUtc(payload.startsAt);
  const dtEnd = formatUtc(payload.endsAt);
  const summary = `${payload.serviceName} at ${payload.salonName}`;
  const description = `Appointment with ${payload.staffName}\\nService: ${payload.serviceName}\\nSalon: ${payload.salonName}\\nContact: ${payload.salonPhone || "N/A"}`;
  const location = payload.salonAddress ? `${payload.salonAddress}` : payload.salonName;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Atelier SaaS//Salon Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:atelier-${payload.appointmentId}@${payload.salonSlug}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "TRIGGER:-PT24H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Appointment Reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Sends booking confirmation email to customer (with ICS invite) + SMS if phone is present.
 */
export async function sendCustomerBookingConfirmation(
  payload: BookingNotificationPayload
): Promise<{ success: boolean; simulated?: boolean }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Atelier Bookings <bookings@atelier.dev>";
  const icsData = generateIcsCalendar(payload);
  const base64Ics = Buffer.from(icsData).toString("base64");

  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(payload.servicePriceCents / 100);

  const formattedDate = payload.startsAt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = payload.startsAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [payload.customerEmail],
          subject: `Confirmed: Your appointment at ${payload.salonName}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
              <h2 style="font-size: 22px; font-weight: 600; margin-bottom: 8px;">Appointment Confirmed!</h2>
              <p style="font-size: 15px; color: #555; margin-bottom: 24px;">Hi ${payload.customerName}, your appointment at <strong>${payload.salonName}</strong> has been confirmed.</p>
              
              <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
                <p style="margin: 0 0 10px 0; font-size: 14px;"><strong>Service:</strong> ${payload.serviceName} (${payload.serviceDuration} min)</p>
                <p style="margin: 0 0 10px 0; font-size: 14px;"><strong>Stylist:</strong> ${payload.staffName}</p>
                <p style="margin: 0 0 10px 0; font-size: 14px;"><strong>Date &amp; Time:</strong> ${formattedDate} at ${formattedTime}</p>
                <p style="margin: 0; font-size: 14px;"><strong>Price:</strong> ${formattedPrice}</p>
              </div>

              <p style="font-size: 13px; color: #777;">A calendar invite (.ics) has been attached to this email. You can add it directly to Apple Calendar, Google Calendar, or Outlook.</p>
            </div>
          `,
          attachments: [
            {
              filename: "appointment.ics",
              content: base64Ics,
            },
          ],
        }),
      });

      if (!res.ok) {
        console.error("Resend API failed:", await res.text());
      }
    } catch (err) {
      console.error("Failed to send Resend email:", err);
    }
  } else {
    // Graceful developer console simulation
    console.log(`[NOTIFICATIONS: SIMULATED EMAIL to ${payload.customerEmail}]`);
    console.log(`Subject: Confirmed: ${payload.serviceName} at ${payload.salonName}`);
    console.log(`When: ${formattedDate} at ${formattedTime}`);
    console.log(`Attached: appointment.ics (${icsData.length} bytes)`);
  }

  // Trigger SMS if Twilio is configured and customer phone provided
  if (payload.customerPhone) {
    await sendSmsNotification(
      payload.customerPhone,
      `Reminder from ${payload.salonName}: Your appointment for ${payload.serviceName} with ${payload.staffName} is confirmed for ${formattedDate} at ${formattedTime}.`
    );
  }

  return { success: true, simulated: !resendApiKey };
}

/**
 * Sends alert to the salon owner whenever a new booking is placed online.
 */
export async function sendOwnerNewBookingAlert(
  payload: BookingNotificationPayload
): Promise<{ success: boolean; simulated?: boolean }> {
  const recipient = payload.ownerEmail || payload.salonEmail;
  if (!recipient) return { success: false };

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Atelier Bookings <bookings@atelier.dev>";

  const formattedDate = payload.startsAt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const formattedTime = payload.startsAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (resendApiKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [recipient],
          subject: `New Booking: ${payload.customerName} - ${payload.serviceName}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
              <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">New Online Booking Received</h2>
              <p style="font-size: 14px; color: #555; margin-bottom: 20px;">A new appointment has been scheduled through your public booking page.</p>

              <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Client:</strong> ${payload.customerName} (${payload.customerEmail} ${payload.customerPhone ? "• " + payload.customerPhone : ""})</p>
                <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Service:</strong> ${payload.serviceName} (${payload.serviceDuration} min)</p>
                <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Stylist:</strong> ${payload.staffName}</p>
                <p style="margin: 0; font-size: 14px;"><strong>Time:</strong> ${formattedDate} at ${formattedTime}</p>
              </div>

              <p style="font-size: 13px;"><a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/dashboard/appointments" style="color: #0066cc;">Open Today's Book in Dashboard →</a></p>
            </div>
          `,
        }),
      });
    } catch (err) {
      console.error("Failed to send owner alert via Resend:", err);
    }
  } else {
    console.log(`[NOTIFICATIONS: SIMULATED OWNER ALERT to ${recipient}]`);
    console.log(`New Booking: ${payload.customerName} booked ${payload.serviceName} with ${payload.staffName} for ${formattedDate} at ${formattedTime}`);
  }

  return { success: true, simulated: !resendApiKey };
}

/**
 * SMS sender via Twilio or fallback simulation.
 */
export async function sendSmsNotification(
  toPhone: string,
  messageText: string
): Promise<{ success: boolean; simulated?: boolean }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_FROM_PHONE;

  if (accountSid && authToken && fromPhone) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const body = new URLSearchParams({
        To: toPhone,
        From: fromPhone,
        Body: messageText,
      });

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!res.ok) {
        console.error("Twilio SMS send error:", await res.text());
      }
    } catch (err) {
      console.error("Twilio request error:", err);
    }
    return { success: true, simulated: false };
  } else {
    console.log(`[NOTIFICATIONS: SIMULATED SMS to ${toPhone}]: "${messageText}"`);
    return { success: true, simulated: true };
  }
}
