import React from "react";
import { Navigate, useLocation } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const userId = localStorage.getItem("userId");
  const location = useLocation();

  if (!token || !userId) {
    // redirect to login and preserve the attempted path so we can return after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
