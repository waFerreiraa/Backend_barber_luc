import nodemailer from 'nodemailer';

// -----------------------------------------------------------------------------
// IMPORTANTE: Configure esta parte com seu provedor de e-mail.
// -----------------------------------------------------------------------------
// Crie um arquivo .env na raiz do seu projeto backend e adicione as variáveis:
// EMAIL_USER=seu-email@gmail.com
// EMAIL_PASS=sua-senha-de-app-do-gmail
// FRONTEND_URL=http://localhost:5173
//
// Para usar o Gmail, você precisará gerar uma "Senha de App".
// Pesquise por "Gerar Senha de App Google" para mais detalhes.
// Para produção, é altamente recomendado usar um serviço como SendGrid ou Mailgun.
// -----------------------------------------------------------------------------

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendPasswordResetEmail = async (to, token, fromName = "Sua Barbearia") => {
  // URL mais limpa e padrão para roteamento no React.
  // Ex: http://localhost:5173/resetar-senha/a1b2c3d4...
  const resetUrl = `${process.env.FRONTEND_URL}/resetar-senha/${token}`;

  const mailOptions = {
    // O nome do remetente agora é dinâmico, enquanto o email é o configurado no .env
    from: `"${fromName}" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: 'Redefinição de Senha',
    html: `<p>Você solicitou uma redefinição de senha.</p><p>Clique neste <a href="${resetUrl}">link</a> para criar uma nova senha.</p><p>Este link expira em 1 hora.</p>`,
  };

  await transporter.sendMail(mailOptions);
};