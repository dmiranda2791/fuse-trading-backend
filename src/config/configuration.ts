export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),

  api: {
    key: process.env.FUSE_API_KEY,
    baseUrl: process.env.FUSE_API_BASE_URL,
  },

  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  },

  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  email: {
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    from: process.env.EMAIL_FROM,
    recipients: process.env.EMAIL_RECIPIENTS?.split(',') || [],
  },

  mailgun: {
    enabled: process.env.ENABLE_MAILGUN === 'true',
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN,
  },

  featureFlags: {
    sentry: process.env.ENABLE_SENTRY === 'true',
    datadog: process.env.ENABLE_DATADOG === 'true',
  },

  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '10', 10),
  },
});
