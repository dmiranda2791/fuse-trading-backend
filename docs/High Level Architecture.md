# 🧱 Fuse Take Home - High Level Architecture

This document outlines the architecture for the Fuse Stock Trading Backend, built using **Node.js**, **TypeScript**, **NestJS**, and **Docker**.

---

## 📦 System Components

```
                          +---------------------+
                          |     Vendor API      |
                          | (Fuse Challenge API)|
                          +----------+----------+
                                     |
                          [External Integration]
                                     |
                                     v
+----------------------+    +---------------------+    +------------------------+
|    Client (REST)     |<-->|  API Gateway / App  |<-->|   Scheduler / Workers  |
|  (e.g. Postman)      |    |   (NestJS REST API) |    |  (NestJS Queued Jobs)  |
+----------------------+    +---------------------+    +------------------------+
                                    |      |
                                    |      |
                                    v      v
                          +--------------------------+
                          |     Service Layer         |
                          | (Portfolio, Trading, etc) |
                          +--------------------------+
                                    |
                                    v
                          +--------------------------+
                          |     Persistence Layer     |
                          |      (PostgreSQL)         |
                          +--------------------------+
                                    |
                                    v
                         +-----------------------------+
                         | Transaction & Report Logging|
                         +-----------------------------+
```

---

## 🔧 Tech Stack Overview

| Layer/Component   | Tech/Pattern                                                 |
| ----------------- | ------------------------------------------------------------ |
| App Framework     | NestJS with TypeScript                                       |
| Containerization  | Docker, Docker Compose                                       |
| Scheduler         | `@nestjs/schedule`                                           |
| Queue             | BullMQ + Redis (10 concurrent workers)                       |
| Email             | Nodemailer SMTP (Default) / Mailgun (Optional)               |
| DB                | PostgreSQL                                                   |
| Cache             | Redis                                                        |
| Config Management | `@nestjs/config`                                             |
| HTTP Client       | `axios` / `nestjs/axios`                                     |
| ORM               | TypeORM                                                      |
| Validation        | `class-validator`, `class-transformer`                       |
| Pagination        | Offset-based (client) / Token-based (vendor API) translation |
| Authentication    | API Key                                                      |
| Logging           | Custom JSON logging                                          |
| Monitoring        | Datadog (behind feature flag)                                |
| Error Tracking    | Sentry (behind feature flag)                                 |
| Health Checks     | `@nestjs/terminus`                                           |
| API Documentation | Swagger / OpenAPI                                            |
| Linting           | ESLint with TypeScript rules                                 |
| Formatting        | Prettier                                                     |
| Git Hooks         | Husky                                                        |
| CI/CD             | GitHub Actions                                               |

---

## 🧠 Core Modules

### 1. StockModule

- Handles `/stocks` endpoint
- Talks to vendor API
- Implements pagination & caching

### 2. PortfolioModule

- Stores user holdings in DB
- Read-only API to retrieve portfolios

### 3. TradeModule

- Handles `/buy` operations
- Validates price bounds (±2%)
- Logs results of all transactions

### 4. ReportModule

- Runs daily cron
- Aggregates transaction logs
- Sends email reports

---

## 🔄 Job Flow

1. **Daily Report Job**

   - Run with `@nestjs/schedule`
   - Summarizes success/failure from DB
   - Sends report via email

2. **Purchase Flow**
   - Gets stock price
   - Validates price difference
   - Calls vendor `/buy`
   - Stores result

---

## 🐳 Docker Compose Setup

```yaml
version: "3.8"
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - db
      - redis
  db:
    image: postgres:15
    restart: always
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: fuse
    volumes:
      - db_data:/var/lib/postgresql/data
  redis:
    image: redis:alpine
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
volumes:
  db_data:
  redis_data:
```

---

## 🧑‍💻 Development Setup

The project is configured for a streamlined development experience:

```yaml
# docker-compose.dev.yml (simplified)
version: "3.8"
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run start:dev
    # Other config omitted for brevity

  # Database and Redis services

  mailhog:
    image: mailhog/mailhog
    ports:
      - "8025:8025" # Web UI
      - "1025:1025" # SMTP
```

**Features**:

- **Hot-reloading**: Automatically restarts on code changes
- **Volume mounting**: Edit code directly from your IDE
- **MailHog**: Captures emails for testing without actual sending
- **Development env**: Separate configuration for development
- **Debugging**: Pre-configured for VS Code integration

**Getting Started**:

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Run tests in watch mode
npm run test:watch

# Access API documentation
# http://localhost:3000/api/docs
```

---

## 🔐 Resilience & Security

- API retries with exponential backoff (max 3 attempts)
- Circuit breaker pattern for persistent failures
- Comprehensive health checks for all dependencies
- JSON structured logging for all operations
- Feature-flagged error tracking with Sentry
- API key authentication for all endpoints
- User-level access control (users can only access their own data)
- Request-level timeouts and validation
- Uses `.env` for secrets and configuration

---

## 🚨 Error Handling

The application implements a standardized error handling approach:

| Category        | Strategy                                                    |
| --------------- | ----------------------------------------------------------- |
| API Errors      | Standardized error codes with consistent response structure |
| Validation      | Pre-request validation with custom error messages           |
| Business Rules  | Domain-specific exceptions with semantic error codes        |
| External APIs   | Retries, timeouts, and fallback strategies                  |
| Database        | Connection pooling, transaction management, retry policies  |
| Async Processes | Dead letter queues for failed jobs with recovery mechanisms |

**Error Response Format**:

```json
{
  "statusCode": 400,
  "errorCode": "VAL_002",
  "message": "Price must be within ±2% of current stock price",
  "timestamp": "2023-06-01T12:34:56.789Z",
  "path": "/stocks/AAPL/buy",
  "details": {
    "providedPrice": 150.25,
    "currentPrice": 155.75,
    "allowedRange": [152.64, 158.87]
  }
}
```

---

## 🧹 Code Quality

- **ESLint** for static code analysis and enforcing consistent patterns
- **Prettier** for automatic code formatting with consistent style
- **Husky** for Git hooks to ensure linting and testing before commits
- TypeScript compile-time checking with strict mode
- Unit and integration testing with Jest
- CI/CD pipeline for automated quality checks

---

## 📁 Folder Structure (Proposed)

```
src/
  ├── app.module.ts
  ├── stocks/
  ├── portfolio/
  ├── trades/
  ├── reports/
  ├── common/
  ├── config/
  └── main.ts
```

---

## 📬 Email Report

- Text or HTML format
- Includes:
  - Number of transactions
  - Success vs failure
  - Fail reasons (e.g., price out of bounds)
