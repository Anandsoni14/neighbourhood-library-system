import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import type { ReactElement } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { ROUTES } from '@/routes/paths';
import { StaffRole } from '@/types/api';

import { APP_BAR_HEIGHT, DRAWER_WIDTH } from './constants';

interface NavItem {
  label: string;
  path: string;
  icon: ReactElement;
}

// Only the routes that exist today. Feature tiers add their own entry here
// as each one lands, rather than linking to pages that don't exist yet.
const navItems: NavItem[] = [
  { label: 'Dashboard', path: ROUTES.dashboard, icon: <DashboardOutlinedIcon fontSize="small" /> },
  { label: 'Books', path: ROUTES.books, icon: <MenuBookOutlinedIcon fontSize="small" /> },
  { label: 'Categories', path: ROUTES.categories, icon: <CategoryOutlinedIcon fontSize="small" /> },
  { label: 'Members', path: ROUTES.members, icon: <PeopleOutlinedIcon fontSize="small" /> },
  { label: 'Loans', path: ROUTES.loans, icon: <SwapHorizOutlinedIcon fontSize="small" /> },
];

// Only visible to ADMIN staff — the backend enforces this regardless, but
// hiding the link avoids sending non-admins into a page that just tells them
// they can't use it.
const adminOnlyNavItems: NavItem[] = [
  { label: 'Staff', path: ROUTES.staff, icon: <BadgeOutlinedIcon fontSize="small" /> },
];

export function Sidebar() {
  const location = useLocation();
  const { staff } = useAuth();
  const items = staff?.role === StaffRole.ADMIN ? [...navItems, ...adminOnlyNavItems] : navItems;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: 'border-box' },
      }}
    >
      <Toolbar variant="dense" sx={{ minHeight: APP_BAR_HEIGHT }} />
      <List component="nav" aria-label="Main navigation">
        {items.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              component={RouterLink}
              to={item.path}
              selected={location.pathname === item.path}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
}
