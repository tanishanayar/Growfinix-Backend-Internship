const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { emailQueue } = require('../queues/emailQueue');
const { redis } = require('../config/redis');

const prisma = new PrismaClient();

// POST /api/auth/register  -> saves user, pushes welcome email to queue, replies instantly
router.post('/register', async (req, res) => {
  const started = Date.now();
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const user = await prisma.user.create({
      data: { name, email, password: await bcrypt.hash(password, 10) }
    });
    const job = await emailQueue.add('welcome-email', { name: user.name, email: user.email });

    res.status(201).json({
      message: 'Registered successfully. Welcome email is being sent in the background.',
      user: { id: user.id, name: user.name, email: user.email },
      jobId: job.id,
      responseTimeMs: Date.now() - started
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// GET /api/auth/email-log -> latest processed email jobs
router.get('/email-log', async (req, res) => {
  const items = await redis.lrange('email:log', 0, 9).catch(() => []);
  const counts = await emailQueue.getJobCounts('waiting', 'active', 'completed', 'failed').catch(() => ({}));
  res.json({ counts, items: items.map((i) => JSON.parse(i)) });
});

module.exports = router;
