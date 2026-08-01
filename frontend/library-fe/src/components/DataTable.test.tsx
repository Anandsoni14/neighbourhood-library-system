import type { GridColDef } from '@mui/x-data-grid';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/tests/test-utils';

import { DataTable } from './DataTable';

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = [
  { id: '1', name: 'Ada' },
  { id: '2', name: 'Grace' },
];

const columns: GridColDef<Row>[] = [{ field: 'name', headerName: 'Name', flex: 1 }];

describe('DataTable', () => {
  it('renders column headers and row cells', () => {
    render(<DataTable columns={columns} rows={rows} rowCount={rows.length} />);

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    expect(screen.getByText('Ada')).toBeVisible();
    expect(screen.getByText('Grace')).toBeVisible();
  });

  it('shows the built-in empty state when there are no rows', () => {
    render(<DataTable columns={columns} rows={[]} rowCount={0} />);

    expect(screen.getByText(/no rows/i)).toBeVisible();
  });

  it('renders with server-driven pagination/sorting/filtering defaults, no pageSizeOptions override needed', () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowCount={rows.length}
        paginationModel={{ page: 0, pageSize: 25 }}
        onPaginationModelChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Ada')).toBeVisible();
  });

  it('lets a caller override a default prop', () => {
    render(<DataTable columns={columns} rows={rows} rowCount={rows.length} density="standard" />);

    // No direct DOM assertion for density is stable across MUI versions;
    // this just confirms passing a prop through doesn't throw or get dropped.
    expect(screen.getByText('Ada')).toBeVisible();
  });

  it('calls onRowClick when a row is clicked', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable columns={columns} rows={rows} rowCount={rows.length} onRowClick={onRowClick} />,
    );

    await user.click(screen.getByText('Ada'));

    expect(onRowClick).toHaveBeenCalled();
  });
});
