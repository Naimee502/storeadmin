import { BrowserRouter } from 'react-router';
import './App.css'
import { AuthProvider } from './contexts/auth';
import AppRoutes from './routes/approutes';
import Message from './components/message';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Message />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App
