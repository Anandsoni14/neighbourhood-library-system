import LogoutIcon from '@mui/icons-material/Logout';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { ROUTES } from '@/routes/paths';

export function Header() {
  const { staff, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    void navigate(ROUTES.login, { replace: true });
  };

  return (
    <AppBar
      position="fixed"
      sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, backgroundColor: 'background.paper' }}
    >
      <Toolbar variant="dense" sx={{ gap: 2 }}>
        <Typography variant="h6" component="h1" sx={{ flexGrow: 1, color: '#000000' }}>
          Neighbour Library
        </Typography>
        {staff && (
          <>
            <Typography variant="body2" color="text.secondary">
              {staff.first_name} {staff.last_name}
            </Typography>
            <Chip label={staff.role} size="small" variant="outlined" />
          </>
        )}
        <Box>
          <Tooltip title="Log out">
            <IconButton onClick={handleLogout} size="small" aria-label="Log out">
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
