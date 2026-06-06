import { describe, expect, it } from 'vitest';
import { formatGap } from './format';

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
