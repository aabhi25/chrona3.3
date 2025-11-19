export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS'
}

export interface NotificationPayload {
  recipient: string;
  subject?: string;
  body: string;
  channel: NotificationChannel;
  channelSpecific?: {
    fromEmail?: string;
    fromName?: string;
    smsFrom?: string;
    [key: string]: any;
  };
}

export interface NotificationResult {
  success: boolean;
  message: string;
  messageId?: string;
  error?: string;
}

export interface NotificationProvider {
  send(payload: NotificationPayload): Promise<NotificationResult>;
}

export class NoopNotificationProvider implements NotificationProvider {
  async send(payload: NotificationPayload): Promise<NotificationResult> {
    console.log(`[NotificationService] Noop provider - would send ${payload.channel} to ${payload.recipient}`);
    console.log(`[NotificationService] Subject: ${payload.subject || 'N/A'}`);
    console.log(`[NotificationService] Body: ${payload.body}`);
    
    return {
      success: true,
      message: 'Notification logged (provider not configured)',
      messageId: `noop-${Date.now()}`
    };
  }
}

export function getNotificationProvider(): NotificationProvider {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'production' && process.env.NOTIFICATION_PROVIDER) {
    console.log(`[NotificationService] Production notification provider not yet implemented`);
  }
  
  return new NoopNotificationProvider();
}
