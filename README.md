# DatabaseFarm 🛡️
> **Enterprise Database Monitoring Platform**  
> *Powered by Google AI* | **Author:** Nguyen Xuan Luu

---

## 📋 Project Overview

**DatabaseFarm** is an enterprise-grade database monitoring platform designed to monitor heterogeneous database fleets—including **Oracle**, **PostgreSQL**, **MySQL**, and **Microsoft SQL Server**. It provides real-time health checks, custom metric SQL executions, active threshold alerts, time-series history logging, and instant notification dispatch via Telegram and Email.

### Key Capabilities

- **Multi-Database Support**: Monitor Oracle, PostgreSQL, MySQL, and MSSQL databases from a unified dashboard.
- **Dual Storage Engine Support**:
  - **Prisma Repository**: Connects to a persistent MySQL database via Prisma ORM v7 for production environments.
  - **Memory Repository**: High-performance in-memory fallback for lightweight container deployments and testing.
- **Role-Based Access Control (RBAC)**:
  - **ADMIN**: Full read/write management permissions for databases, metrics, templates, groups, and settings.
  - **VIEWER**: Read-only access to dashboards, active alerts, metrics history, and telemetry logs.
- **30-Minute Inactivity Session Timeout**: Built-in interactive session management that automatically tracks user activity and logs out idle users after 30 minutes.
- **Collector API Health Check**: Dedicated module in System Settings allowing administrators to configure target Collector endpoints and perform automated HTTP 200 OK health validation checks.
- **Notification Engine**: Integrated alert dispatch via Telegram Bot API and SMTP Email channels.

---

## ⚙️ Environment Setup

1. **Clone the repository and prepare the environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Configure Environment Variables in `.env`**:

| Variable | Description | Default / Example Value |
| :--- | :--- | :--- |
| `NODE_ENV` | Application runtime mode (`development` or `production`) | `development` |
| `PORT` | HTTP server listening port | `3000` |
| `STORAGE_TYPE` | Storage repository selection (`prisma` or `memory`) | `prisma` |
| `DATABASE_URL` | MySQL connection string for Prisma ORM | `mysql://user:pass@127.0.0.1:3306/db_monitoring_system` |
| `SESSION_TIMEOUT_MINUTES` | User inactivity session timeout limit | `30` |
| `NEXTAUTH_URL` | Application base URL | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Secret key for JWT session encryption | `your-super-secret-jwt-key` |
| `SEED_ADMIN_USERNAME` | Default admin account username | `admin` |
| `SEED_ADMIN_PASSWORD` | Default admin account password | `secure_admin_password_123!` |
| `SEED_VIEWER_USERNAME` | Default viewer account username | `viewer` |
| `SEED_VIEWER_PASSWORD` | Default viewer account password | `secure_viewer_password_123!` |
| `COLLECTOR_HEALTH_CHECK_URL` | Target endpoint URL for Collector API health checks | `http://localhost:3000/api/collector/mock-health` |
| `TELEGRAM_API_URL` | Base URL for Telegram Bot API | `https://api.telegram.org` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for alerting | `123456789:ABCdefGHIjkl...` |
| `TELEGRAM_CHAT_ID` | Telegram chat ID for alert notifications | `-1001234567890` |
| `DEFAULT_TIMEZONE` | Timezone for display and telemetry formatting | `Asia/Ho_Chi_Minh` |

---

## 🗄️ Prisma Setup & Database Migration

When using `STORAGE_TYPE=prisma`, follow these steps to initialize and sync your MySQL storage schema:

1. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

2. **Run Schema Migrations**:
   ```bash
   npx prisma migrate dev --name init
   ```
   *Alternative for existing databases or container deployment*:
   ```bash
   npx prisma db push
   ```

3. **Seed Initial Database Records**:
   ```bash
   npx prisma db seed
   ```
   *This populates default admin (`admin`) and viewer (`viewer`) users, system settings, sample database instances (Oracle, Postgres, MySQL, SQL Server), metric templates, and active alert records.*

---

## 🚀 Build & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
The server starts at `http://localhost:3000` running Express with Vite middleware and TypeScript support (`tsx`).

### 3. Run Code Linting & Verification
```bash
npm run lint
```

---

## 📦 Production Compilation & Deployment

### 1. Compile and Bundle for Production
```bash
npm run build
```
This executes:
1. `vite build`: Bundles the React frontend into the static `dist/` directory.
2. `esbuild server.ts`: Bundles the Express TypeScript server into a self-contained CommonJS file at `dist/server.cjs`.

### 2. Start Production Server
```bash
npm start
```
Runs `node dist/server.cjs` listening on `0.0.0.0:3000`.

### 3. Deployment Notes
- **Cloud Run / Docker**: The build artifacts in `dist/` can be containerized. Ensure port `3000` is exposed.
- **Environment Variables**: Inject `.env` values (especially `DATABASE_URL` and `STORAGE_TYPE`) into your cloud secret manager or container environment.

---

## 👤 Author & Acknowledgments

- **Application Name**: DatabaseFarm
- **Branding**: Powered by Google AI
- **Author**: **Nguyen Xuan Luu** ([LinkedIn Profile](https://www.linkedin.com/in/nguyenxuanluu/))
- **License**: MIT
