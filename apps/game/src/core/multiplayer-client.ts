import { Application, Color, Entity, StandardMaterial } from 'playcanvas';
import type { Triplet } from '../maps/map-catalog';
import type { MotionState } from './character-system';

type PeerState = {
  playerId: string;
  map: string;
  room: string;
  position: Triplet;
  yaw: number;
  motion: MotionState;
  updatedAt: number;
};

type RemotePeer = {
  entity: Entity;
  state: PeerState;
};

type Transport = 'broadcast' | 'http';

function safePlayerId(): string {
  const key = 'hideverse-player-id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created =
    crypto.randomUUID?.() ?? `player-${Date.now()}-${Math.floor(Math.random() * 99999)}`;
  localStorage.setItem(key, created);
  return created;
}

function sanitizeRoom(value: string | null): string {
  const normalized = (value ?? 'LOCAL')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 16);
  return normalized || 'LOCAL';
}

function peerMaterial(): StandardMaterial {
  const result = new StandardMaterial();
  result.diffuse = new Color(0.35, 0.92, 0.95);
  result.emissive = new Color(0.05, 0.18, 0.2);
  result.update();
  return result;
}

export class MultiplayerClient {
  private readonly playerId = safePlayerId();
  private room = sanitizeRoom(new URLSearchParams(window.location.search).get('room'));
  private transport: Transport = 'broadcast';
  private channel: BroadcastChannel | null = null;
  private apiBase: string | null = null;
  private statusText = 'LOCAL ROOM';
  private readonly peers = new Map<string, RemotePeer>();
  private nextSendAt = 0;
  private nextPollAt = 0;
  private lastState: PeerState | null = null;
  private disposed = false;
  private readonly material = peerMaterial();

  constructor(
    private readonly app: Application,
    private readonly mapId: string,
  ) {
    const query = new URLSearchParams(window.location.search);
    const explicitServer = query.get('server');
    const hostLooksStatic = /githubraw\.com|raw\.githubusercontent\.com|stackblitz\.io/i.test(
      window.location.hostname,
    );

    if (explicitServer) {
      void this.connectHttp(explicitServer);
    } else if (!hostLooksStatic && window.location.protocol.startsWith('http')) {
      void this.connectHttp(window.location.origin);
    } else {
      this.startBroadcast();
    }
  }

  get status(): string {
    return this.statusText;
  }

  get peerCount(): number {
    return this.peers.size;
  }

  get roomCode(): string {
    return this.room;
  }

  update(position: { x: number; y: number; z: number }, yaw: number, motion: MotionState): void {
    if (this.disposed) return;

    const now = performance.now();
    this.lastState = {
      playerId: this.playerId,
      map: this.mapId,
      room: this.room,
      position: [position.x, position.y, position.z],
      yaw,
      motion,
      updatedAt: Date.now(),
    };

    if (now >= this.nextSendAt) {
      this.nextSendAt = now + 100;
      this.sendState(this.lastState);
    }

    if (this.transport === 'http' && now >= this.nextPollAt) {
      this.nextPollAt = now + 350;
      void this.pollPeers();
    }

    const staleBefore = Date.now() - 5000;
    for (const [id, peer] of this.peers) {
      if (peer.state.updatedAt < staleBefore) {
        peer.entity.destroy();
        this.peers.delete(id);
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.channel?.close();
    for (const peer of this.peers.values()) {
      peer.entity.destroy();
    }
    this.peers.clear();
  }

  private async connectHttp(base: string): Promise<void> {
    this.statusText = 'CONNECTING';
    const normalized = base.replace(/\/$/, '');

    try {
      const response = await fetch(`${normalized}/api/multiplayer/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          room: this.room,
          map: this.mapId,
          playerId: this.playerId,
        }),
      });

      if (!response.ok) throw new Error(`join HTTP ${response.status}`);
      const payload = (await response.json()) as { room?: string };
      if (payload.room) this.room = sanitizeRoom(payload.room);

      this.transport = 'http';
      this.apiBase = normalized;
      this.statusText = 'ONLINE ROOM';
      localStorage.setItem('hideverse-last-room', this.room);
    } catch (error) {
      console.warn('[Hideverse multiplayer] HTTP room unavailable, using local room.', error);
      this.startBroadcast();
    }
  }

  private startBroadcast(): void {
    this.transport = 'broadcast';
    this.apiBase = null;
    this.statusText = 'LOCAL ROOM';

    if (!('BroadcastChannel' in window)) {
      this.statusText = 'SOLO';
      return;
    }

    this.channel?.close();
    this.channel = new BroadcastChannel(`hideverse-${this.mapId}-${this.room}`);
    this.channel.addEventListener('message', (event: MessageEvent<PeerState>) => {
      const state = event.data;
      if (!state || state.playerId === this.playerId || state.map !== this.mapId) return;
      this.applyPeerState(state);
    });
  }

  private sendState(state: PeerState): void {
    if (this.transport === 'broadcast') {
      this.channel?.postMessage(state);
      return;
    }

    if (!this.apiBase) return;
    void fetch(`${this.apiBase}/api/multiplayer/state`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(state),
      keepalive: true,
    }).catch(() => {
      this.statusText = 'RECONNECTING';
    });
  }

  private async pollPeers(): Promise<void> {
    if (!this.apiBase || this.disposed) return;

    try {
      const query = new URLSearchParams({
        room: this.room,
        map: this.mapId,
        playerId: this.playerId,
      });
      const response = await fetch(`${this.apiBase}/api/multiplayer/room?${query.toString()}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`room HTTP ${response.status}`);

      const payload = (await response.json()) as { peers?: PeerState[] };
      for (const peer of payload.peers ?? []) {
        this.applyPeerState(peer);
      }
      this.statusText = 'ONLINE ROOM';
    } catch (error) {
      console.warn('[Hideverse multiplayer] room poll failed.', error);
      this.statusText = 'RECONNECTING';
    }
  }

  private applyPeerState(state: PeerState): void {
    if (state.playerId === this.playerId || state.map !== this.mapId) return;

    let peer = this.peers.get(state.playerId);
    if (!peer) {
      const entity = new Entity(`remote-${state.playerId}`);
      entity.addComponent('render', { type: 'capsule' });
      entity.setLocalScale(0.72, 1, 0.72);
      if (entity.render) entity.render.material = this.material;
      this.app.root.addChild(entity);
      peer = { entity, state };
      this.peers.set(state.playerId, peer);
    }

    peer.state = state;
    peer.entity.setPosition(state.position[0], state.position[1], state.position[2]);
    peer.entity.setEulerAngles(0, state.yaw, 0);
  }
}
