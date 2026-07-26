import { describe, expect, it } from 'vitest';
import { groupByPosition, type Player } from '../../src/lib/squad';

function player(overrides: Partial<Player> & { id: string; number: number; position: Player['position'] }): Player {
  return {
    name: overrides.id,
    nationality: 'MY',
    dateOfBirth: new Date('1998-01-01'),
    heightCm: 180,
    photo: '/images/squad/placeholder.svg',
    joined: 2024,
    ...overrides,
  };
}

describe('groupByPosition', () => {
  it('orders groups goalkeeper, defender, midfielder, forward', () => {
    const groups = groupByPosition([
      player({ id: 'f', number: 9, position: 'Forward' }),
      player({ id: 'g', number: 1, position: 'Goalkeeper' }),
      player({ id: 'm', number: 8, position: 'Midfielder' }),
      player({ id: 'd', number: 4, position: 'Defender' }),
    ]);

    expect(groups.map((g) => g.position)).toEqual([
      'Goalkeeper',
      'Defender',
      'Midfielder',
      'Forward',
    ]);
  });

  it('sorts players by squad number within a group', () => {
    const groups = groupByPosition([
      player({ id: 'eleven', number: 11, position: 'Forward' }),
      player({ id: 'nine', number: 9, position: 'Forward' }),
    ]);

    expect(groups[0].players.map((p) => p.number)).toEqual([9, 11]);
  });

  it('omits positions with no players rather than rendering empty sections', () => {
    const groups = groupByPosition([player({ id: 'g', number: 1, position: 'Goalkeeper' })]);
    expect(groups).toHaveLength(1);
  });

  it('returns an empty array for an empty squad', () => {
    expect(groupByPosition([])).toEqual([]);
  });
});
