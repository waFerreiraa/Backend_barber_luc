import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendPasswordResetEmail = async (to, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/resetar-senha/${token}`;

  const mailOptions = {
    from: `"Barbearia Lucão" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: 'Redefinição de Senha',
    html: `<p>Você solicitou uma redefinição de senha.</p><p>Clique neste <a href="${resetUrl}">link</a> para criar uma nova senha.</p><p>Este link expira em 1 hora.</p>`,
  };

  await transporter.sendMail(mailOptions);
};