const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Manejar el preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { to, subject, body, smtpConfig, isHtml } = req.body;

    if (!to || !subject || !body || !smtpConfig) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos.' });
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port || 587,
      secure: smtpConfig.port === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });

    const mailOptions = {
      from: `"Las Palmas POS" <${smtpConfig.user}>`,
      to: to,
      subject: subject,
      [isHtml ? 'html' : 'text']: body,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);

    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Error sending email via Vercel:', error);
    return res.status(500).json({ error: error.message || 'Error sending email' });
  }
};
