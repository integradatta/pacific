import { Injectable } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { jwtVerify } from 'jose';
import type { RealtimeEvent, RealtimePublisher } from './realtime.js';

/**
 * Gateway de tempo real (spec §2.2). Namespace /ws/locations, uma room por group_id.
 * Autentica o JWT no handshake (mesmo segredo do HTTP; trocar por JWKS no Supabase).
 * Clientes entram na room ao abrir o mapa (subscribe_group) e saem ao fechar.
 * O servidor só envia para quem está conectado (economiza banda/bateria — push-pull).
 */
@Injectable()
@WebSocketGateway({ namespace: '/ws/locations', cors: { origin: true } })
export class LocationsGateway implements RealtimePublisher, OnGatewayConnection {
  @WebSocketServer() private server!: Server;
  private readonly secret = new TextEncoder().encode(process.env.GEO_JWT_SECRET ?? '');

  async handleConnection(client: Socket): Promise<void> {
    const token = (client.handshake.auth?.['token'] as string | undefined) ?? undefined;
    if (!token) return void client.disconnect();
    try {
      const { payload } = await jwtVerify(token, this.secret);
      const tenantId = typeof payload['tenant_id'] === 'string' ? payload['tenant_id'] : undefined;
      if (!tenantId) return void client.disconnect();
      client.data.tenantId = tenantId;
      client.data.userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('subscribe_group')
  onSubscribe(@ConnectedSocket() client: Socket, @MessageBody() data: { groupId?: string }): void {
    if (data?.groupId) void client.join(this.room(data.groupId));
  }

  @SubscribeMessage('unsubscribe_group')
  onUnsubscribe(@ConnectedSocket() client: Socket, @MessageBody() data: { groupId?: string }): void {
    if (data?.groupId) void client.leave(this.room(data.groupId));
  }

  broadcast(groupId: string, event: RealtimeEvent, payload: unknown): void {
    this.server?.to(this.room(groupId)).emit(event, payload);
  }

  private room(groupId: string): string {
    return `group:${groupId}`;
  }
}
