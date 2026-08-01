import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import type { GridColDef } from '@mui/x-data-grid';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/tests/test-utils';

import { DataTable } from './DataTable';
import { DataTableActionButton } from './DataTableActionButton';

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = [{ id: '1', name: 'Ada' }];

// GridActionsCellItem requires a DataGrid ancestor (it reads grid context),
// so the button is exercised through a real DataTable rather than in isolation.
function renderActionButton(onClick: () => void) {
  const columns: GridColDef<Row>[] = [
    { field: 'name', headerName: 'Name', flex: 1 },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      getActions: () => [
        <DataTableActionButton
          key="edit"
          label="Edit"
          icon={<EditOutlinedIcon fontSize="small" />}
          onClick={onClick}
        />,
      ],
    },
  ];

  return render(<DataTable columns={columns} rows={rows} rowCount={rows.length} />);
}

describe('DataTableActionButton', () => {
  it('renders an accessible button named after the label', () => {
    renderActionButton(vi.fn());

    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
  });

  it('shows the label as a tooltip on hover', async () => {
    const user = userEvent.setup();
    renderActionButton(vi.fn());

    await user.hover(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(await screen.findByRole('tooltip', { name: 'Edit' })).toBeVisible();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderActionButton(onClick);

    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
