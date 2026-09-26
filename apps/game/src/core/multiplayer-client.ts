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
  targetPosition: Triplet;
  targetYaw: number;
};

type Transport = 'broadcast' | 'http-stream';

type BroadcastMessage =
  | { type: 'state'; state: PeerState }
  | {
      type: 'objective';
      map: string;
      room: string;
      playerId: string;
      objectiveId: string;
    }
  | {
      type: 'round-reset';
      map: string;
      room: string;
      playerId: string;
      roundStartedAt: number;
    }
  | {
      type: 'sync-request';
      map: string;
      room: string;
      playerId: string;
    }
  | {
      type: 'sync-snapshot';
      map: string;
      room: string;
      playerId: string;
      to: string;
      objectives: string[];
      roundStartedAt: number;
    };

type RoomPayload = {
  room?: string;
  peers?: PeerState[];
  objectives?: string[];
  roundStartedAt?: number;
};

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
  private eventSource: EventSource | null = null;
  private apiBase: string | null = null;
  private statusText = 'LOCAL ROOM';
  private readonly peers = new Map<string, RemotePeer>();
  private readonly sharedObjectives = new Set<string>();
  private readonly pendingObjectives = new Set<string>();
  private nextSendAt = 0;
  private nextPollAt = 0;
  private readonly sendIntervalMs = matchMedia('(pointer: coarse)').matches ? 125 : 80;
  private lastState: PeerState | null = null;
  private disposed = false;
  private reconnecting = false;
  private resetQueued = false;
  private roundStartedAtValue = Date.now();
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

  get roundElapsedSeconds(): number {
    return Math.max(0, (Date.now() - this.roundStartedAtValue) / 1000);
  }

  update(
    position: { x: number; y: number; z: number },
    yaw: number,
    motion: MotionState,
    deltaSeconds: number,
  ): void {
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
      this.nextSendAt = now + this.sendIntervalMs;
      this.sendState(this.lastState);
    }

    if (this.transport === 'http-stream' && now >= this.nextPollAt) {
      this.nextPollAt = now + 2000;
      void this.pollPeers();
    }

    this.animatePeers(deltaSeconds);

    const staleBefore = Date.now() - 7000;
    for (const [id, peer] of this.peers) {
      if (peer.state.updatedAt < staleBefore) {
        peer.entity.destroy();
        this.peers.delete(id);
      }
    }
  }

  consumeRemoteObjectives(): string[] {
    const result = [...this.pendingObjectives];
    this.pendingObjectives.clear();
    return result;
  }

  consumeRoundReset(): boolean {
    const queued = this.resetQueued;
    this.resetQueued = false;
    return queued;
  }

  submitObjective(objectiveId: string): void {
    if (!objectiveId || this.sharedObjectives.has(objectiveId)) return;
    this.sharedObjectives.add(objectiveId);

    if (this.transport === 'broadcast') {
      this.channel?.postMessage({
        type: 'objective',
        map: this.mapId,
        room: this.room,
        playerId: this.playerId,
        objectiveId,
      } satisfies BroadcastMessage);
      return;
    }

    if (!this.apiBase) return;
    void fetch(`${this.apiBase}/api/multiplayer/objective`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        map: this.mapId,
        room: this.room,
        playerId: this.playerId,
        objectiveId,
      }),
      keepalive: true,
    }).catch((error) => {
      console.warn('[Hideverse multiplayer] objective sync failed.', error);
    });
  }

  resetRound(): void {
    this.sharedObjectives.clear();
    this.pendingObjectives.clear();
    this.roundStartedAtValue = Date.now();

    if (this.transport === 'broadcast') {
      this.channel?.postMessage({
        type: 'round-reset',
        map: this.mapId,
        room: this.room,
        playerId: this.playerId,
        roundStartedAt: this.roundStartedAtValue,
      } satisfies BroadcastMessage);
      return;
    }

    if (!this.apiBase) return;
    void fetch(`${this.apiBase}/api/multiplayer/reset`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        map: this.mapId,
        room: this.room,
        playerId: this.playerId,
      }),
      keepalive: true,
    }).catch((error) => {
      console.warn('[Hideverse multiplayer] round reset failed.', error);
    });
  }

  dispose(): void {
    this.disposed = true;
    this.channel?.close();
    this.eventSource?.close();

    if (this.apiBase) {
      void fetch(`${this.apiBase}/api/multiplayer/leave`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          room: this.room,
          map: this.mapId,
          playerId: this.playerId,
        }),
        keepalive: true,
      }).catch(() => undefined);
    }

    for (const peer of this.peers.values()) peer.entity.destroy();
    this.peers.clear();
  }

  private async connectHttp(base: string): Promise<void> {
    if (this.disposed || this.reconnecting) return;
    this.reconnecting = true;
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
      const payload = (await response.json()) as RoomPayload;
      if (payload.room) this.room = sanitizeRoom(payload.room);
      this.applyRoomMetadata(payload);

      this.transport = 'http-stream';
      this.apiBase = normalized;
      this.statusText = 'ONLINE STREAM';
      localStorage.setItem('hideverse-last-room', this.room);
      this.startEventStream();
      await this.pollPeers();
    } catch (error) {
      console.warn('[Hideverse multiplayer] online room unavailable, using local room.', error);
      this.startBroadcast();
    } finally {
      this.reconnecting = false;
    }
  }

  private startEventStream(): void {
    if (!this.apiBase || !('EventSource' in window)) {
      this.statusText = 'ONLINE POLLING';
      return;
    }

    this.eventSource?.close();
    const query = new URLSearchParams({
      room: this.room,
      map: this.mapId,
      playerId: this.playerId,
    });
    const source = new EventSource(`${this.apiBase}/api/multiplayer/events?${query.toString()}`);
    this.eventSource = source;

    source.addEventListener('open', () => {
      this.statusText = 'ONLINE STREAM';
    });

    source.addEventListener('snapshot', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as RoomPayload;
        for (const peer of payload.peers ?? []) this.applyPeerState(peer);
        this.applyRoomMetadata(payload);
      } catch (error) {
        console.warn('[Hideverse multiplayer] invalid snapshot event.', error);
      }
    });

    source.addEventListener('state', (event) => {
      try {
        const state = JSON.parse((event as MessageEvent<string>).data) as PeerState;
        this.applyPeerState(state);
      } catch (error) {
        console.warn('[Hideverse multiplayer] invalid state event.', error);
      }
    });

    source.addEventListener('objective', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          objectiveId?: string;
        };
        if (payload.objectiveId) this.applyRemoteObjective(payload.objectiveId);
      } catch (error) {
        console.warn('[Hideverse multiplayer] invalid objective event.', error);
      }
    });

    source.addEventListener('round-reset', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          roundStartedAt?: number;
        };
        this.sharedObjectives.clear();
        this.pendingObjectives.clear();
        this.roundStartedAtValue = payload.roundStartedAt ?? Date.now();
        this.resetQueued = true;
      } catch (error) {
        console.warn('[Hideverse multiplayer] invalid round reset event.', error);
      }
    });

    source.addEventListener('leave', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as { playerId?: string };
        if (!payload.playerId) return;
        const peer = this.peers.get(payload.playerId);
        peer?.entity.destroy();
        this.peers.delete(payload.playerId);
      } catch (error) {
        console.warn('[Hideverse multiplayer] invalid leave event.', error);
      }
    });

    source.addEventListener('error', () => {
      if (!this.disposed) this.statusText = 'RECONNECTING';
    });
  }

  private startBroadcast(): void {
    this.transport = 'broadcast';
    this.apiBase = null;
    this.eventSource?.close();
    this.eventSource = null;
    this.statusText = 'LOCAL ROOM';

    if (!('BroadcastChannel' in window)) {
      this.statusText = 'SOLO';
      return;
    }

    this.channel?.close();
    this.channel = new BroadcastChannel(`hideverse-${this.mapId}-${this.room}`);
    this.channel.addEventListener('message', (event: MessageEvent<BroadcastMessage>) => {
      const message = event.data;
      if (!message) return;

      if (message.type === 'state') {
        if (
          message.state.map === this.mapId &&
          message.state.room === this.room &&
          message.state.playerId !== this.playerId
        ) {
          this.applyPeerState(message.state);
        }
        return;
      }

      if (message.map !== this.mapId || message.room !== this.room) return;

      if (message.type === 'objective') {
        if (message.playerId !== this.playerId) this.applyRemoteObjective(message.objectiveId);
        return;
      }

      if (message.type === 'round-reset') {
        if (message.playerId !== this.playerId) {
          this.sharedObjectives.clear();
          this.pendingObjectives.clear();
          this.roundStartedAtValue = message.roundStartedAt;
          this.resetQueued = true;
        }
        return;
      }

      if (message.type === 'sync-request') {
        if (message.playerId === this.playerId) return;
        this.channel?.postMessage({
          type: 'sync-snapshot',
          map: this.mapId,
          room: this.room,
          playerId: this.playerId,
          to: message.playerId,
          objectives: [...this.sharedObjectives],
          roundStartedAt: this.roundStartedAtValue,
        } satisfies BroadcastMessage);
        return;
      }

      if (message.type === 'sync-snapshot' && message.to === this.playerId) {
        for (const objectiveId of message.objectives) this.applyRemoteObjective(objectiveId);
        this.roundStartedAtValue = Math.min(this.roundStartedAtValue, message.roundStartedAt);
      }
    });

    this.channel.postMessage({
      type: 'sync-request',
      map: this.mapId,
      room: this.room,
      playerId: this.playerId,
    } satisfies BroadcastMessage);
  }

  private sendState(state: PeerState): void {
    if (this.transport === 'broadcast') {
      this.channel?.postMessage({ type: 'state', state } satisfies BroadcastMessage);
      return;
    }

    if (!this.apiBase) return;
    void fetch(`${this.apiBase}/api/multiplayer/state`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(state),
      keepalive: true,
    })
      .then((response) => {
        if (response.status === 403 && this.apiBase) {
          this.statusText = 'RECONNECTING';
          void this.connectHttp(this.apiBase);
          return;
        }
        if (!response.ok) throw new Error(`state HTTP ${response.status}`);
      })
      .catch((error) => {
        console.warn('[Hideverse multiplayer] state update failed.', error);
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

      const payload = (await response.json()) as RoomPayload;
      for (const peer of payload.peers ?? []) this.applyPeerState(peer);
      this.applyRoomMetadata(payload);

      if (this.eventSource?.readyState === EventSource.OPEN) {
        this.statusText = 'ONLINE STREAM';
      } else {
        this.statusText = 'ONLINE POLLING';
      }
    } catch (error) {
      console.warn('[Hideverse multiplayer] room sync failed.', error);
      this.statusText = 'RECONNECTING';
    }
  }

  private applyRoomMetadata(payload: RoomPayload): void {
    if (payload.roundStartedAt && Number.isFinite(payload.roundStartedAt)) {
      this.roundStartedAtValue = payload.roundStartedAt;
    }
    for (const objectiveId of payload.objectives ?? []) this.applyRemoteObjective(objectiveId);
  }

  private applyRemoteObjective(objectiveId: string): void {
    if (!objectiveId || this.sharedObjectives.has(objectiveId)) return;
    this.sharedObjectives.add(objectiveId);
    this.pendingObjectives.add(objectiveId);
  }

  private animatePeers(deltaSeconds: number): void {
    const smoothing = 1 - Math.exp(-12 * Math.min(Math.max(deltaSeconds, 0), 0.1));
    for (const peer of this.peers.values()) {
      const current = peer.entity.getPosition();
      peer.entity.setPosition(
        current.x + (peer.targetPosition[0] - current.x) * smoothing,
        current.y + (peer.targetPosition[1] - current.y) * smoothing,
        current.z + (peer.targetPosition[2] - current.z) * smoothing,
      );
      const currentYaw = peer.entity.getEulerAngles().y;
      let deltaYaw = ((peer.targetYaw - currentYaw + 540) % 360) - 180;
      if (!Number.isFinite(deltaYaw)) deltaYaw = 0;
      peer.entity.setEulerAngles(0, currentYaw + deltaYaw * smoothing, 0);
    }
  }

  private applyPeerState(state: PeerState): void {
    if (state.playerId === this.playerId || state.map !== this.mapId) return;

    let peer = this.peers.get(state.playerId);
    if (!peer) {
      const entity = new Entity(`remote-${state.playerId}`);
      entity.addComponent('render', { type: 'capsule' });
      entity.setLocalScale(0.72, 1, 0.72);
      entity.setPosition(state.position[0], state.position[1], state.position[2]);
      if (entity.render) entity.render.material = this.material;
      this.app.root.addChild(entity);
      peer = {
        entity,
        state,
        targetPosition: [...state.position],
        targetYaw: state.yaw,
      };
      this.peers.set(state.playerId, peer);
    }

    peer.state = state;
    peer.targetPosition = [...state.position];
    peer.targetYaw = state.yaw;
  }
}
