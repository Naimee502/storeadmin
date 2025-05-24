import { BrowserRouter } from 'react-router';
import './App.css'
import { AuthProvider } from './contexts/auth';
import AppRoutes from './routes/approutes';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App
