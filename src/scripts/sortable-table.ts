const LAST = '￿';

function cellVal(cell: HTMLTableCellElement | undefined): string | number {
  if (!cell) return LAST;
  const raw = cell.dataset.sortValue ?? cell.textContent?.trim() ?? '';
  if (!raw || raw === '—' || raw === 'DNF') return LAST;
  const n = parseFloat(raw);
  return isNaN(n) ? raw : n;
}

function compare(a: string | number, b: string | number, dir: 1 | -1): number {
  if (a === LAST && b === LAST) return 0;
  if (a === LAST) return 1;
  if (b === LAST) return -1;
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * dir;
  if (typeof a === 'number') return -dir;
  if (typeof b === 'number') return dir;
  return (a as string).localeCompare(b as string) * dir;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll<HTMLTableElement>('table[data-sortable]').forEach((table) => {
    const ths = [...table.querySelectorAll<HTMLElement>('thead th')];
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const original = [...tbody.querySelectorAll<HTMLTableRowElement>('tr')];

    ths.forEach((th, colIdx) => {
      if (!th.dataset.sortKey) return;
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        const cur = th.getAttribute('aria-sort') ?? 'none';
        ths.forEach((h) => h.removeAttribute('aria-sort'));

        if (cur === 'descending') {
          original.forEach((r) => tbody.appendChild(r));
          return;
        }
        const dir: 1 | -1 = cur === 'ascending' ? -1 : 1;
        th.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
        [...original]
          .sort((a, b) => compare(cellVal(a.cells[colIdx]), cellVal(b.cells[colIdx]), dir))
          .forEach((r) => tbody.appendChild(r));
      });
    });
  });
});
