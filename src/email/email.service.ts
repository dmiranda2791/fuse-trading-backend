import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { compile } from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import * as FormData from 'form-data';
import axios, { AxiosResponse } from 'axios';

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

interface MailgunResponse {
  id: string;
  message: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
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

    if (!this.useMailgun) {
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

    this.transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });
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
    if (!this.mailgunApiKey || !this.mailgunDomain) {
      this.logger.error('Mailgun configuration is missing');
      return false;
    }

    const form = new FormData();
    form.append('from', this.from);

    if (Array.isArray(options.to)) {
      options.to.forEach(recipient => {
        form.append('to', recipient);
      });
    } else {
      form.append('to', options.to);
    }

    form.append('subject', options.subject);
    form.append('html', options.html);

    if (options.text) {
      form.append('text', options.text);
    }

    if (options.attachments) {
      options.attachments.forEach(attachment => {
        form.append('attachment', attachment.content, {
          filename: attachment.filename,
          contentType: attachment.contentType,
        });
      });
    }

    try {
      const response: AxiosResponse<MailgunResponse> = await axios.post(
        `https://api.mailgun.net/v3/${this.mailgunDomain}/messages`,
        form,
        {
          auth: {
            username: 'api',
            password: this.mailgunApiKey,
          },
          headers: form.getHeaders(),
        },
      );

      this.logger.log(`Email sent with Mailgun: ${response.data.id}`);
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
