import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import SignIn from './components/AuthScreen/Login';
import AuthCallback from './components/AuthScreen/AuthCallback';
import About from './components/About/About';
import Pricing from './components/About/Pricing';
import DashboardLayout from './components/ProtectedRoutes/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoutes/PrivateRoutes';
import Cart from './components/Cart';
import Homepage from './components/Homepage';
import Navbar from './components/Constants/Navbar';
import AdminLogin from './components/AdminDashboard/AdminLogin';
import AdminDashboard from './components/AdminDashboard/AdminDashboard';
import DeployDetails from './components/ProtectedRoutes/DashboardContent/DeployDetails';
import DomainCheck from './components/DomainCheck';
import Domain from './components/ProtectedRoutes/DashboardContent/Domain';
import Footer from './components/Constants/Footer';
import Contact from './components/About/Contact';
import Privacy from './components/Privacy';
import Refund from './components/Refund';
import Terms from './components/Terms';
import BareMetal from './components/BareMetal';
import FlareMail from './components/FlareMail';

function PublicLayout({ children }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Sign-in is delegated to BUTTR ID. /login only offers the handoff;
            /auth/callback is where the backend drops the session token. */}
        <Route path="/login" element={<PublicLayout><SignIn /></PublicLayout>} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Registration, OTP verification and password reset all moved to
            BUTTR ID. Anyone holding an old bookmark lands on sign-in. */}
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/verify-email-otp" element={<Navigate to="/login" replace />} />
        <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
        <Route path="/reset-password/:token" element={<Navigate to="/login" replace />} />

        {/* Only expose contact page; redirect everything else to /contact */}
        <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
        <Route path="*" element={<Navigate to="/contact" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
