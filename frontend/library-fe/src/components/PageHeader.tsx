import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

interface PageHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Standard page title row — a heading and an optional trailing "Add X"
 * button — shared by every list page. */
export function PageHeader({ title, actionLabel, onAction }: PageHeaderProps) {
  return (
    <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography component="h2" variant="h4">
        {title}
      </Typography>
      {actionLabel && onAction && (
        <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Stack>
  );
}
