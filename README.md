# Fuse Trading Backend

This is a backend service for stock trading operations built with NestJS, TypeScript, PostgreSQL, and Redis.

## Features

- List available stocks from vendor API with caching and pagination
- Get user portfolios with aggregated holding data
- Execute stock purchase transactions with price validation (±2%)
- Generate and send daily reports by email with transaction statistics
- Implements resilient external API communication
- Uses token-based to offset-based pagination translation
- Comprehensive error handling with standardized error codes
- Docker-based development and deployment environment

## Requirements

- Node.js v20 or higher
- Docker and Docker Compose
- (Optional) SMTP server or Mailgun account for email sending

## Getting Started

### Running with Docker (Recommended)

1. Clone the repository:

```bash
git clone https://github.com/yourusername/fuse-trading-backend.git
cd fuse-trading-backend
```

2. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

3. Update the environment variables in the `.env` file as needed.

4. Start the development environment using one of the following options:

#### Using Docker Compose directly:

```bash
docker compose -f docker-compose.dev.yml up
```

#### Using NPM scripts (recommended):

```bash
# Start development environment
npm run docker:dev

# Start development environment and rebuild containers
npm run docker:dev:build

# Stop development environment
npm run docker:dev:down

# Start production environment
npm run docker:prod

# Start production environment and rebuild containers
npm run docker:prod:build

# Stop production environment
npm run docker:prod:down
```

### Platform Compatibility Note

This project includes services that may require architecture emulation:

- **ARM hosts (Apple Silicon M1/M2/M3)**: Docker Desktop on Mac should automatically handle emulation for any x86_64/amd64 images. You may see warnings about platform mismatches, but services should work properly.

- **x86/AMD64 hosts**: If running on non-ARM platforms and encountering issues with ARM images, you might need to enable emulation:

  ```bash
  # For Linux hosts
  docker run --privileged --rm tonistiigi/binfmt --install all

  # Then run docker-compose with:
  DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose -f docker-compose.dev.yml up
  ```

> **Note:** The application will wait for the database and Redis to be healthy before starting. Health checks are configured to ensure all services are properly initialized.
>
> **Database Initialization:** The PostgreSQL database is automatically initialized with the required schema when the container starts for the first time. The initialization script is located in `docker/init-scripts/init-db.sh`.

The API will be available at http://localhost:3000/api

Swagger documentation at http://localhost:3000/api/docs

Email testing UI at http://localhost:8025 (MailHog)

### Running Locally (Without Docker)

1. Install dependencies:

```bash
npm install
```

2. Create and configure a `.env` file as described above.

3. Make sure PostgreSQL and Redis are running and accessible with the credentials specified in your `.env` file.

4. Start the development server:

```bash
npm run start:dev
```

## Documentation

### API Documentation

Interactive API documentation is available via Swagger UI at http://localhost:3000/api/docs when the application is running.

### Project Documentation

The following documentation is available in the `docs` directory:

- [Architecture Report](REPORT.md) - Detailed explanation of system architecture and design decisions
- [Implementation Roadmap](docs/Implementation%20Roadmap.md) - Step-by-step implementation plan

### High-Level Architecture

For a high-level overview of the system architecture, please see the [High Level Architecture](docs/High%20Level%20Architecture.md) document.

### Low-Level Design Details

For detailed information about the implementation of each module, please see the [Low Level Architecture](docs/Low%20Level%20Architecture.md) document.

## API Endpoints

### Stocks

- `GET /api/stocks` - List available stocks with pagination

### Portfolio

- `GET /api/portfolio/:userId` - Get user portfolio

### Trades

- `POST /api/stocks/:symbol/buy` - Execute stock purchase

## Testing

Run unit tests:

```bash
npm run test
```

Run end-to-end tests:

```bash
npm run test:e2e
```

## Environment Variables

See `.env.example` for a complete list of environment variables.

## Project Structure

- `src/stocks/` - Stock listing and data fetching
- `src/portfolio/` - User portfolio management
- `src/trades/` - Trade execution
- `src/reports/` - Report generation and emailing
- `src/common/` - Shared utilities, filters, and interceptors
- `src/config/` - Configuration handling

## License

ISC
