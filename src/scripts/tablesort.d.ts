declare module 'tablesort' {
  interface TablesortOptions {
    descending?: boolean;
  }
  interface TablesortConstructor {
    new (el: HTMLTableElement, options?: TablesortOptions): void;
    extend(
      name: string,
      pattern: (item: string) => boolean,
      sort: (a: string, b: string) => number,
    ): void;
  }
  const Tablesort: TablesortConstructor;
  export default Tablesort;
}
