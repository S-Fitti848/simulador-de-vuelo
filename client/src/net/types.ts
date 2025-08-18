export interface Hello {
  type: 'hello';
  id: string;
  serverTime: number;
}

export interface Presence {
  type: 'presence';
  onlineCount: number;
}

export interface RoomPlayer {
  id: string;
  username: string;
  aircraft: string;
  ready: boolean;
}

export interface RoomInfo {
  id: string;
  name: string;
  status: 'waiting' | 'ready' | 'in-game';
  players: RoomPlayer[];
  max: number;
  ownerId: string;
}

export interface Rooms {
  type: 'rooms';
  list: RoomInfo[];
}

export interface RoomCreated {
  type: 'roomCreated';
  room: RoomInfo;
}

export interface Joined {
  type: 'joined';
  room: RoomInfo;
}

export interface Updated {
  type: 'updated';
  room: RoomInfo;
}

export interface Ready {
  type: 'ready';
  playerId: string;
  ready: boolean;
}

export interface MatchStart {
  type: 'matchStart';
  roomId: string;
  startTime: number;
}

export interface MatchEnd {
  type: 'matchEnd';
  roomId: string;
  reason: string;
}

export type LobbyMessage =
  | Hello
  | Presence
  | Rooms
  | RoomCreated
  | Joined
  | Updated
  | Ready
  | MatchStart
  | MatchEnd;
