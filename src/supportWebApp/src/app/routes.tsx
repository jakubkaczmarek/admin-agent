import { createBrowserRouter } from 'react-router';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TicketDetail from './pages/TicketDetail';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Landing,
  },
  {
    path: '/login',
    Component: Login,
  },
  {
    path: '/dashboard',
    Component: Dashboard,
  },
  {
    path: '/ticket/:id',
    Component: TicketDetail,
  },
]);
