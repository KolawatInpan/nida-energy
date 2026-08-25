/**
 * Email utility — send notification emails via nodemailer (Gmail SMTP).
 * Env: GMAIL_USER, GMAIL_PASS (fallback to SMTP_HOST/SMTP_PORT if set)
 */
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;

  if (user && pass) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  } else if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    });
  } else {
    // Fall back to a no-op transporter so callers can fire-and-forget safely
    console.warn('[email] SMTP not configured (GMAIL_USER/PASS or SMTP_HOST) — email disabled');
    transporter = {
      sendMail: async () => ({ messageId: 'disabled', rejected: [] }),
      verify: async () => false,
    };
  }

  return transporter;
}

/**
 * Send an email.
 * @param {Object} opts
 * @param {string} opts.to - recipient email
 * @param {string} opts.subject - subject line
 * @param {string} opts.html - HTML body
 * @param {string} [opts.text] - plain text fallback
 */
async function sendEmail({ to, subject, html, text = null } = {}) {
  if (!to) throw new Error('Email recipient (to) is required');

  const mailer = getTransporter();
  const info = await mailer.sendMail({
    from: process.env.GMAIL_USER || process.env.SMTP_USER || 'NIDA Energy <no-reply@nida.ac.th>',
    to,
    subject: String(subject || 'NIDA Energy Notification'),
    html: html || '',
    text: text || html ? String(html).replace(/<[^>]*>/g, '') : '',
  });
  return info;
}

module.exports = {
  sendEmail,
  getTransporter,
};
