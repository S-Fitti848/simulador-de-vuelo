// Tipos compartidos para el protocolo cliente ↔ servidor

export interface Vec3 { x: number; y: number; z: number; }
export interface Quat { x: number; y: number; z: number; w: number; }
export type RoomType = 'ffa' | '1v1' | '2v2';
export type Team     = 'A' | 'B' | 'none';

// ── Mensajes Servidor → Cliente ───────────────────────────────────────────────
export type ServerMsg =
  | { type: 'welcome';        playerId: string; lobbyState: LobbyState }
  | { type: 'lobby_update';   queues: Record<RoomType, number>; sizes: Record<RoomType, number> }
  | { type: 'queue_joined';   roomType: RoomType; queues: Record<RoomType, number>; sizes: Record<RoomType, number> }
  | { type: 'game_start';     roomId: string; roomType: RoomType; myId: string; myTeam: Team;
      spawnPos: Vec3; spawnQuat: Quat; duration: number; players: RemotePlayerInfo[] }
  | { type: 'game_state';     ts: number; players: RemotePlayerState[] }
  | { type: 'missile_spawned'; id: string; ownerId: string; position: Vec3; velocity: Vec3 }
  | { type: 'hit';            targetId: string; shooterId: string; hp: number }
  | { type: 'player_killed';  targetId: string; killerId: string;
      killerName: string; targetName: string; scores: Record<string, Score> }
  | { type: 'player_respawn'; playerId: string; position: Vec3 }
  | { type: 'game_end';       reason: string; winner: string; scores: Record<string, Score> }
  | { type: 'player_left';    playerId: string }
  | { type: 'pong';           t: number };

// ── Mensajes Cliente → Servidor ───────────────────────────────────────────────
export type ClientMsg =
  | { type: 'ping';           t: number }
  | { type: 'hello';          username: string; aircraft: string }
  | { type: 'join_queue';     roomType: RoomType }
  | { type: 'leave_queue' }
  | { type: 'player_state';   position: Vec3; quaternion: Quat; velocity: Vec3; throttle: number }
  | { type: 'missile_fired';  position: Vec3; velocity: Vec3 };

// ── Tipos auxiliares ──────────────────────────────────────────────────────────
export interface LobbyState {
  queues: Record<RoomType, number>;
  sizes:  Record<RoomType, number>;
}

export interface RemotePlayerInfo {
  id:         string;
  username:   string;
  aircraft:   string;
  team:       Team;
  position:   Vec3;
  quaternion: Quat;
}

export interface RemotePlayerState {
  id:         string;
  position:   Vec3;
  quaternion: Quat;
  velocity:   Vec3;
  throttle:   number;
  hp:         number;
  alive:      boolean;
}

export interface Score {
  kills:    number;
  deaths:   number;
  username: string;
}

export interface MultiplayerConfig {
  socket:       import('./socket').GameSocket;
  roomId:       string;
  roomType:     RoomType;
  myId:         string;
  myTeam:       Team;
  spawnPos:     Vec3;
  spawnQuat:    Quat;
  duration:     number;
  otherPlayers: RemotePlayerInfo[];
}
