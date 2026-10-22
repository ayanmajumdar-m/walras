import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import SignIn from './components/AuthScreen/Login';
import Signup from './components/AuthScreen/Signup';
import VerifyEmail from './components/AuthScreen/VerifyEmail';
import ForgotPassword from './components/AuthScreen/ForgotPassword';
import About from './components/About/About';
import Pricing from './components/About/Pricing';
import DashboardLayout from './components/ProtectedRoutes/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoutes/PrivateRoutes';
import Cart from './components/Cart';
import Homepage from './components/Homepage';
import DedicatedServers from './components/Dedicated/DedicatedServers';
import { isMetalHost, MAIN_ORIGIN } from './data/site';
import Navbar from './components/Constants/Navbar';
import AdminLogin from './components/AdminDashboard/AdminLogin';
import AdminDashboard from './components/AdminDashboard/AdminDashboard';
// The Domains page is folded into /pricing, but its stylesheet carries
// global rules other pages (and the /domains/buy flow) still use, so it
// stays loaded in its original order.
import './components/DomainCheck.css';
import Domain from './components/ProtectedRoutes/DashboardContent/Domain';
import Footer from './components/Constants/Footer';
import Contact from './components/About/Contact';
import Privacy from './components/Privacy';
import Refund from './components/Refund';
import Terms from './components/Terms';
import FlareMail from './components/FlareMail';

// Public pages open at the top, or at the #section a link names (footer
// links, /pricing#domains…). Without this the router keeps the old scroll
// position, so a footer link opened the next page already at its bottom.
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return undefined;
    }
    // The section may render a moment after the page: try for up to 2 seconds.
    const id = decodeURIComponent(hash.slice(1));
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.getElementById(id);
      if (el || ++tries > 20) {
        clearInterval(timer);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    return () => clearInterval(timer);
  }, [pathname, hash]);
  return null;
}

// metal.walras.net is only the Dedicated catalog: any other page (reached
// in-app, without a page load the server could redirect) opens on the main site.
function MetalGuard() {
  const { pathname, search, hash } = useLocation();
  const elsewhere = isMetalHost && pathname !== '/';
  useEffect(() => {
    if (elsewhere) window.location.replace(pathname === '/dedicated' ? '/' : `${MAIN_ORIGIN}${pathname}${search}${hash}`);
  }, [elsewhere, pathname, search, hash]);
  return null;
}

function PublicLayout({ children }) {
  return (
    <>
      <ScrollManager />
      <Navbar />
      {children}
      <Footer />
    </>
  );
}

function App() {
  return (
    <Router>
      <MetalGuard />
      <Routes>
        {/* Public routes with Navbar */}
        {/* metal.walras.net opens on the Dedicated catalog (data/site.js). */}
        <Route path="/" element={<PublicLayout>{isMetalHost ? <DedicatedServers /> : <Homepage />}</PublicLayout>} />
        <Route path="/dedicated" element={<PublicLayout><DedicatedServers /></PublicLayout>} />
        <Route path="/dedicated-servers" element={<Navigate to="/dedicated" replace />} />
        <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
        <Route path="/pricing" element={<PublicLayout><Pricing /></PublicLayout>} />
        <Route path="/about/pricing" element={<Navigate to="/pricing" replace />} />
        <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
        <Route path="/domains" element={<Navigate to={{ pathname: "/pricing", hash: "#domains" }} replace />} />
        <Route path="/domains/buy" element={<PublicLayout><Domain /></PublicLayout>} />
        <Route path='/privacy' element={<PublicLayout><Privacy /></PublicLayout>} />
        <Route path='/refund' element={<PublicLayout><Refund /></PublicLayout>} />
        <Route path='/terms' element={<PublicLayout><Terms /></PublicLayout>} />
        <Route path='/flare-mail' element={<PublicLayout><FlareMail /></PublicLayout>} />

        {/* Accounts: email + password, email confirmed with a code sent via Brevo. */}
        <Route path="/login" element={<SignIn />} />
        <Route path="/register" element={<Signup />} />
        <Route path="/signup" element={<Navigate to="/register" replace />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-email-otp" element={<Navigate to="/verify-email" replace />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<Navigate to="/forgot-password" replace />} />

        {/* User Dashboard routes without Navbar */}
        <Route path="/dashboard/*" element={<DashboardLayout />} />
        {/* Cart route - protected */}
        <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
        {/* Old deploy page (old plans, hourly prices) → the Virtual Machine order form. */}
        <Route path='/deploy-details' element={<Navigate to="/dashboard/create?type=compute" replace />} />

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
