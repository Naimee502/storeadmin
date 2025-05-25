import { BrowserRouter } from 'react-router';
import './App.css'
import { AuthProvider } from './contexts/auth';
import AppRoutes from './routes/approutes';
import Message from './components/message';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* ✅ Show global message notifications */}
        <Message />
        {/* ✅ App routing */}
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App
