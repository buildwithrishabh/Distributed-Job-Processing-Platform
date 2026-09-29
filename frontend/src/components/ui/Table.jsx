import { Icons } from "./Icons.jsx";

/**
 * DataTable.
 *
 * A thin declarative wrapper rather than a full table abstraction: columns
 * declare their own header/cell, and the table owns only what every job list
 * needs — sticky headers, row click handling, keyboard activation, and an
 * empty state.
 *
 * @param {object} props
 * @param {Array<{key:string,label:string,align?:'left'|'right'|'center',width?:string,sortable?:boolean,render:(row:any)=>React.ReactNode}>} props.columns
 * @param {Array<any>} props.rows
 * @param {(row:any)=>void} [props.onRowClick]
 * @param {any} [props.selectedId]
 * @param {string} [props.idKey]
 */
export function DataTable({
  columns,
  rows,
  onRowClick,
  selectedId,
  idKey = "jobId",
  empty,
  loading = false,
  skeletonRows = 6,
}) {
  if (loading) {
    return (
      <div className="table-wrap">
        <div className="skeleton-table" aria-busy="true">
          {Array.from({ length: skeletonRows }, (_, rowIndex) => (
            <div className="skeleton-table__row" key={rowIndex}>
              {columns.map((column) => (
                <span
                  key={column.key}
                  className="skeleton"
                  style={{ display: "block", height: 12, flex: 1 }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!rows?.length) {
    return empty ?? null;
  }

  const isInteractive = Boolean(onRowClick);

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{ width: column.width, textAlign: column.align ?? "left" }}
                scope="col"
              >
                {column.sortable ? (
                  <button type="button" className="table__sort">
                    {column.label}
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const id = row?.[idKey] ?? index;
            const selected = selectedId != null && id === selectedId;
            return (
              <tr
                key={id}
                data-clickable={isInteractive ? "true" : undefined}
                data-selected={selected ? "true" : undefined}
                tabIndex={isInteractive ? 0 : undefined}
                onClick={isInteractive ? () => onRowClick(row) : undefined}
                onKeyDown={
                  isInteractive
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={{ textAlign: column.align ?? "left" }}
                    className={column.mono ? "table__num" : undefined}
                  >
                    {column.render(row, index)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, totalPages, total, limit, onPageChange, disabled = false }) {
  if (!totalPages || totalPages <= 1) {
    return total ? (
      <div className="pager">
        <span className="pager__position">
          {total} {total === 1 ? "result" : "results"}
        </span>
      </div>
    ) : null;
  }

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="pager">
      <span className="pager__position">
        {from}–{to} of {total}
      </span>
      <div className="pager__controls">
        <button
          type="button"
          className="btn btn--secondary btn--sm btn--icon"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page <= 1}
          aria-label="Previous page"
        >
          <Icons.chevronLeft size={15} />
        </button>
        <span className="pager__position">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="btn btn--secondary btn--sm btn--icon"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page >= totalPages}
          aria-label="Next page"
        >
          <Icons.chevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
