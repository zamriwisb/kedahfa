export const POSITIONS = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'] as const;

export type Position = (typeof POSITIONS)[number];

export interface PlayerStats {
  appearances: number;
  goals: number;
  assists: number;
}

export interface Player {
  id: string;
  name: string;
  number: number;
  position: Position;
  nationality: string;
  dateOfBirth: Date;
  heightCm: number;
  photo: string;
  joined: number;
  bio?: string;
  stats?: PlayerStats;
}

export interface PositionGroup {
  position: Position;
  players: Player[];
}

/** Groups in footballing order, shirt-number ascending, empty groups dropped. */
export function groupByPosition(players: Player[]): PositionGroup[] {
  return POSITIONS.map((position) => ({
    position,
    players: players
      .filter((p) => p.position === position)
      .sort((a, b) => a.number - b.number),
  })).filter((group) => group.players.length > 0);
}
