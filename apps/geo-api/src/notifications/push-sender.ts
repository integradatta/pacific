import { Logger } from '@nestjs/common';

// Abstração de envio de push (desacopla do FCM → testável). NoopPushSender quando não há
// credenciais Firebase; FcmPushSender usa firebase-admin (init lazy a partir do env).
export interface PushMessage {
  title: string;
  body: string;
}
export interface PushSender {
  send(tokens: string[], message: PushMessage): Promise<void>;
}
export const PUSH_SENDER = Symbol('PUSH_SENDER');

export class NoopPushSender implements PushSender {
  private readonly log = new Logger('NoopPush');
  async send(tokens: string[], message: PushMessage): Promise<void> {
    this.log.debug(`(noop) push p/ ${tokens.length} device(s): ${message.title}`);
  }
}

/**
 * FCM via firebase-admin. Inicializa a partir de GOOGLE_APPLICATION_CREDENTIALS
 * (ou FIREBASE_SERVICE_ACCOUNT JSON). Import dinâmico p/ não exigir credenciais em dev/teste.
 */
export class FcmPushSender implements PushSender {
  private app: unknown;
  private messaging: { sendEachForMulticast: (m: unknown) => Promise<unknown> } | null = null;

  private async ensure(): Promise<void> {
    if (this.messaging) return;
    const admin = await import('firebase-admin');
    if (admin.apps.length === 0) {
      const json = process.env.FIREBASE_SERVICE_ACCOUNT;
      admin.initializeApp(json ? { credential: admin.credential.cert(JSON.parse(json)) } : undefined);
    }
    this.messaging = admin.messaging() as unknown as { sendEachForMulticast: (m: unknown) => Promise<unknown> };
  }

  async send(tokens: string[], message: PushMessage): Promise<void> {
    if (tokens.length === 0) return;
    await this.ensure();
    await this.messaging!.sendEachForMulticast({ tokens, notification: { title: message.title, body: message.body } });
  }
}

/** Escolhe o sender conforme o ambiente: FCM se configurado, senão no-op. */
export function createPushSender(): PushSender {
  const configured = !!(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS);
  return configured ? new FcmPushSender() : new NoopPushSender();
}
