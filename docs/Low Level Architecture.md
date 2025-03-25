# 🔍 Fuse Take Home - Low Level Architecture

This document describes the **low-level architecture** of the Fuse stock trading backend system, built with **NestJS, TypeScript**, and **Docker**.

---

## ⚙️ Module Breakdown

### 1. `StockModule`

**Purpose**: Interact with the Fuse Vendor API to retrieve available stocks.

- `StockController`
  - `GET /stocks`
  - Client-facing offset-based pagination with default limit of 25 items
  - Query params: `page`, `limit`
  - Translates to/from vendor's token-based pagination internally
- `StockService`
  - Fetches and caches data from Vendor API
  - Handles retries for unreliable upstream
  - Maintains pagination token mapping for offset translation
- `StockHttpService`
  - Axios instance with interceptor for API key
- `StockEntity` _(optional)_:
  - For local caching with Redis (TTL: 5 minutes)
- `PaginationService`:
  - Handles translation between offset-based and token-based pagination
  - Caches pagination tokens for consistent paging

---

### 2. `PortfolioModule`

**Purpose**: Manage and expose user portfolios (stocks and quantities).

- `PortfolioController`
  - `GET /portfolio/:userId`
- `PortfolioService`
  - Aggregates data from trades
  - Computes current portfolio
- `PortfolioEntity`
  - Stores per-user stock holdings
  - Mapped to PostgreSQL table via TypeORM
- `PortfolioRepository`
  - TypeORM repository pattern for DB access

---

### 3. `TradeModule`

**Purpose**: Execute and log stock purchase attempts.

- `TradeController`
  - `POST /stocks/:symbol/buy`
- `TradeService`
  - Fetches current price from `StockService`
  - Validates price bounds (±2%)
  - Calls Vendor `POST /buy`
  - Stores result
- `TradeEntity`
  - Stores all trade attempts (success/failure)
  - Mapped to PostgreSQL table via TypeORM
- `TradeRepository`
  - TypeORM repository pattern

---

### 4. `ReportModule`

**Purpose**: Generate and send daily transaction reports.

- `ReportService`
  - Gathers trades from `TradeRepository`
  - Formats report
  - Sends email via `EmailService`
- `ReportScheduler`
  - Uses `@nestjs/schedule` for cron job management
- `EmailService`
  - Default: Nodemailer with SMTP transport
  - Feature flag: Mailgun with HTML templates (`ENABLE_MAILGUN=true`)
- `ReportQueue`
  - BullMQ + Redis for job queue management
  - Concurrency set to 10 per worker
  - 3 retry attempts with exponential backoff

---

## 📦 Domain Entities

| Entity      | Fields                                                                    |
| ----------- | ------------------------------------------------------------------------- |
| `Stock`     | `symbol`, `name`, `price`, `lastFetchedAt` (optional)                     |
| `Portfolio` | `userId`, `symbol`, `quantity`                                            |
| `Trade`     | `userId`, `symbol`, `price`, `quantity`, `status`, `timestamp`, `reason?` |

---

## 💾 Database Model

The application uses **TypeORM** with **PostgreSQL** for data persistence. Below are the TypeORM entity definitions:

### `Stock` Entity

```typescript
@Entity("stocks")
export class Stock {
  @PrimaryColumn({ name: "symbol" })
  symbol: string;

  @Column({ name: "name" })
  name: string;

  @Column("decimal", { precision: 10, scale: 2, name: "price" })
  price: number;

  @Index()
  @Column({ nullable: true, name: "last_fetched_at" })
  lastFetchedAt: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
```

### `Portfolio` Entity

```typescript
@Entity("portfolios")
export class Portfolio {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id: string;

  @Index()
  @Column({ name: "user_id" })
  userId: string;

  @Column({ name: "symbol" })
  symbol: string;

  @Column("integer", { name: "quantity" })
  quantity: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Unique(["user_id", "symbol"])
  userStockConstraint: any;
}
```

### `Trade` Entity

```typescript
@Entity("trades")
export class Trade {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id: string;

  @Index()
  @Column({ name: "user_id" })
  userId: string;

  @Column({ name: "symbol" })
  symbol: string;

  @Column("decimal", { precision: 10, scale: 2, name: "price" })
  price: number;

  @Column("integer", { name: "quantity" })
  quantity: number;

  @Column({
    type: "enum",
    enum: TradeStatus,
    default: TradeStatus.PENDING,
    name: "status",
  })
  status: TradeStatus;

  @Index()
  @Column({ name: "timestamp" })
  timestamp: Date;

  @Column({ nullable: true, name: "reason" })
  reason: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Index(["user_id", "timestamp"])
  userTimestampIndex: any;
}

// Enum for Trade Status
export enum TradeStatus {
  PENDING = "pending",
  SUCCESS = "success",
  FAILED = "failed",
}
```

### Database Relationships

- `Portfolio` records are uniquely identified by `userId` and `symbol` combination
- `Trade` records track all transaction attempts, successful or failed
- `Stock` records can be used for local caching of stock information

---

## 📬 Email Report Structure

- **Subject**: "Fuse Daily Trade Report"
- **Body**:
  - Date of report
  - Total trades
  - Success count
  - Failed count with reasons
  - Optional: table of transactions

---

## 🛠 Utilities & Helpers

- **`HttpModule`**
  - For Fuse API interactions
- **`LoggingMiddleware`**
  - Logs incoming requests and responses
- **`GlobalExceptionFilter`**
  - Handles errors gracefully

---

## 🐞 Error Handling Strategy

- **Default Mechanism**: Custom logging
  - Structured JSON logs for all errors
  - Log levels: DEBUG, INFO, WARN, ERROR
  - Request IDs for tracing through the system
- **Feature-flagged Sentry Integration**:
  - Enable with `ENABLE_SENTRY=true`
  - Capture exceptions with context
  - Custom breadcrumbs for transaction flows
- **API Call Retry Policy**:

  - Exponential backoff strategy
  - Maximum of 3 retries for vendor API calls
  - Circuit breaker pattern for persistent failures

- **Implementation**:

  ```typescript
  // Custom Logger
  export class AppLogger implements LoggerService {
    error(message: string, trace: string, context?: string) {
      console.error(
        JSON.stringify({
          level: "ERROR",
          message,
          trace,
          context,
          timestamp: new Date().toISOString(),
        })
      );

      if (process.env.ENABLE_SENTRY === "true") {
        Sentry.captureException(new Error(message), {
          extra: { trace, context },
        });
      }
    }
    // ...other methods
  }
  ```

---

## 🧊 Caching Strategy

- **Technology**: Redis-based caching
- **Stock Price Data**:
  - TTL: 5 minutes for stock price data
  - Automatic invalidation on trades
- **Portfolio Data**:
  - TTL: 15 minutes
  - Explicit invalidation on successful trades
- **Implementation**:
  - CacheInterceptor for GET endpoints
  - Custom cache manager for programmatic use

---

## 🔐 Configuration

- Environment variables stored in `.env`:

```
# API Configuration
FUSE_API_KEY=your-api-key
FUSE_API_BASE_URL=https://api.challenge.fusefinance.com

# Database Configuration
DB_HOST=db
DB_PORT=5432
DB_USERNAME=user
DB_PASSWORD=pass
DB_DATABASE=fuse

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=your-smtp-password
EMAIL_FROM=reports@fusefinance.com
EMAIL_RECIPIENTS=admin@fusefinance.com

# Mailgun Configuration (Optional)
ENABLE_MAILGUN=false
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=mg.yourdomain.com

# Feature Flags
ENABLE_SENTRY=false
ENABLE_DATADOG=false

# Queue Configuration
QUEUE_CONCURRENCY=10
```

---

## 🔄 Process Flow (Buy Request)

1. User hits `POST /stocks/:symbol/buy`
2. App fetches current stock price
3. Validates ±2% price rule
4. If valid, posts to vendor `/buy`
5. Logs result into `TradeEntity`
6. Updates portfolio if successful

---

## 🔄 Process Flow (Daily Report)

1. `@Cron` triggers at midnight
2. Job is added to BullMQ queue
3. Worker processes with concurrency of 10
4. Fetches all trades from past 24h
5. Aggregates results
6. Formats into HTML email
7. Sends email via configured provider (SMTP by default, Mailgun if enabled)
8. If job fails:
   - Retry up to 3 times with exponential backoff (1min, 5min, 15min)
   - Log detailed error information
   - Failed jobs remain in queue for manual inspection

---

## 🔒 Authentication & Authorization

**Authentication Alternatives**:

1. **API Key Authentication**

   - Simple header-based authentication
   - Different keys for different clients
   - No user session management required

**Access Control Policy**:

- Users can only access their own portfolio data
- Implementation using Guards in NestJS:
  ```typescript
  @UseGuards(PortfolioOwnerGuard)
  @Get('/portfolio/:userId')
  getPortfolio(@Param('userId') userId: string) {
    // ...
  }
  ```

---

## 📊 Monitoring & Health Checks

**Health Check Endpoint**:

- `GET /health` endpoint provided by `@nestjs/terminus`
- Checks:
  - Database connectivity
  - Redis connectivity
  - Vendor API availability

**Monitoring Strategy**:

- Custom logging for all application events
- Datadog integration behind feature flag
- Key metrics to monitor:
  - API response times
  - Queue lengths
  - Error rates
  - Successful vs. failed trades

**Implementation**:

```typescript
@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private redis: RedisHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck("database"),
      () => this.redis.pingCheck("redis"),
      () =>
        this.http.pingCheck(
          "vendor-api",
          "https://api.challenge.fusefinance.com/health"
        ),
    ]);
  }
}
```

---

## 🧹 Code Quality Tools

**Linting & Formatting**:

- **ESLint** with TypeScript configuration

  - Enforces consistent code style
  - Catches common errors and antipatterns
  - Custom rules for NestJS best practices

- **Prettier**
  - Automatic code formatting
  - Consistent style across the codebase
  - Integrated with Git hooks via husky

**Configuration Files**:

```typescript
// .eslintrc.js
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
};

// .prettierrc
{
  "singleQuote": true,
  "trailingComma": "all",
  "tabWidth": 2,
  "semi": true,
  "printWidth": 100
}
```

**Git Hooks**:

- Pre-commit: Lint and format code
- Pre-push: Run unit tests

---

## 📁 Project Folder Structure

```
src/
├── app.module.ts
├── main.ts
├── stocks/
│   ├── stocks.module.ts
│   ├── stocks.controller.ts
│   ├── stocks.service.ts
│   └── dto/
├── trades/
│   ├── trades.module.ts
│   ├── trades.controller.ts
│   ├── trades.service.ts
│   └── dto/
├── portfolio/
│   ├── portfolio.module.ts
│   ├── portfolio.controller.ts
│   ├── portfolio.service.ts
├── reports/
│   ├── reports.module.ts
│   ├── reports.service.ts
│   └── scheduler.service.ts
├── email/
│   └── email.service.ts
├── common/
│   ├── interceptors/
│   ├── filters/
│   └── utils/
```

---

## 📝 API Documentation

The API is documented using **Swagger/OpenAPI** specification:

- **Endpoint**: `/api/docs` serves the Swagger UI
- **Implementation**: `@nestjs/swagger` decorators on controllers and DTOs
- **Features**:
  - Detailed endpoint descriptions
  - Request/response schemas
  - Authentication requirements
  - Example requests
  - Response codes and descriptions

**Example Implementation**:

```typescript
@ApiTags("stocks")
@Controller("stocks")
export class StockController {
  @ApiOperation({ summary: "Get all stocks" })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (starts at 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 25)",
  })
  @ApiResponse({
    status: 200,
    description: "List of stocks",
    type: StockListResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid pagination parameters" })
  @ApiResponse({ status: 500, description: "Internal server error" })
  @Get()
  async getStocks(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(25), ParseIntPipe) limit: number
  ): Promise<StockListResponseDto> {
    // Implementation
  }
}
```

---

## 🚨 Error Codes

The API uses standardized error codes and responses for consistent error handling:

| Error Code | HTTP Status | Description                    | Example Scenario                        |
| ---------- | ----------- | ------------------------------ | --------------------------------------- |
| `AUTH_001` | 401         | Missing API key                | API call without authentication header  |
| `AUTH_002` | 403         | Invalid API key                | API call with incorrect API key         |
| `AUTH_003` | 403         | Access denied                  | Accessing another user's portfolio      |
| `VAL_001`  | 400         | Invalid input parameters       | Negative quantity or invalid pagination |
| `VAL_002`  | 400         | Price out of acceptable range  | Buy price outside ±2% of current price  |
| `VAL_003`  | 400         | Invalid stock symbol           | Non-existent stock symbol               |
| `API_001`  | 502         | Vendor API communication error | Timeout or connection error             |
| `API_002`  | 503         | Vendor API service unavailable | Vendor rate limit exceeded              |
| `DB_001`   | 500         | Database error                 | Failed query or connection issue        |
| `SYS_001`  | 500         | Unexpected system error        | Unhandled exceptions                    |

**Implementation**:

```typescript
// Error response structure
export interface ErrorResponse {
  statusCode: number;
  errorCode: string;
  message: string;
  timestamp: string;
  path: string;
  details?: Record<string, any>;
}

// Example exception filter
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    const errorResponse: ErrorResponse = {
      statusCode: status,
      errorCode: exceptionResponse.errorCode || `SYS_${status}`,
      message: exceptionResponse.message || "Internal server error",
      timestamp: new Date().toISOString(),
      path: request.url,
      details: exceptionResponse.details,
    };

    response.status(status).json(errorResponse);
  }
}
```

---

## ✅ Input Validation

The API implements comprehensive validation for all input data:

### Stock Symbol Validation

- Must be a non-empty string
- Maximum length: 10 characters
- Must match pattern: `^[A-Z0-9]+$`

### Price Validation

- Must be a positive number
- Must have a maximum of 2 decimal places
- Must be within ±2% of current stock price for buy operations

### Quantity Validation

- Must be a positive integer
- Must be at least 1
- Maximum value: 10,000 per transaction

### Pagination Parameters

- `page`: Positive integer, minimum 1
- `limit`: Positive integer, minimum 1, maximum 100

**Implementation using `class-validator`**:

````typescript
export class BuyStockDto {
  @ApiProperty({ example: 220.67, description: 'The price to buy the stock at' })
  @IsNumber()
  @IsPositive()
  @Max(1000000)
  @Transform(({ value }) => parseFloat(parseFloat(value).toFixed(2)))
  price: number;

  @ApiProperty({ example: 5, description: 'The quantity to buy' })
  @IsInt()
  @IsPositive()
  @Max(10000)
  quantity: number;
}

// Usage in controller
@Post(':symbol/buy')
async buyStock(
  @Param('symbol', new ParseStockSymbolPipe()) symbol: string,
  @Body() buyStockDto: BuyStockDto,
  @Headers('authorization') apiKey: string,
): Promise<BuyResponseDto> {
  // Implementation
}

// Custom symbol validation pipe
export class ParseStockSymbolPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    const isValid = /^[A-Z0-9]{1,10}$/.test(value);
    if (!isValid) {
      throw new BadRequestException({
        errorCode: 'VAL_003',
        message: 'Invalid stock symbol format',
      });
    }
    return value;
  }
}

---

## 🔄 CI Pipeline

The project utilizes **GitHub Actions** for continuous integration:

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: 18
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Lint
      run: npm run lint

    - name: Check formatting
      run: npm run format:check

    - name: Build
      run: npm run build

    - name: Test
      run: npm run test

    - name: E2E Tests
      run: npm run test:e2e
````

**Features**:

- Triggered on push to main and all pull requests
- Runs linting, formatting checks, build verification, unit tests, and E2E tests
- Provides fast feedback on code quality and correctness
- Ensures all PRs meet quality standards before merge

---

## 🛠 Development Configuration

The project is configured for an optimal local development experience:

### Docker Compose for Development

```yaml
# docker-compose.dev.yml
version: "3.8"
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    env_file:
      - .env.development
    command: npm run start:dev
    depends_on:
      - db
      - redis
    environment:
      - NODE_ENV=development

  db:
    image: postgres:15
    restart: always
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: fuse_dev
    ports:
      - "5432:5432"
    volumes:
      - db_dev_data:/var/lib/postgresql/data

  redis:
    image: redis:alpine
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_dev_data:/data

volumes:
  db_dev_data:
  redis_dev_data:
```

### Development-specific Dockerfile

```dockerfile
# Dockerfile.dev
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
```

### Watch Mode Configuration

The application is set up with NestJS's watch mode for auto-reloading during development:

```json
// package.json (script section)
{
  "scripts": {
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch"
  }
}
```

### Environment Configuration

```
# .env.development
NODE_ENV=development

# API Configuration
FUSE_API_KEY=your-api-key
FUSE_API_BASE_URL=https://api.challenge.fusefinance.com

# Database Configuration
DB_HOST=db
DB_PORT=5432
DB_USERNAME=user
DB_PASSWORD=pass
DB_DATABASE=fuse_dev

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# Email Configuration (Development)
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=dev@fusefinance.com
EMAIL_RECIPIENTS=dev@fusefinance.com

# Feature Flags
ENABLE_MAILGUN=false
ENABLE_SENTRY=false
ENABLE_DATADOG=false

# Queue Configuration
QUEUE_CONCURRENCY=2
```

### Development Tools

- **MailHog** for local email testing (captures all outgoing emails)
- **Hot Module Replacement** for faster development cycles
- **Debugging** configuration for VS Code integration
