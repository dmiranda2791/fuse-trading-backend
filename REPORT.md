# Fuse Trading Backend - Architecture Report

## Overview

This document outlines the architecture and key technical decisions for the Fuse Stock Trading Backend. The application is built using NestJS, TypeScript, PostgreSQL, and Redis, with containerization via Docker.

## System Architecture

The system follows a modular architecture with clearly separated concerns:

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

## Key Technical Decisions

### Framework Selection: NestJS

**Decision**: Use NestJS as the primary framework.

**Rationale**:

- Provides a structured, module-based architecture that aligns with domain-driven design
- Strong TypeScript integration for type safety and better developer experience
- Built-in dependency injection for testable, loosely coupled components
- Extensive middleware, pipes, and interceptor support for cross-cutting concerns
- Active community and comprehensive documentation

### Database: PostgreSQL

**Decision**: Use PostgreSQL as the primary data store.

**Rationale**:

- ACID-compliant for reliable transaction handling
- Strong performance characteristics for our read/write patterns
- Rich query capabilities for reporting needs
- Widely supported and easily deployable in cloud environments
- TypeORM provides excellent integration with NestJS

### Caching Layer: Redis

**Decision**: Use Redis for caching and queue management.

**Rationale**:

- High-performance in-memory data store for caching stock data
- Native support for expiration (TTL) aligns with the 5-minute stock price refresh requirement
- Built-in data structures for efficient queue implementation
- Reliable and widely adopted for production use

### Queue System: BullMQ + Redis

**Decision**: Use BullMQ with Redis for job processing.

**Rationale**:

- Reliable queue system with retry capabilities
- Excellent NestJS integration
- Supports scheduled jobs for daily report generation
- Provides monitoring and visibility into queue state
- Handles concurrency properly

### API Documentation: Swagger/OpenAPI

**Decision**: Implement Swagger documentation for the API.

**Rationale**:

- Provides interactive documentation for API consumers
- Automatically generated from code annotations
- Supports API testing within the documentation interface
- Industry standard for API documentation

### Error Handling Strategy

**Decision**: Implement a standardized error handling approach with consistent error codes.

**Rationale**:

- Consistent error format improves client experience
- Domain-specific error codes help with troubleshooting
- Central exception filters reduce code duplication
- Structured logging improves observability

### Containerization: Docker

**Decision**: Use Docker for application packaging and deployment.

**Rationale**:

- Ensures consistent environments across development, testing, and production
- Simplifies dependency management
- Enables easy scaling and deployment
- Docker Compose streamlines multi-service local development

### Email Reporting System

**Decision**: Implement both SMTP and optional Mailgun integration.

**Rationale**:

- SMTP provides a standard email delivery mechanism
- Mailgun offers improved deliverability for production use
- Feature flag allows easy switching between providers
- MailHog integration simplifies local development and testing

## Key Architectural Patterns

### Repository Pattern

Used for database access, providing a clean separation between domain logic and data access.

### Dependency Injection

Heavily utilized through NestJS to maintain loose coupling between components.

### Caching Strategy

Stock data is cached with a 5-minute TTL to balance performance with accuracy.

### Circuit Breaker

Implemented for external API calls to handle the unreliable vendor API.

### Feature Flags

Used for optional components like Sentry and Datadog integration.

## Pagination Strategy

The application implements a unique pagination translation mechanism:

- The vendor API uses token-based pagination
- The client-facing API uses standard offset-based pagination (page/limit)
- An internal service translates between these two models

This decision provides a consistent and familiar API for clients while working with the vendor's pagination model.

## Trade Validation

A key business rule is implemented for the 2% price validation:

- Current stock price is fetched from the vendor API
- User-requested purchase price is validated to be within ±2% of the current price
- The validation occurs before the actual purchase API call
- All trade attempts (successful or failed) are logged for reporting

## Security Considerations

- API key authentication for all endpoints
- Input validation using class-validator
- Rate limiting capabilities
- Proper error handling to prevent information leakage

## Resilience Features

- Retry mechanism for vendor API calls (with exponential backoff)
- Circuit breaker for persistent failures
- Comprehensive health checks for all dependencies
- Database connection pooling
- Queue-based processing with retry capabilities

## Testing Strategy

- Unit tests for services and business logic
- Integration tests for API endpoints
- End-to-end tests for critical flows
- Test containers for database and Redis dependencies

## Development Workflow

- Docker Compose for local development environment
- Hot reload for faster development cycles
- MailHog for local email testing
- Linting and formatting with ESLint and Prettier
- Git hooks via Husky for pre-commit checks

## Future Enhancements

- Add OpenTelemetry for distributed tracing
- Implement graphical dashboards for system monitoring
- Add user authentication and authorization
- Implement WebSocket for real-time price updates
- Add support for selling stocks and other transaction types
