export function ListQueryHidden({
  perPage,
  sort,
  dir,
  perPageKey = "perPage",
  sortKey = "sort",
  dirKey = "dir",
}: {
  perPage: number;
  sort: string;
  dir: string;
  perPageKey?: string;
  sortKey?: string;
  dirKey?: string;
}) {
  return (
    <>
      <input type="hidden" name={perPageKey} value={perPage} />
      <input type="hidden" name={sortKey} value={sort} />
      <input type="hidden" name={dirKey} value={dir} />
    </>
  );
}
