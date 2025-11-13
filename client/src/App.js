import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import Login from './components/AuthScreen/Login';
import Signup from './components/AuthScreen/Signup';
import About from './components/About/About';
import Pricing from './components/About/Pricing';
import DashboardLayout from './components/ProtectedRoutes/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoutes/PrivateRoutes';
import Cart from './components/Cart';
import Homepage from './components/Homepage';
import Navbar from './components/Constants/Navbar';
import VerifyEmailPhoneOtp from './components/AuthScreen/VerifyEmailPhoneOtp';
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
        <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
        <Route path="/register" element={<PublicLayout><Signup /></PublicLayout>} />
        <Route path="/domains/" element={<PublicLayout><DomainCheck /></PublicLayout>} />
        <Route path="/verify-email-otp" element={<PublicLayout><VerifyEmailPhoneOtp /></PublicLayout>} />
        <Route path="/forgot-password" element={<PublicLayout><ForgotPassword /></PublicLayout>} />
        <Route path="/reset-password/:token" element={<PublicLayout><ResetPassword /></PublicLayout>} />
        <Route path='/privacy' element={<PublicLayout><Privacy /></PublicLayout>} />
        <Route path='/refund' element={<PublicLayout><Refund /></PublicLayout>} />
        <Route path='/terms' element={<PublicLayout><Terms /></PublicLayout>} />
        <Route path='/bare-metal' element={<PublicLayout><BareMetal /></PublicLayout>} />

        {/* User Dashboard routes without Navbar */}
        <Route path="/dashboard/*" element={<DashboardLayout />} />
        {/* Cart route - protected */}
        <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
        <Route path='/deploy-details' element={<DeployDetails />} />
        <Route path="/domains/buy" element={<PublicLayout><Domain /></PublicLayout>} />

        {/* Admin routes */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
