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
import WebHosting from './components/WebHosting/WebHosting';
import HostingPurchase from './components/WebHosting/HostingPurchase';

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
        {/* Public routes with Navbar */}
        <Route path="/" element={<PublicLayout><Homepage /></PublicLayout>} />
        <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
        <Route path="/about/pricing" element={<PublicLayout><Pricing /></PublicLayout>} />
        <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
        <Route path="/domains/" element={<PublicLayout><DomainCheck /></PublicLayout>} />
        <Route path="/domains/buy" element={<PublicLayout><Domain /></PublicLayout>} />
        <Route path="/web-hosting" element={<PublicLayout><WebHosting /></PublicLayout>} />
        <Route path="/web-hosting/purchase" element={<PublicLayout><HostingPurchase /></PublicLayout>} />
        <Route path="/web-hosting/buy" element={<Navigate to="/web-hosting/purchase" replace />} />
        <Route path="/hosting/purchase" element={<Navigate to="/web-hosting/purchase" replace />} />
        <Route path="/purchase/hosting" element={<Navigate to="/web-hosting/purchase" replace />} />
        <Route path='/privacy' element={<PublicLayout><Privacy /></PublicLayout>} />
        <Route path='/refund' element={<PublicLayout><Refund /></PublicLayout>} />
        <Route path='/terms' element={<PublicLayout><Terms /></PublicLayout>} />
        <Route path='/bare-metal' element={<PublicLayout><BareMetal /></PublicLayout>} />
        <Route path='/flare-mail' element={<PublicLayout><FlareMail /></PublicLayout>} />

        {/* Sign-in is delegated to BUTTR ID. /login only offers the handoff;
            /auth/callback is where the backend drops the session token. */}
        <Route path="/login" element={<SignIn />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Registration, OTP verification and password reset all moved to
            BUTTR ID. Anyone holding an old bookmark lands on sign-in. */}
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/verify-email-otp" element={<Navigate to="/login" replace />} />
        <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
        <Route path="/reset-password/:token" element={<Navigate to="/login" replace />} />

        {/* User Dashboard routes without Navbar */}
        <Route path="/dashboard/*" element={<DashboardLayout />} />
        {/* Cart route - protected */}
        <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
        <Route path='/deploy-details' element={<DeployDetails />} />

        {/* Admin routes */}
        <Route path="/vadmin-1997" element={<AdminLogin />} />
        <Route path="/vadmin-1997/dashboard" element={<AdminDashboard />} />

        {/* Anything genuinely unknown goes home, not to /contact. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
