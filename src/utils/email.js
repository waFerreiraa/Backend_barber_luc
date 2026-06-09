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
  // Configurações de Timeout (10 segundos)
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
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

  try {
    console.log(`[Email] Tentando enviar e-mail de reset de senha para: ${to}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Sucesso! E-mail enviado: ${info.messageId}`);
  } catch (error) {
    console.error(`[Email] Falha ao enviar e-mail para ${to}:`, error.message);
    // Repassa o erro para que o authController possa lidar com ele (embora atualmente ele capture e retorne 500 generico).
    throw new Error(`Falha ao enviar e-mail: ${error.message}`);
  }
};