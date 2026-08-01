import Tooltip from '@mui/material/Tooltip';
import { GridActionsCellItem } from '@mui/x-data-grid';
import type { ReactElement } from 'react';

interface DataTableActionButtonProps {
  label: string;
  icon: ReactElement;
  onClick: () => void;
}

/** A DataGrid row action rendered as an icon button with a matching tooltip.
 * Tooltip overwrites the child's aria-label with its own `title`, so both
 * are driven from the same `label` to keep the button properly named. */
export function DataTableActionButton({ label, icon, onClick }: DataTableActionButtonProps) {
  return (
    <Tooltip title={label}>
      <GridActionsCellItem icon={icon} label={label} onClick={onClick} showInMenu={false} />
    </Tooltip>
  );
}
