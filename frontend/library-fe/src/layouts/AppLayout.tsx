import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import { Outlet } from 'react-router-dom';

import { APP_BAR_HEIGHT, DRAWER_WIDTH } from './constants';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

// The shell every authenticated route renders inside: fixed header, fixed
// sidebar, and a scrollable content area sized around both. Page content
// itself comes entirely from the routed <Outlet />.
export function AppLayout() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Header />
      <Sidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: `calc(100% - ${DRAWER_WIDTH}px)`,
          bgcolor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <Toolbar variant="dense" sx={{ minHeight: APP_BAR_HEIGHT }} />
        <Box sx={{ p: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
