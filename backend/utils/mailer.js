import nodemailer from "nodemailer";

// Sends the password-reset email via Gmail SMTP (a personal/free Gmail
// account works fine — no paid email service needed). Follows the same
// graceful pattern as the rest of this app's optional integrations: never
// throws on missing config, warns once, and callers get a clear
// "not configured" error to show the user instead of a crash.
let transporter = null;
let warnedMissingConfig = false;

const getTransporter = () => {
  if (transporter) return transporter;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_APP_PASSWORD;
  if (!user || !pass) {
    if (!warnedMissingConfig) {
      console.warn(
        "⚠️  Password-reset email isn't configured — set EMAIL_USER and EMAIL_APP_PASSWORD in backend/.env (see backend/.env.example)."
      );
      warnedMissingConfig = true;
    }
    return null;
  }
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return transporter;
};

export const isEmailConfigured = () => !!getTransporter();

// Emails the expense sheet as an .xlsx attachment. The recipient doesn't need
// a Google account, a shared folder, or any setup at all — and from Gmail,
// "Open with Google Sheets" turns it into a live Sheet in one click.
export const sendExpenseSheetEmail = async ({ toEmail, fileName, buffer, count, total, note }) => {
  const t = getTransporter();
  if (!t) {
    throw new Error(
      "Email isn't configured on the server yet — EMAIL_USER and EMAIL_APP_PASSWORD need to be set."
    );
  }
  const money = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(total || 0);

  await t.sendMail({
    from: `"Kushal Timbers Expense Tracker" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Kushal Timbers — expense sheet (${new Date().toLocaleDateString("en-IN")})`,
    html: `
      <p>Here is the current expense sheet from the Kushal Timbers tracker.</p>
      <p><strong>${count}</strong> ${count === 1 ? "entry" : "entries"}, totalling <strong>${money}</strong>.</p>
      ${note ? `<p style="white-space:pre-wrap">${note}</p>` : ""}
      <p style="color:#666;font-size:13px">
        The attached file opens in Excel, or in Google Sheets — from Gmail, click the attachment
        and choose "Open with Google Sheets".
      </p>
    `,
    attachments: [
      {
        filename: fileName,
        content: buffer,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  });
};

export const sendPasswordResetEmail = async (toEmail, resetUrl) => {
  const t = getTransporter();
  if (!t) {
    throw new Error("Password-reset email isn't configured on the server yet.");
  }
  await t.sendMail({
    from: `"Kushal Timbers Expense Tracker" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Reset your password — Kushal Timbers Expense Tracker",
    html: `
      <p>Someone (hopefully you) asked to reset the password for this account.</p>
      <p><a href="${resetUrl}">Click here to choose a new password</a>. This link works for 15 minutes.</p>
      <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>
    `,
  });
};
