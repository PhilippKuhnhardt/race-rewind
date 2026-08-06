import { describe, expect, it } from 'vitest';
import { formatGap, formatRaceLabel } from './format';

describe('formatRaceLabel', () => {
  it('separates the season and race name', () => {
    expect(formatRaceLabel(2013, 'Australian Grand Prix')).toBe('2013 Australian Grand Prix');
  });
});

describe('formatGap', () => {
  it('derives a lap-behind gap for classified rows without elapsed time', () => {
    expect(formatGap('01:36:03.785', {
      position: 3,
      time: null,
      detail: 'Out of fuel',
      laps_completed: 71,
    }, 72)).toBe('+1 Lap');
  });
});
