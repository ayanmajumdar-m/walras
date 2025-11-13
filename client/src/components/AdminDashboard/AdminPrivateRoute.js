import React from "react";
import { Navigate } from "react-router-dom";

const AdminProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("adminToken");

  if (!token ) {
    // Redirect to admin login if token or adminId is missing
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

export default AdminProtectedRoute;
