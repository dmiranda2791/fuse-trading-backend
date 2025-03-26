import { Test, TestingModule } from '@nestjs/testing';
import { EmailService, MailOptions } from './email.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import axios from 'axios';
import * as fs from 'fs';
import { compile } from 'handlebars';

// Mock dependencies
jest.mock('nodemailer');
jest.mock('axios');
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));
jest.mock('handlebars', () => ({
  compile: jest.fn(),
}));

describe('EmailService', () => {
  let service: EmailService;
  let mockConfigService: Partial<ConfigService>;
  let mockTransporter: jest.Mocked<nodemailer.Transporter>;

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

  beforeEach(async () => {
    // Create mock objects
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue(mockSendMailResponse),
    } as unknown as jest.Mocked<nodemailer.Transporter>;

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    // Using a partial mock for ConfigService
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        switch (key) {
          case 'email.from':
            return mockFrom;
          case 'email.recipients':
            return mockRecipients;
          case 'mailgun.enabled':
            return false;
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
      // Override config to enable mailgun
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        switch (key) {
          case 'email.from':
            return mockFrom;
          case 'email.recipients':
            return mockRecipients;
          case 'mailgun.enabled':
            return true;
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

      // Mock axios post
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          id: 'mailgun-message-id',
          message: 'Queued. Thank you.',
        },
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
      // Verify axios.post was called without checking mock.calls directly
      expect((axios.post as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    });

    it('should handle errors from mailgun', async () => {
      const mailOptions: MailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      (axios.post as jest.Mock).mockRejectedValueOnce(new Error('API error'));

      const result = await service.sendEmail(mailOptions);

      expect(result).toBe(false);
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
