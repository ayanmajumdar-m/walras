import React from "react";
import { Navigate } from "react-router-dom";

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

const AdminProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("adminToken");

  if (!token ) {
    // Redirect to admin login if token missing
    return <Navigate to="/admin" replace />;
  }

  if (isTokenExpired(token)) {
    localStorage.removeItem('adminToken');
    localStorage.setItem('sessionExpired', 'true');
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

export default AdminProtectedRoute;
