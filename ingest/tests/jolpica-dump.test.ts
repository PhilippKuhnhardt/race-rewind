import { describe, expect, it } from 'vitest';
import { getDelayedCsvDump, hasNewDump, type JolpicaDumpState } from '../jolpica_dump';

const currentState: JolpicaDumpState = {
  dump_type: 'csv',
  file_hash: 'existing-hash',
  file_size: 123,
  uploaded_at: '2026-05-01T00:00:00.000000Z',
  source: 'test',
};

describe('Jolpica dump update checks', () => {
  it('uses the delayed CSV dump from the overview response', () => {
    const dump = getDelayedCsvDump({
      delayed_dumps: {
        csv: {
          dump_type: 'csv',
          file_hash: 'new-hash',
          file_size: 456,
          uploaded_at: '2026-05-24T22:36:16.860037Z',
          download_url: 'https://api.jolpi.ca/data/dumps/download/delayed/?dump_type=csv',
        },
      },
    });

    expect(dump).toEqual({
      dump_type: 'csv',
      file_hash: 'new-hash',
      file_size: 456,
      uploaded_at: '2026-05-24T22:36:16.860037Z',
      download_url: 'https://api.jolpi.ca/data/dumps/download/delayed/?dump_type=csv',
    });
  });

  it('detects a new dump by hash only', () => {
    expect(hasNewDump(currentState, {
      dump_type: 'csv',
      file_hash: 'new-hash',
      file_size: 123,
      uploaded_at: currentState.uploaded_at,
      download_url: 'https://example.com/dump.zip',
    })).toBe(true);

    expect(hasNewDump(currentState, {
      dump_type: 'csv',
      file_hash: currentState.file_hash,
      file_size: 999,
      uploaded_at: '2026-06-01T00:00:00.000000Z',
      download_url: 'https://example.com/dump.zip',
    })).toBe(false);
  });

  it('fails clearly when the overview has no delayed CSV dump', () => {
    expect(() => getDelayedCsvDump({ delayed_dumps: {} })).toThrow('delayed_dumps.csv');
  });
});
