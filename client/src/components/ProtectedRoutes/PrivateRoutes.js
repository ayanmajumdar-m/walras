import React from "react";
import { Navigate, useLocation } from "react-router-dom";

const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return true;
    const now = Date.now() / 1000;
    return payload.exp < now;
  } catch (e) {
    return true;
  }
};

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const userId = localStorage.getItem("userId");
  const location = useLocation();

  // If no token or no user id, redirect to login
  if (!token || !userId) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If token exists but is expired/invalid, clear storage and redirect
  if (isTokenExpired(token)) {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.setItem('sessionExpired', 'true');
    return <Navigate to="/login" state={{ from: location, expired: true }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
