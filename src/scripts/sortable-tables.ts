import Tablesort from 'tablesort';

// Register numeric sort (Tablesort's number plugin is a separate file that expects a global,
// so we register it here instead).
Tablesort.extend(
  'number',
  (item) => /^-?[\d,]+(\.\d+)?%?$/.test(item.trim()),
  (a, b) => {
    const an = parseFloat(a.replace(/[^-\d.]/g, '')) || 0;
    const bn = parseFloat(b.replace(/[^-\d.]/g, '')) || 0;
    return bn - an;
  },
);

// Values that represent missing data — sort to bottom in ascending (number sort uses 9999999 sentinel)
const NULL_TEXT = new Set(['—', 'dnf', 'dns', '']);
const NULL_SENTINEL = '9999999';

function parseTimeMs(raw: string): string {
  const text = raw.trim().toLowerCase();
  if (NULL_TEXT.has(text)) return NULL_SENTINEL;

  // m:ss.SSS (race/qualifying time)
  const mss = text.match(/^(\d+):(\d+\.\d+)$/);
  if (mss) return String(+mss[1] * 60_000 + parseFloat(mss[2]) * 1_000);

  // +N.NNN (gap in seconds)
  const gap = text.match(/^\+(\d+\.\d+)$/);
  if (gap) return String(parseFloat(gap[1]) * 1_000);

  // +N lap(s) — rank lapped cars after all on-lead-lap finishers, ordered by laps down
  const laps = text.match(/^\+(\d+)\s+laps?$/);
  if (laps) return String(99_000_000 + +laps[1] * 1_000);

  return NULL_SENTINEL;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    if (!table.tHead || !table.tBodies[0]) return;
    if (table.tBodies[0].rows.length < 2) return;

    const headerRow = table.tHead.rows[table.tHead.rows.length - 1];
    const headers = Array.from(headerRow.cells);

    headers.forEach((th, colIdx) => {
      if (th.classList.contains('delta-col')) {
        th.setAttribute('data-sort-method', 'none');
        return;
      }

      const isTime = th.classList.contains('time');
      const isNum = th.classList.contains('num');

      if (isTime || isNum) {
        th.setAttribute('data-sort-method', 'number');
      }

      // Pre-stamp data-sort on cells so the number parser gets clean values
      Array.from(table.tBodies[0].rows).forEach((row) => {
        const cell = row.cells[colIdx];
        if (!cell) return;

        if (isTime) {
          cell.setAttribute('data-sort', parseTimeMs(cell.textContent ?? ''));
        } else if (isNum) {
          const t = (cell.textContent ?? '').trim().toLowerCase();
          if (NULL_TEXT.has(t)) cell.setAttribute('data-sort', NULL_SENTINEL);
        }
      });
    });

    // Snapshot original row order before Tablesort touches the table.
    const originalRows = Array.from(table.tBodies[0].rows);

    // Tablesort only has a 2-state cycle (ascending ↔ descending). Intercept the
    // 3rd click (column is already descending) in the capture phase — before
    // Tablesort's bubble listener on the <th> fires — and restore the original order.
    table.addEventListener(
      'click',
      (e) => {
        const th = (e.target as Element).closest('th');
        if (!th || th.getAttribute('data-sort-method') === 'none') return;
        if (th.getAttribute('aria-sort') === 'descending') {
          e.stopImmediatePropagation();
          originalRows.forEach((row) => table.tBodies[0].appendChild(row));
          th.removeAttribute('aria-sort');
        }
      },
      true, // capture phase — fires before Tablesort's bubble listener on <th>
    );

    new Tablesort(table);
  });
});
