require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const { isRedisReady } = require('./config/redis');
const { stats, clearCache } = require('./middleware/cache');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const prisma = new PrismaClient();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/products', require('./routes/products'));
require('./sockets/chat')(io);

app.get('/api/health', async (req, res) => {
  let db = 'down';
  try { await prisma.$queryRaw`SELECT 1`; db = 'up'; } catch (e) {}
  const total = stats.hits + stats.misses;
  res.json({
    server: 'up',
    database: db,
    redis: isRedisReady() ? 'up' : 'down',
    cache: { ...stats, hitRate: total ? Math.round((stats.hits / total) * 100) + '%' : '0%' },
    uptimeSec: Math.round(process.uptime())
  });
});

app.delete('/api/cache', async (req, res) => {
  res.json({ cleared: await clearCache() });
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`\n🚀 Growfinix SmartHub running at http://localhost:${PORT}\n`));
