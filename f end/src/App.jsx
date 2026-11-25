import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { createTheme, ThemeProvider } from "@mui/material/styles";

import { CSSTransition, TransitionGroup } from 'react-transition-group';

// shared
import ProtectedRoute from "./components/ProtectedRoute";
import { auth } from "./utils/auth";

// layouts
import AdminLayout from "./layouts/AdminLayout.jsx";
import UserLayout from "./layouts/UserLayout.jsx";

// pages
import Login from "./pages/Login";

// admin pages
import Dashboard from "./pages/admin/Dashboard";
import Reservation from "./pages/admin/Reservation";
import FoodMenu from "./pages/admin/FoodMenu";
import Slip from "./pages/admin/Slip";
import Usersystem from "./pages/admin/Usersystem";
import Setting from "./pages/admin/Setting";
import Boardgame from "./pages/admin/Boardgame";

// user pages
import UserHome from "./pages/user/Home";
import UserReservation from "./pages/user/Reservation";
import UserFoodMenu from "./pages/user/FoodMenu";
import UserSlip from "./pages/user/Slip";
import UserSetting from "./pages/user/Setting";
import UserBoardgame from "./pages/user/Boardgame";

const theme = createTheme({
  typography: {
    fontFamily: ["Prompt", "sans-serif"].join(","),
    allVariants: {
      fontFamily: "Prompt, sans-serif",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @import url('https://fonts.googleapis.com/css2?family=Prompt:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');
        
        * {
          font-family: 'Prompt', sans-serif;
        }
      `,
    },
  },
});

function AppContent() {
  const isLoggedIn = auth.isAuthenticated();
  const role = auth.getUserInfo()?.role;

  const redirectForRole = () => {
    if (!isLoggedIn) {
      return <Navigate to="/login" replace />;
    }

    if (role === "user") {
      return <Navigate to="/user/home" replace />;
    }

    if (role === "manager" || role === "staff") {
      return <Navigate to="/admin/dashboard" replace />;
    }

    return <Navigate to="/login" replace />;
  };

  return (
    <TransitionGroup>
      <CSSTransition
        key={location.key}
        classNames="fade"
        timeout={300}
      >
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute requiredRole={["manager", "staff"]} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="reservation" element={<Reservation />} />
              <Route path="foodmenu" element={<FoodMenu />} />
              <Route path="slip" element={<Slip />} />
              <Route path="boardgame" element={<Boardgame />} />
              <Route
                path="usersystem"
                element={
                  <ProtectedRoute requiredRole={["staff", "manager"]}>
                    <Usersystem />
                  </ProtectedRoute>
                }
              />
              <Route path="setting" element={<Setting />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute requiredRole="user" />}>
            <Route path="/user" element={<UserLayout />}>
              <Route index element={<Navigate to="home" replace />} />
              <Route path="home" element={<UserHome />} />
              <Route path="reservation" element={<UserReservation />} />
              <Route path="foodmenu" element={<UserFoodMenu />} />
              <Route path="slip" element={<UserSlip />} />
              <Route path="boardgame" element={<UserBoardgame />} />
              <Route path="setting" element={<UserSetting />} />
            </Route>
          </Route>

          <Route path="/" element={redirectForRole()} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </CSSTransition>
    </TransitionGroup>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}
