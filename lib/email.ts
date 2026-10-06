import nodemailer from "nodemailer";
import { pounds, type SweepResult } from "@/lib/results";

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
  clubName = "Newport County 100 Club",
  fundraiserName = "100 Club",
  accentColor = "#C9A227",
  textOnAccent = "#241C00",
  paidCash = false,
}: {
  paidCash?: boolean;
  to: string;
  buyerName: string;
  sweepName: string;
  minutes: number[];
  pricePerMinute: number; // pence
  eventDate: string | null;
  kickoffTime: string | null;
  sweepUrl: string;
  clubName?: string;
  fundraiserName?: string;
  accentColor?: string;
  textOnAccent?: string;
}) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error("Email: GMAIL_USER or GMAIL_APP_PASSWORD not set — skipping send");
    return;
  }

  const total = ((minutes.length * pricePerMinute) / 100).toFixed(2) + (paidCash ? " (cash)" : "");
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

Half of everything collected goes into the prize pot, and half goes to the ${clubName} ${fundraiserName} fundraising pot. If the goal your minute needs doesn't land exactly — including 0-0 or an injury-time goal — that share goes to the ${fundraiserName} too.

You can check the board any time here:
${sweepUrl}

Good luck!
${clubName} ${fundraiserName}`;

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #173620;">
      <div style="background: ${accentColor}; color: ${textOnAccent}; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
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
          Half of everything collected goes into the prize pot, half goes to the ${clubName} ${fundraiserName} fundraising pot.
          If the goal your minute needs doesn't land exactly — including a 0-0 result or an injury-time goal —
          that share goes to the ${fundraiserName} too.
        </p>
        <div style="text-align: center; margin: 24px 0 8px;">
          <a href="${sweepUrl}" style="background: ${accentColor}; color: ${textOnAccent}; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">View the board</a>
        </div>
        <p style="text-align: center; font-size: 12px; color: #999; margin-top: 20px;">Good luck! — ${clubName} ${fundraiserName}</p>
      </div>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: `"${clubName} ${fundraiserName}" <${process.env.GMAIL_USER}>`,
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

// Sent to every buyer once the board closes at kick-off: the full board as a PDF.
export async function sendBoardPdf({
  to,
  sweepName,
  eventDate,
  kickoffTime,
  pdf,
  fileName,
  sweepUrl,
  clubName = "Newport County",
  fundraiserName = "100 Club",
  accentColor = "#C9A227",
  textOnAccent = "#241C00",
}: {
  to: string[];
  sweepName: string;
  eventDate: string | null;
  kickoffTime: string | null;
  pdf: Buffer;
  fileName: string;
  sweepUrl: string;
  clubName?: string;
  fundraiserName?: string;
  accentColor?: string;
  textOnAccent?: string;
}): Promise<{ configured: boolean; sent: number; failed: number }> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error("Email: GMAIL_USER or GMAIL_APP_PASSWORD not set — skipping board PDF");
    return { configured: false, sent: 0, failed: 0 };
  }

  const when = [eventDate, kickoffTime ? `${kickoffTime.slice(0, 5)} kickoff` : null]
    .filter(Boolean)
    .join(" · ");
  const subject = `The board is locked — ${sweepName}`;
  const text = `Hi,

The board for ${sweepName}${when ? ` (${when})` : ""} is now locked for kick-off. The full list of who has which minute is attached as a PDF.

You can follow the board live here:
${sweepUrl}

Good luck!
${clubName} ${fundraiserName}`;

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #173620;">
      <div style="background: ${accentColor}; color: ${textOnAccent}; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">The board is locked ⚽</h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px;">
        <p>The board for <strong>${sweepName}</strong>${when ? ` (${when})` : ""} is now locked for kick-off.</p>
        <p>The full list of who has which minute is attached as a PDF.</p>
        <div style="text-align: center; margin: 24px 0 8px;">
          <a href="${sweepUrl}" style="background: ${accentColor}; color: ${textOnAccent}; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Follow the board live</a>
        </div>
        <p style="text-align: center; font-size: 12px; color: #999; margin-top: 20px;">Good luck! — ${clubName} ${fundraiserName}</p>
      </div>
    </div>
  `;

  // One email per buyer, so nobody sees anyone else's email address. A failure
  // for one address is logged and skipped — it never stops the others.
  const transporter = getTransporter();
  let sent = 0;
  let failed = 0;
  for (const address of to) {
    try {
      await transporter.sendMail({
        from: `"${clubName} ${fundraiserName}" <${process.env.GMAIL_USER}>`,
        to: address,
        subject,
        text,
        html,
        attachments: [{ filename: fileName, content: pdf, contentType: "application/pdf" }],
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error("Email: failed to send board PDF to", address, err);
    }
  }
  console.log("Email: board PDF sent", { sent, failed });
  return { configured: true, sent, failed };
}

// Sent to every buyer with an email once the organiser enters the result.
// Each person gets their own email, and winners get told they've won.
export async function sendResults({
  to,
  sweepName,
  eventDate,
  result,
  pdf,
  fileName,
  sweepUrl,
  clubName = "NCAFC",
  fundraiserName = "100 Club",
  accentColor = "#C9A227",
  textOnAccent = "#241C00",
}: {
  to: string[];
  sweepName: string;
  eventDate: string | null;
  result: SweepResult;
  pdf: Buffer;
  fileName: string;
  sweepUrl: string;
  clubName?: string;
  fundraiserName?: string;
  accentColor?: string;
  textOnAccent?: string;
}): Promise<{ configured: boolean; sent: number; failed: number }> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error("Email: GMAIL_USER or GMAIL_APP_PASSWORD not set — skipping results");
    return { configured: false, sent: 0, failed: 0 };
  }

  // One line per goal, e.g. "First goal — minute 23: Dave Jones wins £21.00"
  const goalLines: string[] = [];
  if (result.noGoals) {
    goalLines.push(`It finished 0-0, so everything goes to the ${fundraiserName}.`);
  } else if (result.sameWinner) {
    const g = result.goals[0];
    goalLines.push(
      `First and last goal — minute ${g.minute} (the only goal): ${g.winnerName} wins ${pounds(g.prize * 2)}`
    );
  } else {
    for (const g of result.goals) {
      if (!g.minute) goalLines.push(`${g.label}: no winner — that share goes to the ${fundraiserName}`);
      else if (!g.winnerName)
        goalLines.push(`${g.label} — minute ${g.minute}: nobody had it, so it goes to the ${fundraiserName}`);
      else goalLines.push(`${g.label} — minute ${g.minute}: ${g.winnerName} wins ${pounds(g.prize)}`);
    }
  }
  const fundLine = `${pounds(result.toFund)} raised for the ${clubName} ${fundraiserName}`;

  const transporter = getTransporter();
  let sent = 0;
  let failed = 0;

  for (const address of to) {
    const winnings = result.goals
      .filter((g) => g.winnerEmail && g.winnerEmail.toLowerCase() === address)
      .reduce((sum, g) => sum + g.prize, 0);
    const won = winnings > 0;
    const subject = won ? `🏆 You've won ${pounds(winnings)} — ${sweepName}` : `Results — ${sweepName}`;
    const intro = won
      ? `Congratulations — you've won ${pounds(winnings)} in the ${sweepName} sweep! The organiser will be in touch to pay you.`
      : `The result is in for the ${sweepName} sweep${eventDate ? ` (${eventDate})` : ""}. Thanks for taking part.`;

    const text = `Hi,

${intro}

${goalLines.join("\n")}
${fundLine}

The final board is attached as a PDF, and you can see it here:
${sweepUrl}

Thank you for supporting the ${fundraiserName}!
${clubName} ${fundraiserName}`;

    const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #173620;">
      <div style="background: ${accentColor}; color: ${textOnAccent}; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">${won ? `You've won ${pounds(winnings)}! 🏆` : "The result is in ⚽"}</h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px;">
        <p>${intro}</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          ${goalLines
            .map((l) => `<tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${l}</td></tr>`)
            .join("")}
          <tr><td style="padding: 8px 0; font-weight: bold;">${fundLine}</td></tr>
        </table>
        <p style="font-size: 13px; color: #666;">The final board is attached as a PDF.</p>
        <div style="text-align: center; margin: 24px 0 8px;">
          <a href="${sweepUrl}" style="background: ${accentColor}; color: ${textOnAccent}; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">See the final board</a>
        </div>
        <p style="text-align: center; font-size: 12px; color: #999; margin-top: 20px;">Thank you for supporting the ${fundraiserName}! — ${clubName}</p>
      </div>
    </div>`;

    try {
      await transporter.sendMail({
        from: `"${clubName} ${fundraiserName}" <${process.env.GMAIL_USER}>`,
        to: address,
        subject,
        text,
        html,
        attachments: [{ filename: fileName, content: pdf, contentType: "application/pdf" }],
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error("Email: failed to send results to", address, err);
    }
  }
  console.log("Email: results sent", { sent, failed });
  return { configured: true, sent, failed };
}
