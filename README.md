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

### Email Testing with Mailhog

This project uses Mailhog for email testing in development environments. **Important:** Mailhog is designed for development purposes only and does not actually deliver emails to real recipients by default.

When running the application with Docker Compose:

- Report emails and other system emails are sent to Mailhog
- You can view all captured emails at http://localhost:8025
- From the web interface, you can inspect email content, headers, and attachments
- If needed, you can manually release emails for actual delivery through the Mailhog UI

To test the report generation:

1. Use the report endpoints (`POST /reports/generate` or `GET /reports/generate-sync`)
2. Check the Mailhog UI at http://localhost:8025 to see the generated report emails
3. View the HTML content of the report by clicking on the email

In production environments, the application is configured to use Mailgun for reliable email delivery of reports and notifications. To enable Mailgun:

1. Set `ENABLE_MAILGUN=true` in your environment variables
2. Configure `MAILGUN_API_KEY` and `MAILGUN_DOMAIN` with your Mailgun account credentials
3. Set appropriate `EMAIL_FROM` and `EMAIL_RECIPIENTS` values for production use

If Mailgun is not enabled, the system will fall back to standard SMTP configuration.

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

## AWS Deployment

This project includes infrastructure configuration for deploying to AWS App Runner with RDS (PostgreSQL) and ElastiCache (Redis). The deployment is automated through GitHub Actions and Terraform.

### Deployment Overview

- **App Runner**: Hosts the containerized application
- **RDS**: Provides PostgreSQL database
- **ElastiCache**: Provides Redis cache
- **ECR**: Stores Docker images
- **GitHub Actions**: Handles CI/CD pipeline

### Deployment Instructions

For detailed deployment instructions, see the [Deployment Guide](DEPLOYMENT.md).

Quick start:

1. Set up AWS credentials
2. Configure GitHub repository secrets
3. Apply Terraform configuration
4. Push to main branch to trigger the CI/CD pipeline

## Data Seeding

To quickly populate a user's portfolio with test data, the project includes a seed script that automatically purchases random stocks:

```bash
# Make sure the application is running first
npm run seed-portfolio
```

By default, the script will:

- Use the user ID "user123"
- Attempt to purchase up to 20 different stocks
- Generate random quantities (1-10 shares per stock)
- Set purchase prices within the allowed ±2% range to ensure successful transactions

You can modify the script settings by editing `scripts/seed-portfolio.ts`:

- `USER_ID`: Change the target user
- `NUM_STOCKS_TO_BUY`: Adjust the number of stocks to purchase

The script provides detailed logging of each purchase attempt, showing successes and failures, and will add the purchased stocks to the specified user's portfolio.

## Documentation

### API Documentation

Interactive API documentation is available via Swagger UI at http://localhost:3000/api/docs when the application is running.

### Project Documentation

The following documentation is available in the `docs` directory:

- [Architecture Report](REPORT.md) - Detailed explanation of system architecture and design decisions
- [Implementation Roadmap](docs/Implementation%20Roadmap.md) - Step-by-step implementation plan
- [Deployment Guide](DEPLOYMENT.md) - Instructions for AWS App Runner deployment

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

### Reports

- `POST /reports/generate` - Trigger asynchronous generation of a daily report (optional `days` query param, default: 0 = today)
- `GET /reports/generate-sync` - Generate and send a daily report synchronously (optional `days` query param, default: 0 = today)

> **Note:** In development, report emails are sent to Mailhog and can be viewed at http://localhost:8025. In production, reports are delivered via Mailgun to actual recipients when the `ENABLE_MAILGUN` feature flag is set to `true`; otherwise, standard SMTP is used.

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
- `terraform/` - AWS infrastructure as code
- `.github/workflows/` - CI/CD pipeline configuration

## License

ISC
