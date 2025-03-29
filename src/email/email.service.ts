import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { compile } from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import * as FormData from 'form-data';
import Mailgun from 'mailgun.js';

export interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: {
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }[];
}

/**
 * Email service for sending emails via SMTP or Mailgun
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  private mailgunClient: ReturnType<Mailgun['client']> | null = null;
  private readonly from: string;
  private readonly recipients: string[];
  private readonly useMailgun: boolean;
  private readonly mailgunDomain: string;
  private readonly mailgunApiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('email.from') || '';
    this.recipients =
      this.configService.get<string[]>('email.recipients') || [];
    this.useMailgun =
      this.configService.get<boolean>('mailgun.enabled') || false;
    this.mailgunDomain = this.configService.get<string>('mailgun.domain') || '';
    this.mailgunApiKey = this.configService.get<string>('mailgun.apiKey') || '';

    if (this.useMailgun) {
      this.initMailgun();
    } else {
      this.initNodemailer();
    }

    this.logger.log(
      `Email service initialized. Using ${this.useMailgun ? 'Mailgun' : 'SMTP'}`,
    );
  }

  private initNodemailer(): void {
    const smtpConfig = this.configService.get<{
      host: string;
      port: number;
      user: string;
      pass: string;
    }>('email.smtp');

    if (!smtpConfig) {
      this.logger.error('SMTP configuration is missing');
      return;
    }

    const transportConfig: nodemailer.TransportOptions & {
      host: string;
      port: number;
      secure: boolean;
      auth?: {
        user: string;
        pass: string;
      };
    } = {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465,
    };

    // Only include auth if both username and password are provided
    if (smtpConfig.user && smtpConfig.pass) {
      transportConfig.auth = {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      };
    }

    this.transporter = nodemailer.createTransport(transportConfig);
  }

  private initMailgun(): void {
    if (!this.mailgunApiKey || !this.mailgunDomain) {
      this.logger.error('Mailgun configuration is missing');
      return;
    }

    try {
      const mailgun = new Mailgun(FormData);

      this.mailgunClient = mailgun.client({
        username: 'api',
        key: this.mailgunApiKey,
      });
      this.logger.log('Mailgun client initialized');
    } catch (error) {
      this.logger.error(
        `Failed to initialize Mailgun client: ${(error as Error).message}`,
      );
    }
  }

  async sendEmail(options: MailOptions): Promise<boolean> {
    try {
      if (this.useMailgun) {
        return await this.sendWithMailgun(options);
      } else {
        return await this.sendWithNodemailer(options);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to send email: ${err.message}`, err.stack);
      return false;
    }
  }

  private async sendWithNodemailer(options: MailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.error('Email transporter not initialized');
      return false;
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: this.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    };

    const info = (await this.transporter.sendMail(mailOptions)) as {
      messageId: string;
    };
    this.logger.log(`Email sent: ${info.messageId}`);
    return true;
  }

  private async sendWithMailgun(options: MailOptions): Promise<boolean> {
    if (!this.mailgunClient) {
      this.logger.error('Mailgun client not initialized');
      return false;
    }

    try {
      const messageData: {
        from: string;
        to: string;
        subject: string;
        html: string;
        text?: string;
        attachment?: {
          data: string | Buffer;
          filename: string;
          contentType: string | undefined;
        }[];
      } = {
        from: this.from,
        to: Array.isArray(options.to) ? options.to.join(',') : options.to,
        subject: options.subject,
        html: options.html,
      };

      if (options.text) {
        messageData.text = options.text;
      }

      if (options.attachments && options.attachments.length > 0) {
        messageData.attachment = options.attachments.map(attachment => ({
          data: attachment.content,
          filename: attachment.filename,
          contentType: attachment.contentType,
        }));
      }

      const result = await this.mailgunClient.messages.create(
        this.mailgunDomain,
        messageData,
      );

      this.logger.log(`Email sent with Mailgun: ${result.id}`);
      return true;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Mailgun API error: ${err.message}`);
      return false;
    }
  }

  async renderTemplate(
    templateName: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    try {
      const templatePath = path.join(
        process.cwd(),
        'src',
        'reports',
        'templates',
        `${templateName}.hbs`,
      );
      const templateContent = await fs.promises.readFile(templatePath, 'utf8');
      const template = compile(templateContent);
      return template(context);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to render template ${templateName}: ${err.message}`,
      );
      throw new Error(`Template rendering failed: ${err.message}`);
    }
  }

  getDefaultRecipients(): string[] {
    return this.recipients;
  }
}
