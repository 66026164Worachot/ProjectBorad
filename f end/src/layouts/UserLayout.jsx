import { Outlet } from "react-router-dom";
import AppNavbar from "../components/user/AppNavbar";

const UserLayout = () => {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <AppNavbar />
      <main className="pt-4 px-3 px-md-4">
        <Outlet />
      </main>
    </div>
  );
};

export default UserLayout;