require('dotenv').config();
const { Worker } = require('bullmq');
const nodemailer = require('nodemailer');
const { connection, redis } = require('../config/redis');

let transporterPromise;
async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      if (process.env.SMTP_HOST) {
        return nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
      }
      // Free fake inbox for demos - no signup needed
      const acc = await nodemailer.createTestAccount();
      console.log('[mail] using Ethereal test account:', acc.user);
      return nodemailer.createTransport({
        host: acc.smtp.host, port: acc.smtp.port, secure: acc.smtp.secure,
        auth: { user: acc.user, pass: acc.pass }
      });
    })();
  }
  return transporterPromise;
}

const worker = new Worker('emails', async (job) => {
  const { name, email } = job.data;
  const transporter = await getTransporter();
  await new Promise((r) => setTimeout(r, 2000)); // simulate slow email provider
  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || 'Growfinix SmartHub <no-reply@growfinix.in>',
    to: email,
    subject: `Welcome to Growfinix SmartHub, ${name}!`,
    html: `<div style="font-family:Arial;max-width:520px;margin:auto">
      <h2 style="color:#4f46e5">Welcome aboard, ${name} 🎉</h2>
      <p>Your account has been created successfully.</p>
      <p>This email was sent by a <b>background worker</b> using BullMQ + Redis, so your registration was never blocked.</p>
      <p style="color:#6b7280">— Team Growfinix SmartHub</p></div>`
  });
  const preview = nodemailer.getTestMessageUrl(info) || null;
  await redis.lpush('email:log', JSON.stringify({
    jobId: job.id, to: email, status: 'sent', preview, at: new Date().toISOString()
  }));
  await redis.ltrim('email:log', 0, 19);
  console.log(`[worker] job ${job.id} sent to ${email}`, preview || '');
  return { preview };
}, { connection, concurrency: 5 });

worker.on('failed', async (job, err) => {
  console.error(`[worker] job ${job?.id} failed: ${err.message}`);
  if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
    await redis.lpush('email:log', JSON.stringify({
      jobId: job.id, to: job.data.email, status: 'failed', error: err.message, at: new Date().toISOString()
    }));
  }
});
console.log('[worker] email worker started, waiting for jobs...');
