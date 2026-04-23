const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "khalf9hussein2@gmail.com",
    pass: "nmai hmwn gjlr kbot",
  },
});

const sendVerificationEmail = async (toEmail, otp) => {
  const mailOptions = {
    from: '"Real Estate App" <your-email@gmail.com>',
    to: toEmail,
    subject: "Email Verification OTP",
    text: `Your OTP code is: ${otp}`,
    html: `<p>Your OTP code is: <b>${otp}</b></p>`,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendVerificationEmail;