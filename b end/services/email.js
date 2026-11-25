// services/email.js
import nodemailer from 'nodemailer';

const gmailUser = process.env.RESET_EMAIL;
const gmailAppPassword = process.env.RESET_EMAIL_APP_PASSWORD;

let transporter = null;

if (gmailUser && gmailAppPassword) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });
} else {
  console.warn('⚠️  Password reset email transport is not configured. Missing RESET_EMAIL or RESET_EMAIL_APP_PASSWORD.');
}

function ensureTransport() {
  if (!transporter) {
    const error = new Error('Password reset email transport is not configured');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }
  return transporter;
}

export async function sendPasswordResetCodeEmail(to, code) {
  const mailer = ensureTransport();

  const subject = 'รหัสยืนยันสำหรับรีเซ็ตรหัสผ่าน (Password reset verification code)';
  const plainText = [
    'สวัสดีค่ะ/ครับ',
    '',
    `นี่คือรหัสสำหรับยืนยันตัวตน: ${code}`,
    'รหัสนี้จะหมดอายุใน 10 นาที',
    '',
    'หากคุณไม่ได้ร้องขอ สามารถเพิกเฉยต่ออีเมลฉบับนี้ได้',
  ].join('\n');

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, sans-serif; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">ยืนยันตัวตนเพื่อรีเซ็ตรหัสผ่าน</h2>
      <p style="margin-top: 0;">นี่คือรหัสสำหรับยืนยันตัวตนของคุณ:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #ff7e29;">${code}</p>
      <p style="margin-top: 16px;">รหัสนี้จะหมดอายุภายใน <strong>10 นาที</strong></p>
      <p style="margin-top: 16px;">หากคุณไม่ได้ร้องขอการเปลี่ยนรหัสผ่าน สามารถเพิกเฉยต่ออีเมลฉบับนี้ได้</p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="font-size: 12px; color: #6b7280;">อีเมลถูกส่งจากระบบ ProjectBoard</p>
    </div>
  `;

  await mailer.sendMail({
    from: `ProjectBoard Support <${gmailUser}>`,
    to,
    subject,
    text: plainText,
    html,
  });
}
