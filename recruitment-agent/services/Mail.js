const nodemailer = require('nodemailer');

const senderEmail = process.env.GMAIL_USER || 'sathvikram18@gmail.com';
const appPassword = process.env.GMAIL_APP_PASSWORD;

const createMailer = () => {
  if (!appPassword) return null;

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: senderEmail,
      pass: appPassword,
    },
  });
};

const isConfigured = () => Boolean(appPassword);

async function sendInterviewNotice({ to, candidateName, roleTitle }) {
  const mailer = createMailer();

  if (!mailer) {
    return {
      sent: false,
      reason: 'Email not sent: GMAIL_APP_PASSWORD is not configured on the server.',
    };
  }

  const firstName = candidateName?.trim()?.split(/\s+/)[0] || 'there';

  const mail = {
    from: senderEmail,
    to,
    subject: `Your Application for ${roleTitle} — Next Steps`,
    text: [
      `Dear ${firstName},`,
      '',
      `Thank you for taking the time to apply for the ${roleTitle} position with us.`,
      `After a thorough review of your application and resume, we are pleased to let you know that your profile has stood out among the candidates we evaluated.`,
      '',
      `We would like to move forward with the next stage of our hiring process.`,
      `An interview will be scheduled shortly, and a member of our recruiting team will reach out to you directly with available time slots and further details.`,
      '',
      `In the meantime, please don't hesitate to reach out if you have any questions.`,
      `We look forward to staying in touch and to the opportunity of speaking with you soon.`,
      '',
      'Warm regards,',
      'The Recruiting Team',
    ].join('\n'),
  };

  try {
    await mailer.sendMail(mail);

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: `Email failed to send: ${error.message}`,
    };
  }
}

module.exports = {
  sendInterviewNotice,
  isConfigured,
  senderEmail,
};