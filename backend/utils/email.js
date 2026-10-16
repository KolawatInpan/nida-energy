/**
 * Email utility — the ONLY place this app sends mail from.
 * Env: GMAIL_USER, GMAIL_PASS (fallback to SMTP_HOST/SMTP_PORT if set)
 *      MAIL_FROM, ADMIN_EMAIL
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
 * The From address for every outgoing message — single source of truth.
 *
 * This app has exactly two addresses: the shared admin address and the shared user
 * address. There is deliberately no invented third address — when nothing is
 * configured we fall back to the admin address, so the From header always resolves
 * to an address that actually exists in this system.
 *
 * Set MAIL_FROM to override (a display name is allowed: 'NIDA Energy <a@b.c>').
 */
function getMailFrom() {
  return process.env.MAIL_FROM
    || process.env.GMAIL_USER
    || process.env.SMTP_USER
    || process.env.ADMIN_EMAIL
    || 'blockchain.admin@nida.ac.th';
}

/**
 * Send an email.
 * @param {Object} opts
 * @param {string} opts.to - recipient email
 * @param {string} opts.subject - subject line
 * @param {string} opts.html - HTML body
 * @param {string} [opts.text] - plain text fallback
 * @param {string} [opts.fromName] - optional display name for the From header
 */
async function sendEmail({ to, subject, html, text = null, fromName = null } = {}) {
  if (!to) throw new Error('Email recipient (to) is required');

  const address = getMailFrom();
  // Only wrap in a display name when MAIL_FROM did not already supply one.
  const from = fromName && !String(address).includes('<') ? `"${fromName}" <${address}>` : address;

  // `text || html ? ... : ...` used to be written inline here, which parses as
  // `(text || html) ? ... : ...` — so an explicit `text` was silently discarded and
  // replaced by tag-stripped HTML. Compute the plain-text part explicitly instead.
  const plainText = text != null
    ? String(text)
    : String(html || '').replace(/<[^>]*>/g, '');

  const mailer = getTransporter();
  const info = await mailer.sendMail({
    from,
    to,
    subject: String(subject || 'NIDA Energy Notification'),
    html: html || '',
    text: plainText,
  });
  return info;
}

module.exports = {
  sendEmail,
  getTransporter,
  getMailFrom,
};
