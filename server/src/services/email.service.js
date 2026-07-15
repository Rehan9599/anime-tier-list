import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const tierSection = (label, items) => `
  <h3 style="margin:16px 0 8px;">${label} tier</h3>
  ${
    items.length
      ? `<ul style="padding-left:20px;">${items.map((i) => `<li>${i.title}</li>`).join('')}</ul>`
      : '<p style="color:#888;">No anime in this tier yet.</p>'
  }
`;

export const sendTierListEmail = async (toEmails, username, tiers) => {
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;">
      <h2>${username}'s anime tier list</h2>
      ${tierSection('S', tiers.S)}
      ${tierSection('A', tiers.A)}
      ${tierSection('B', tiers.B)}
      ${tierSection('C', tiers.C)}
    </div>
  `;

  await transporter.sendMail({
    from: `"Anime Tier List" <${process.env.EMAIL_USER}>`,
    to: Array.isArray(toEmails) ? toEmails.join(', ') : toEmails,
    subject: `${username}'s anime tier list`,
    html,
  });
};
