import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";

const AdminLayout = () => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 959 : false
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 959px)");
    const handler = (event) => setIsMobile(event.matches);

    setIsMobile(mq.matches);
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
    } else {
      mq.addListener(handler);
    }

    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener("change", handler);
      } else {
        mq.removeListener(handler);
      }
    };
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f1f5f9" }}>
      <Sidebar />
      <main
        style={{
          flexGrow: 1,
          padding: isMobile ? "16px" : "32px",
          paddingLeft: isMobile ? "16px" : "300px",
          transition: "padding-left 0.3s ease",
        }}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
