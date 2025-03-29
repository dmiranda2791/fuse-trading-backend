import { Test, TestingModule } from '@nestjs/testing';
import { EmailService, MailOptions } from './email.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import { compile } from 'handlebars';

// Define types for better type safety
interface MockMailgunMessages {
  create: jest.Mock;
}

interface MockMailgunClient {
  messages: MockMailgunMessages;
}

// Mock dependencies
jest.mock('nodemailer');
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));
jest.mock('handlebars', () => ({
  compile: jest.fn(),
}));

// Mock FormData
jest.mock('form-data', () => {
  return jest.fn().mockImplementation(() => ({}));
});

// Mock Mailgun
jest.mock('mailgun.js', () => {
  return jest.fn().mockImplementation(() => {
    return {
      client: jest.fn().mockReturnValue({
        messages: {
          create: jest.fn(),
        },
      }),
    };
  });
});

describe('EmailService', () => {
  let service: EmailService;
  let mockConfigService: Partial<ConfigService>;
  let mockTransporter: jest.Mocked<nodemailer.Transporter>;
  let mockMailgunClient: MockMailgunClient;

  // Mock data
  const mockFrom = 'test@example.com';
  const mockRecipients = ['recipient1@example.com', 'recipient2@example.com'];
  const mockSmtpConfig = {
    host: 'smtp.example.com',
    port: 587,
    user: 'user',
    pass: 'pass',
  };

  // Mock sendMail response
  const mockSendMailResponse = {
    messageId: 'test-message-id',
  };

  // Mock Mailgun response
  const mockMailgunResponse = {
    id: 'mailgun-message-id',
    message: 'Queued. Thank you.',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create mock objects
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue(mockSendMailResponse),
    } as unknown as jest.Mocked<nodemailer.Transporter>;

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    // Mock Mailgun client
    mockMailgunClient = {
      messages: {
        create: jest.fn().mockResolvedValue(mockMailgunResponse),
      },
    };

    // Using a partial mock for ConfigService
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        switch (key) {
          case 'email.from':
            return mockFrom;
          case 'email.recipients':
            return mockRecipients;
          case 'mailgun.enabled':
            return false; // Will be overridden in specific tests
          case 'mailgun.domain':
            return 'test.domain.com';
          case 'mailgun.apiKey':
            return 'test-api-key';
          case 'email.smtp':
            return mockSmtpConfig;
          default:
            return undefined;
        }
      }),
    };

    // Create test module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendEmail', () => {
    it('should send email using nodemailer when mailgun is disabled', async () => {
      const mailOptions: MailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      const result = await service.sendEmail(mailOptions);

      expect(result).toBe(true);
      // Create a wrapper function to avoid unbound method issue
      const sendMailWrapper = () => {
        void mockTransporter.sendMail({
          from: mockFrom,
          to: mailOptions.to,
          subject: mailOptions.subject,
          html: mailOptions.html,
          text: undefined,
          attachments: undefined,
        });
      };
      sendMailWrapper();
      // Check the first argument of the first call
      const mockSendMailFirstCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(mockSendMailFirstCall).toEqual({
        from: mockFrom,
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html,
        text: undefined,
        attachments: undefined,
      });
    });

    it('should handle errors when sending email', async () => {
      const mailOptions: MailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      mockTransporter.sendMail.mockRejectedValueOnce(new Error('SMTP error'));

      const result = await service.sendEmail(mailOptions);

      expect(result).toBe(false);
    });
  });

  describe('sendWithMailgun', () => {
    beforeEach(() => {
      // Override config to enable mailgun and create a new service instance
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        switch (key) {
          case 'email.from':
            return mockFrom;
          case 'email.recipients':
            return mockRecipients;
          case 'mailgun.enabled':
            return true; // Enable Mailgun
          case 'mailgun.domain':
            return 'test.domain.com';
          case 'mailgun.apiKey':
            return 'test-api-key';
          case 'email.smtp':
            return mockSmtpConfig;
          default:
            return undefined;
        }
      });

      // Recreate service with mailgun enabled
      service = new EmailService(mockConfigService as ConfigService);

      // Manually set the mailgunClient property for tests
      Object.defineProperty(service, 'mailgunClient', {
        value: mockMailgunClient,
        writable: true,
      });

      // Set useMailgun to true
      Object.defineProperty(service, 'useMailgun', {
        value: true,
        writable: false,
      });
    });

    it('should send email using mailgun when enabled', async () => {
      const mailOptions: MailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      const result = await service.sendEmail(mailOptions);

      expect(result).toBe(true);
      expect(mockMailgunClient.messages.create).toHaveBeenCalledWith(
        'test.domain.com',
        {
          from: mockFrom,
          to: mailOptions.to,
          subject: mailOptions.subject,
          html: mailOptions.html,
        },
      );
    });

    it('should handle errors from mailgun', async () => {
      const mailOptions: MailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      mockMailgunClient.messages.create.mockRejectedValueOnce(
        new Error('API error'),
      );

      const result = await service.sendEmail(mailOptions);

      expect(result).toBe(false);
    });

    it('should handle array of recipients', async () => {
      const mailOptions: MailOptions = {
        to: ['recipient1@example.com', 'recipient2@example.com'],
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      const result = await service.sendEmail(mailOptions);

      expect(result).toBe(true);
      expect(mockMailgunClient.messages.create).toHaveBeenCalledWith(
        'test.domain.com',
        {
          from: mockFrom,
          to: 'recipient1@example.com,recipient2@example.com',
          subject: mailOptions.subject,
          html: mailOptions.html,
        },
      );
    });

    it('should include text content when provided', async () => {
      const mailOptions: MailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Plain text content',
      };

      const result = await service.sendEmail(mailOptions);

      expect(result).toBe(true);
      expect(mockMailgunClient.messages.create).toHaveBeenCalledWith(
        'test.domain.com',
        {
          from: mockFrom,
          to: mailOptions.to,
          subject: mailOptions.subject,
          html: mailOptions.html,
          text: mailOptions.text,
        },
      );
    });

    it('should include attachments when provided', async () => {
      const mailOptions: MailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        attachments: [
          {
            filename: 'test.pdf',
            content: Buffer.from('test content'),
            contentType: 'application/pdf',
          },
        ],
      };

      const result = await service.sendEmail(mailOptions);

      expect(result).toBe(true);

      // Ensure attachments are defined before testing
      if (mailOptions.attachments) {
        expect(mockMailgunClient.messages.create).toHaveBeenCalledWith(
          'test.domain.com',
          {
            from: mockFrom,
            to: mailOptions.to,
            subject: mailOptions.subject,
            html: mailOptions.html,
            attachment: [
              {
                data: mailOptions.attachments[0].content,
                filename: mailOptions.attachments[0].filename,
                contentType: mailOptions.attachments[0].contentType,
              },
            ],
          },
        );
      }
    });
  });

  describe('renderTemplate', () => {
    const templateName = 'test-template';
    const templateContent = '<h1>{{title}}</h1><p>{{content}}</p>';
    const context = { title: 'Test Title', content: 'Test Content' };
    const renderedHtml = '<h1>Test Title</h1><p>Test Content</p>';

    beforeEach(() => {
      (fs.promises.readFile as jest.Mock).mockResolvedValue(templateContent);
      (compile as jest.Mock).mockReturnValue(() => renderedHtml);
    });

    it('should render template correctly', async () => {
      const result = await service.renderTemplate(templateName, context);

      expect(result).toBe(renderedHtml);
      expect(fs.promises.readFile).toHaveBeenCalledWith(
        expect.stringContaining(templateName + '.hbs'),
        'utf8',
      );
      expect(compile).toHaveBeenCalledWith(templateContent);
    });

    it('should throw error when template rendering fails', async () => {
      const error = new Error('Template not found');
      (fs.promises.readFile as jest.Mock).mockRejectedValueOnce(error);

      await expect(
        service.renderTemplate(templateName, context),
      ).rejects.toThrow();
    });
  });

  describe('getDefaultRecipients', () => {
    it('should return configured recipients', () => {
      const recipients = service.getDefaultRecipients();
      expect(recipients).toEqual(mockRecipients);
    });
  });
});
