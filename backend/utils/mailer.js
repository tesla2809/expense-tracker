import nodemailer from "nodemailer";

let transporter = null;
let warnedMissingConfig = false;

const getTransporter = () => {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
};

// Never throws — email is a nice-to-have, not something that should ever
// break the daily job or crash the server. Warns once if SMTP isn't
// configured, then quietly no-ops on every call after that.
export const sendMail = async ({ to, subject, html, text }) => {
  const t = getTransporter();
  if (!t) {
    if (!warnedMissingConfig) {
      console.warn(
        "⚠️  Email reminders are not configured — set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS (and optionally EMAIL_FROM) to enable them."
      );
      warnedMissingConfig = true;
    }
    return { sent: false, reason: "not_configured" };
  }

  try {
    await t.sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, to, subject, html, text });
    return { sent: true };
  } catch (error) {
    console.error("Error sending email:", error.message);
    return { sent: false, reason: error.message };
  }
};
