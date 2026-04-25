const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST,
  port:   Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    logger.info(`[Email] Attempting to send email to: ${to}`);
    logger.info(`[Email] SMTP Config: ${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT}`);
    const result = await transporter.sendMail({
      from: `"Real Estate Platform" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    logger.info(`[Email] ✅ Email sent successfully. Message ID: ${result.messageId}`);
    return result;
  } catch (error) {
    logger.error(`[Email] ❌ Failed to send email: ${error.message}`);
    logger.error(`[Email] Error code: ${error.code}`);
    throw error;
  }
};

// ─── Email Verification ───────────────────────────────
exports.sendVerificationEmail = async (email, otp) => {
  const verifyURL = `${process.env.CLIENT_URL}/verify-email/${otp}`;

  await sendEmail({
    to: email,
    subject: 'Email Verification',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px">
        <h2 style="color:#1B3A5C">Verify Your Account</h2>
        <p>Welcome to our Real Estate Platform! Please click the button below to verify your email:</p>
        <a href="${verifyURL}" style="display:inline-block;padding:12px 28px;background:#28A745;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0;font-size:16px">
          Verify Email
        </a>
        <p style="font-size:14px;color:#555">Or use this OTP code: <strong>${otp}</strong></p>
        <p style="color:#888;font-size:13px">If you did not create an account, please ignore this email.</p>
      </div>
    `,
  });
};

// ─── Password Reset ────────────────────────────────
exports.sendPasswordResetEmail = async (email, resetToken) => {
  const resetURL = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
  await sendEmail({
    to: email,
    subject: 'Password Reset',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px">
        <h2 style="color:#1B3A5C">Reset Your Password</h2>
        <p>You requested a password reset. Click the button below:</p>
        <a href="${resetURL}" style="display:inline-block;padding:12px 28px;background:#2E75B6;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0;font-size:16px">
          Reset Password
        </a>
        <p style="color:#888;font-size:13px">This link is valid for 10 minutes only.</p>
        <p style="color:#888;font-size:13px">If you did not request this, please ignore this email.</p>
      </div>
    `,
  });
};

// ─── Booking Confirmation ──────────────────────────
exports.sendBookingConfirmationEmail = async (email, { propertyTitle, startDate, endDate, amount }) => {
  await sendEmail({
    to: email,
    subject: 'Booking Confirmation ✅',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px">
        <h2 style="color:#1A6B3A">Your booking is confirmed!</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Property</td><td style="padding:8px;border:1px solid #ddd">${propertyTitle}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">From</td><td style="padding:8px;border:1px solid #ddd">${new Date(startDate).toLocaleDateString('en-US')}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">To</td><td style="padding:8px;border:1px solid #ddd">${new Date(endDate).toLocaleDateString('en-US')}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Amount</td><td style="padding:8px;border:1px solid #ddd">${amount} USD</td></tr>
        </table>
      </div>
    `,
  });
};

// ─── Auction Winner ───────────────────────────────
exports.sendAuctionWinnerEmail = async (email, { propertyTitle, finalBid }) => {
  await sendEmail({
    to: email,
    subject: 'Auction Winner 🏆',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px">
        <h2 style="color:#1B3A5C">Congratulations! You won the auction 🎉</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Property</td><td style="padding:8px;border:1px solid #ddd">${propertyTitle}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Final Bid</td><td style="padding:8px;border:1px solid #ddd">${finalBid} USD</td></tr>
        </table>
        <p style="margin-top:16px">The property owner will contact you soon to complete the process.</p>
      </div>
    `,
  });
};

// ─── Viewing Request Response ─────────────────────
exports.sendViewingResponseEmail = async (email, { status, propertyTitle, preferredDate, preferredTime }) => {
  const isApproved = status === 'approved';
  await sendEmail({
    to: email,
    subject: isApproved ? 'Viewing Request Approved ✅' : 'Viewing Request Denied ❌',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px">
        <h2 style="color:${isApproved ? '#1A6B3A' : '#C0392B'}">
          ${isApproved ? '✅ Viewing Request Approved' : '❌ Viewing Request Denied'}
        </h2>
        <p>Regarding property: <strong>${propertyTitle}</strong></p>
        ${isApproved ? `
          <p>Scheduled date: <strong>${new Date(preferredDate).toLocaleDateString('en-US')}</strong> at <strong>${preferredTime}</strong></p>
          <p>Please arrive on time.</p>
        ` : '<p>Unfortunately, your request was denied. You may search for other properties.</p>'}
      </div>
    `,
  });
};


