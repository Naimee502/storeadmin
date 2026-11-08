import { BrowserRouter } from 'react-router';
import './App.css'
import { AuthProvider } from './contexts/auth';
import AppRoutes from './routes/approutes';
import Message from './components/message';
import ScreenWatermark from './components/screenwatermark';

// Served under /admin in production; must match vite.config.ts `base` and nginx.
const BASE_PATH = import.meta.env.PROD ? "/admin" : "";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={BASE_PATH}>
        <Message />
        <AppRoutes />
        {/* Last child so it paints over modals; renders only when screen capture protection is on. */}
        <ScreenWatermark />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App
