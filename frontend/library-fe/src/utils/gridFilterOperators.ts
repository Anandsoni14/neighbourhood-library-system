import {
  type GridFilterModel,
  getGridSingleSelectOperators,
  getGridStringOperators,
} from '@mui/x-data-grid';

export const containsOnlyOperators = getGridStringOperators().filter(
  (operator) => operator.value === 'contains',
);
export const equalsOnlyOperators = getGridSingleSelectOperators().filter(
  (operator) => operator.value === 'is',
);

/** Extracts committed (non-empty) filter values from a DataGrid filter model,
 * for driving a fetch/URL. */
export function filtersFromFilterModel<Filters extends Record<string, string>>(
  model: GridFilterModel,
  emptyFilters: Filters,
): Filters {
  const next = { ...emptyFilters };
  for (const item of model.items) {
    if (item.value !== undefined && item.value !== '') {
      next[item.field as keyof Filters] = String(item.value) as Filters[keyof Filters];
    }
  }
  return next;
}
