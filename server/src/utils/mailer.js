import nodemailer from "nodemailer";

function toBoolean(value, fallback = false) {
  if (value == null) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function getMailConfig() {
  const host = process.env.SMTP_HOST || "";
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const from = process.env.SMTP_FROM || user;
  const secure = toBoolean(process.env.SMTP_SECURE ?? process.env.SMTP_USE_SSL, port === 465);

  return {
    configured: Boolean(host && port && user && pass && from),
    host,
    port,
    user,
    pass,
    from,
    secure,
  };
}

export function isMailConfigured() {
  return getMailConfig().configured;
}

export async function sendPasswordResetOtpEmail({ to, otp, name }) {
  const config = getMailConfig();

  if (!config.configured) {
    throw new Error("Password reset email service is not configured.");
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const greetingName = String(name || "there").trim() || "there";

  await transporter.sendMail({
    from: config.from,
    to,
    subject: "Your Smart Electricity password reset OTP",
    text: `Hello ${greetingName},\n\nYour OTP for resetting your Smart Electricity Tracker password is ${otp}. This code expires in 10 minutes.\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 12px;">Password reset OTP</h2>
        <p style="margin:0 0 16px;">Hello ${greetingName},</p>
        <p style="margin:0 0 16px;">Use this one-time code to reset your Smart Electricity Tracker password:</p>
        <div style="margin:20px 0;padding:16px 20px;border-radius:14px;background:#111827;color:#FFB800;font-size:28px;font-weight:700;letter-spacing:0.2em;text-align:center;">
          ${otp}
        </div>
        <p style="margin:0 0 16px;">This OTP expires in <strong>10 minutes</strong>.</p>
        <p style="margin:0;color:#6B7280;">If you did not request this reset, you can safely ignore this email.</p>
      </div>
    `,
  });
}
