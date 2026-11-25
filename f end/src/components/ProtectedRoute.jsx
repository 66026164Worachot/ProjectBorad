// components/ProtectedRoute.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { Container, Alert } from 'react-bootstrap';
import { auth } from '../utils/auth';

function ProtectedRoute({ children, requiredRole = null }) {
  // 1. เช็คว่า login หรือยัง
  if (!auth.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // 2. ถ้ามีการกำหนด role ที่ต้องการ ให้เช็ค role
  if (requiredRole) {
    const user = auth.getUserInfo();
    const userRole = user?.role;

    // รองรับทั้ง array ['staff', 'manager'] และ string 'staff'
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

    // ถ้า role ไม่ตรง → แสดงหน้า Access Denied
    if (!allowedRoles.includes(userRole)) {
      return (
        <Container className="py-5">
          <Alert variant="danger">
            <Alert.Heading>🚫 Access Denied</Alert.Heading>
            <p>You don't have permission to access this page.</p>
            <hr />
            <p className="mb-0">
              <strong>Required:</strong> {allowedRoles.join(' or ')} <br />
              <strong>Your role:</strong> {userRole || 'unknown'}
            </p>
          </Alert>
        </Container>
      );
    }
  }

  // 3. ผ่านทุก check → แสดงหน้าปกติ
  if (children) {
    return children;
  }

  return <Outlet />;
}

export default ProtectedRoute;
