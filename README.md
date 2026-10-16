# 🚀 Growfinix SmartHub Backend

> **Growfinix Backend Development Internship · Month 2: Advanced Data Flow & Architecture**
> One Node.js backend that combines **all five Month-2 tasks**: real-time chat, Redis caching, background email queue, AI text analysis and advanced product search, with a live dashboard.

**Author:** Tanisha Nayar · **Internship:** Growfinix Technology (08 July 2026 to 08 September 2026)

---

## ✨ What this project does

| # | Task | What it does | Main tech | Where in code |
|---|------|--------------|-----------|---------------|
| 1 | Real-Time Chat Server | Users join rooms and messages are broadcast instantly | Node.js, Socket.io | `src/sockets/chat.js` |
| 2 | Performance Optimization with Caching | Repeated searches are answered from Redis in milliseconds (HIT / MISS badge) | Redis, ioredis | `src/middleware/cache.js` |
| 3 | Background Jobs & Queues (Email Sender) | Registration replies instantly; a worker sends the welcome email | BullMQ, Nodemailer | `src/queues/`, `src/workers/`, `src/routes/auth.js` |
| 4 | AI API Integration | Sentiment and summary of any text; API key stays on the server | OpenAI / HuggingFace API | `src/services/ai.js`, `src/routes/ai.js` |
| 5 | Advanced Database Queries | Product search with pagination, sorting and filters | PostgreSQL, Prisma ORM | `prisma/schema.prisma`, `src/routes/products.js` |

## 🎥 Demo videos (LinkedIn)

| Task | LinkedIn video |
|------|----------------|
| Task 1: Real-Time Chat | [Add link](#) |
| Task 2: Redis Caching | [Add link](#) |
| Task 3: Email Queue | [Add link](#) |
| Task 4: AI Integration | [Add link](#) |
| Task 5: Product Search | [Add link](#) |

## 📸 Screenshots

| Overview | Real-Time Chat |
|---|---|
| ![Overview](screenshots/01-overview.png) | ![Chat](screenshots/02-chat.png) |

| Redis Cache (MISS then HIT) | Email Queue |
|---|---|
| ![Cache](screenshots/03-cache-hit-miss.png) | ![Queue](screenshots/04-email-queue.png) |

| AI Analyzer | Product Search with Filters |
|---|---|
| ![AI](screenshots/05-ai-analyzer.png) | ![Products](screenshots/06-product-filters.png) |

## 🧱 Architecture

```
Browser Dashboard ──HTTP──► Express API ──► PostgreSQL (Prisma ORM, Neon)
        │                      │  ├─► Redis cache middleware (HIT / MISS)
        └──WebSocket──► Socket.io │  └─► AI service (OpenAI / HuggingFace / built-in)
                               └─► BullMQ queue ──► Email worker ──► Nodemailer
```

## 🛠️ Tech stack

Node.js · Express.js · Socket.io · Redis (ioredis) · BullMQ · Nodemailer · PostgreSQL · Prisma ORM · OpenAI / HuggingFace API · bcrypt · Helmet · CORS · express-rate-limit · dotenv · HTML, CSS, JavaScript

## ⚙️ Setup

**Requirements:** Node.js 18+, a PostgreSQL database (Docker or free Neon cloud), and Redis (Docker, or Memurai on Windows).

```bash
# 1. Install dependencies
npm install

# 2. Create your settings file and edit it
copy .env.example .env        # Windows   (Mac/Linux: cp .env.example .env)

# 3. Start PostgreSQL + Redis (needs Docker). Skip if you use Neon + Memurai.
docker compose up -d

# 4. Create tables and add 72 sample products
npm run setup

# 5. Start the API and the email worker together
npm run dev
```

Open **http://localhost:3000**

### Environment variables (`.env`)

| Variable | Meaning |
|----------|---------|
| `PORT` | Server port (default 3000) |
| `DATABASE_URL` | PostgreSQL link (use the direct Neon link, without `-pooler`) |
| `REDIS_HOST`, `REDIS_PORT` | Redis address |
| `SMTP_*` | Real email settings. Leave empty to use the free Ethereal test inbox |
| `OPENAI_API_KEY` or `HF_TOKEN` | Optional. Without them a built-in analyzer is used |

> 🔒 Never commit your real `.env` file. `.env.example` contains dummy values only.

## 📡 API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server, database and Redis status, cache hit rate |
| GET | `/api/products` | Search with `page, limit, sort, order, category, minPrice, maxPrice, search` |
| GET | `/api/products/categories` | Categories with product counts |
| POST | `/api/products` | Add a product and clear the cache |
| POST | `/api/auth/register` | Register a user and queue the welcome email |
| GET | `/api/auth/email-log` | Queue counts and recently sent emails |
| POST | `/api/ai/analyze` | Sentiment and summary of a text |
| DELETE | `/api/cache` | Clear the Redis cache |

Chat events: `join_room`, `send_message`, `typing`, `history`, `message`, `system`, `room_users`.

## 🔐 Security

Passwords hashed with bcrypt · secrets only in `.env` · Helmet secure headers · CORS · rate limit on the AI endpoint · input validation · allow-listed sort fields · escaped output in the dashboard.

## 🗂️ Project structure

```
src/        server.js, config/, middleware/, queues/, workers/, routes/, services/, sockets/
prisma/     schema.prisma, seed.js
public/     index.html, style.css, app.js (dashboard)
docs/       Project overview document
screenshots/
```

## 🔭 Future scope

JWT login and roles · saved chat history · Swagger API docs · automated tests · Docker and cloud deployment (Render / Railway) · more AI features · admin dashboard · payments

## 📄 License

MIT. Built as part of the Growfinix Backend Development Internship.
