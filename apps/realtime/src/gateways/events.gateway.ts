import type { TokenPayload } from '@crm/auth';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { ConnectedSocket, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

/**
 * Single gateway for Phase 1 — every realtime event (notifications,
 * application/task/activity updates) flows through one namespace, joined
 * into per-organisation and per-user rooms. Split into multiple gateways
 * only if a namespace's concerns genuinely diverge later; don't
 * over-engineer this ahead of real usage (see spec section 13).
 *
 * Auth: the client connects with the JWT access token in the Socket.IO
 * `auth` payload (not a cookie/header, which Socket.IO's handshake doesn't
 * forward the same way HTTP does). Same JwtStrategy secret as apps/api.
 */
@WebSocketGateway({
  cors: { origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',') },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(@ConnectedSocket() client: Socket): void {
    const token = client.handshake.auth?.token as string | undefined;

    try {
      const payload = this.jwtService.verify<TokenPayload>(token ?? '');
      void client.join(`org:${payload.organisationId}`);
      void client.join(`user:${payload.sub}`);
      this.logger.log(`Client connected: user=${payload.sub} org=${payload.organisationId}`);
    } catch {
      this.logger.warn(`Rejected unauthenticated connection: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Called by apps/api (via a shared Redis pub/sub channel, Phase 2) to fan out an event to a tenant. */
  emitToOrganisation(organisationId: string, event: string, payload: unknown): void {
    this.server.to(`org:${organisationId}`).emit(event, payload);
  }
}
