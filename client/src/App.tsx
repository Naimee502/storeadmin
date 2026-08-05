import { BrowserRouter } from 'react-router';
import './App.css'
import { AuthProvider } from './contexts/auth';
import AppRoutes from './routes/approutes';
import Message from './components/message';

// Deployed under /admin on the same domain as clientweb (which owns "/" for
// storefront links like rudra.digisysindiatech.com/rkn) instead of its own
// subdomain. Must match vite.config.ts's `base` and nginx's location block
// exactly — change all three together if this ever moves.
// Only applied in production — the dev server (npm run dev, localhost:5173)
// stays at root so local development is unaffected.
const BASE_PATH = import.meta.env.PROD ? "/admin" : "";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={BASE_PATH}>
        <Message />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App
