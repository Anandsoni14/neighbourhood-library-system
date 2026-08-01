import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import FilterListOutlinedIcon from '@mui/icons-material/FilterListOutlined';
import Tooltip from '@mui/material/Tooltip';
import {
  DataGrid,
  type DataGridProps,
  ExportCsv,
  FilterPanelTrigger,
  Toolbar,
  ToolbarButton,
} from '@mui/x-data-grid';

/** Just the filter and export triggers — DataGrid's default toolbar also
 * bundles columns/density buttons and a quick-filter box this app doesn't
 * use (filtering happens per-column, not via a free-text quick search). */
function DataTableToolbar() {
  return (
    <Toolbar>
      <Tooltip title="Filters">
        <FilterPanelTrigger render={<ToolbarButton />}>
          <FilterListOutlinedIcon fontSize="small" />
        </FilterPanelTrigger>
      </Tooltip>
      <Tooltip title="Export">
        <ExportCsv render={<ToolbarButton />}>
          <DownloadOutlinedIcon fontSize="small" />
        </ExportCsv>
      </Tooltip>
    </Toolbar>
  );
}

/** The one place that configures @mui/x-data-grid defaults (server modes, page
 * sizes, toolbar); everything else passes straight through to DataGrid. */
export function DataTable(props: DataGridProps) {
  return (
    <DataGrid
      paginationMode="server"
      sortingMode="server"
      filterMode="server"
      pageSizeOptions={[10, 25, 50]}
      disableColumnMenu={false}
      density="compact"
      showToolbar
      {...props}
      slots={{ toolbar: DataTableToolbar, ...props.slots }}
    />
  );
}
