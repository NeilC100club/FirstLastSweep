import nodemailer from "nodemailer";

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function sendPurchaseConfirmation({
  to,
  buyerName,
  sweepName,
  minutes,
  pricePerMinute,
  eventDate,
  kickoffTime,
  sweepUrl,
}: {
  to: string;
  buyerName: string;
  sweepName: string;
  minutes: number[];
  pricePerMinute: number; // pence
  eventDate: string | null;
  kickoffTime: string | null;
  sweepUrl: string;
}) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error("Email: GMAIL_USER or GMAIL_APP_PASSWORD not set — skipping send");
    return;
  }

  const total = ((minutes.length * pricePerMinute) / 100).toFixed(2);
  const minuteList = minutes.slice().sort((a, b) => a - b).join(", ");
  const when = [eventDate, kickoffTime ? `${kickoffTime.slice(0, 5)} kickoff` : null]
    .filter(Boolean)
    .join(" · ");

  const subject = `You're in! Minute${minutes.length > 1 ? "s" : ""} ${minuteList} — ${sweepName}`;

  const text = `Hi ${buyerName},

You're confirmed for the First and Last Goal Sweep.

Sweep: ${sweepName}
${when ? `When: ${when}\n` : ""}Minute${minutes.length > 1 ? "s" : ""}: ${minuteList}
Paid: £${total}

Half of everything collected goes into the prize pot, and half goes to the Newport County 100 Club fundraising pot. If the goal your minute needs doesn't land exactly — including 0-0 or an injury-time goal — that share goes to the 100 Club too.

You can check the board any time here:
${sweepUrl}

Good luck!
Newport County 100 Club`;

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #173620;">
      <div style="background: #C9A227; color: #241C00; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">You're in! 🎉</h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px;">
        <p>Hi ${buyerName},</p>
        <p>You're confirmed for the <strong>First and Last Goal Sweep</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 6px 0; color: #666;">Sweep</td><td style="padding: 6px 0; text-align: right; font-weight: bold;">${sweepName}</td></tr>
          ${when ? `<tr><td style="padding: 6px 0; color: #666;">When</td><td style="padding: 6px 0; text-align: right;">${when}</td></tr>` : ""}
          <tr><td style="padding: 6px 0; color: #666;">Minute${minutes.length > 1 ? "s" : ""}</td><td style="padding: 6px 0; text-align: right; font-weight: bold;">${minuteList}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Paid</td><td style="padding: 6px 0; text-align: right; font-weight: bold;">£${total}</td></tr>
        </table>
        <p style="font-size: 13px; color: #666; line-height: 1.5;">
          Half of everything collected goes into the prize pot, half goes to the Newport County 100 Club fundraising pot.
          If the goal your minute needs doesn't land exactly — including a 0-0 result or an injury-time goal —
          that share goes to the 100 Club too.
        </p>
        <div style="text-align: center; margin: 24px 0 8px;">
          <a href="${sweepUrl}" style="background: #C9A227; color: #241C00; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">View the board</a>
        </div>
        <p style="text-align: center; font-size: 12px; color: #999; margin-top: 20px;">Good luck! — Newport County 100 Club</p>
      </div>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: `"Newport County 100 Club" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log("Email: confirmation sent to", to);
  } catch (err) {
    // Never let an email failure block the purchase itself — just log it.
    console.error("Email: failed to send confirmation", err);
  }
}
