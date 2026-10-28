import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get<string>('SMTP_FROM', 'NSM Studio <noreply@localhost>');
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST', 'localhost'),
      port: Number(this.config.get<string>('SMTP_PORT', '1025')),
      secure: false,
      auth: this.config.get('SMTP_USER')
        ? {
            user: this.config.get<string>('SMTP_USER'),
            pass: this.config.get<string>('SMTP_PASS'),
          }
        : undefined,
    });
  }

  async send(to: string, subject: string, html: string, text?: string) {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
        text: text ?? html.replace(/<[^>]+>/g, ' '),
      });
    } catch (err) {
      this.logger.error(`Nie udało się wysłać e-maila do ${to}`, err);
      throw err;
    }
  }

  async sendVerificationEmail(to: string, link: string) {
    await this.send(
      to,
      'Potwierdź adres e-mail – NSM Studio',
      `<p>Witaj,</p>
       <p>Aby aktywować konto, kliknij w odnośnik:</p>
       <p><a href="${link}">${link}</a></p>
       <p>Link jest ważny przez 24 godziny.</p>`,
    );
  }

  async sendPasswordResetEmail(to: string, link: string) {
    await this.send(
      to,
      'Reset hasła – NSM Studio',
      `<p>Witaj,</p>
       <p>Otrzymaliśmy prośbę o zresetowanie hasła. Kliknij w odnośnik:</p>
       <p><a href="${link}">${link}</a></p>
       <p>Link jest ważny przez 1 godzinę. Jeśli to nie Ty – zignoruj tę wiadomość.</p>`,
    );
  }
}
