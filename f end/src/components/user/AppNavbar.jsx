import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Navbar,
  Nav,
  Container,
  NavDropdown,
} from "react-bootstrap";
import {
  House,
  CalendarCheck,
  UtensilsCrossed,
  Receipt,
  Settings,
  User,
  LogOut,
  Gamepad2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "../../utils/auth";
import wLogo from "../../assets/2_b.png";

const AppNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [showTopNav, setShowTopNav] = useState(true);
  const [showBottomNav, setShowBottomNav] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 991);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 991);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      if (scrollY <= 10) {
        setShowTopNav(true);
        setShowBottomNav(false);
      } else {
        setShowTopNav(false);
        setShowBottomNav(true);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { path: "/user/home", label: "Home", icon: House },
    { path: "/user/reservation", label: "Reservation", icon: CalendarCheck },
    { path: "/user/chain-reservation", label: "Sepolia Test", icon: CalendarCheck },
    { path: "/user/foodmenu", label: "Food Menu", icon: UtensilsCrossed },
    { path: "/user/slip", label: "Payment Slip", icon: Receipt },
    { path: "/user/boardgame", label: "Board Game", icon: Gamepad2 },
  ];

  const isActive = (path) => location.pathname === path;

  const primaryColor = "#f85625ff";
  const softPrimaryBg = "rgba(231, 94, 15, 0.31)";
  const defaultTextColor = "#343a40";

  const handleLogout = () => {
    auth.clearTokens();
    setExpanded(false);
    navigate("/login", { replace: true });
  };

  return (
    <>
      {/* 🔺 Top Navbar with Animation */}
      <AnimatePresence>
        {showTopNav && (
          <motion.div
            key="topnav"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{ position: "sticky", top: 0, zIndex: 1000 }}
          >
            <Navbar
              expand="lg"
              expanded={expanded}
              onToggle={setExpanded}
              bg="white"
              variant="light"
              className="shadow-sm"
              style={{ transition: "all 0.3s ease-in-out" }}
            >
              <Container>
                <Navbar.Brand
                  as={Link}
                  to="/user/home"
                  className="fw-bold text-primary d-flex align-items-center"
                  style={{ fontSize: "1.5rem" }}
                  onClick={() => setExpanded(false)}
                >
                  <motion.img
                    src={wLogo}
                    width="100"
                    height="50"
                    alt="Hotel System Logo"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="d-inline-block align-top me-3"
                  />
                </Navbar.Brand>

                <Navbar.Toggle aria-controls="basic-navbar-nav" />

                <Navbar.Collapse id="basic-navbar-nav">
                  <Nav className="ms-auto align-items-lg-center">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.path);
                      return (
                        <motion.div
                          key={item.path}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Nav.Link
                            as={Link}
                            to={item.path}
                            onClick={() => setExpanded(false)}
                            className="d-flex align-items-center gap-2 px-3 mx-lg-1"
                            style={{
                              color: active ? primaryColor : defaultTextColor,
                              fontWeight: active ? "600" : "400",
                              backgroundColor: active ? softPrimaryBg : "transparent",
                              borderRadius: "1.2rem",
                              transition: "all 0.2s ease-in-out",
                            }}
                          >
                            <Icon size={18} />
                            <span>{item.label}</span>
                          </Nav.Link>
                        </motion.div>
                      );
                    })}

                    <NavDropdown
                      title={
                        <span className="d-inline-flex align-items-center gap-2">
                          <User size={18} />
                          <span>Account</span>
                        </span>
                      }
                      id="user-dropdown"
                      align="end"
                      className="ms-lg-2"
                    >
                      <NavDropdown.Item
                        as={Link}
                        to="/user/setting"
                        onClick={() => setExpanded(false)}
                      >
                        <Settings size={16} className="me-2" />
                        Profile Settings
                      </NavDropdown.Item>

                      <NavDropdown.Divider />

                      <NavDropdown.Item
                        onClick={handleLogout}
                        className="text-danger"
                      >
                        <LogOut size={16} className="me-2" />
                        Logout
                      </NavDropdown.Item>
                    </NavDropdown>
                  </Nav>
                </Navbar.Collapse>
              </Container>
            </Navbar>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔻 Bottom Floating Navbar (Mobile) */}
      <AnimatePresence>
        {isMobile && showBottomNav && (
          <motion.div
            key="bottomnav"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ duration: 0.4 }}
            style={{
              position: "fixed",
              bottom: "5px",
              left: "0%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "linear-gradient(135deg, #f093fb 0%, #ff6b00 100%)",
              padding: "12px 24px",
              borderRadius: "50px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              zIndex: 1000,
            }}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <motion.div key={item.path} whileHover={{ scale: 1.2 }}>
                  <Link
                    to={item.path}
                    style={{
                      width: "48px",
                      height: "50px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: active ? "#cc1527ff" : "transparent",
                      color: "white",
                      opacity: active ? 1 : 0.7,
                      borderRadius: "50%",
                      textDecoration: "none",
                      transition: "all 0.3s ease",
                    }}
                  >
                    <Icon size={22} />
                  </Link>
                </motion.div>
              );
            })}

            {/* Account Button */}
            <motion.div whileTap={{ scale: 0.9 }}>
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  width: "50px",
                  height: "50px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "transparent",
                  color: "white",
                  opacity: 0.8,
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <User size={22} />
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    key="accountMenu"
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 20 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      position: "absolute",
                      bottom: "60px",
                      right: 0,
                      backgroundColor: "white",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                      padding: "8px",
                      minWidth: "180px",
                    }}
                  >
                    <Link
                      to="/user/setting"
                      onClick={() => setExpanded(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 12px",
                        color: "#343a40",
                        textDecoration: "none",
                        borderRadius: "8px",
                      }}
                    >
                      <Settings size={16} />
                      <span>Profile Settings</span>
                    </Link>
                    <hr style={{ margin: "8px 0", borderColor: "#dee2e6" }} />
                    <button
                      onClick={handleLogout}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 12px",
                        color: "#dc3545",
                        backgroundColor: "transparent",
                        border: "none",
                        borderRadius: "8px",
                        width: "100%",
                        cursor: "pointer",
                      }}
                    >
                      <LogOut size={16} />
                      <span>Logout</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AppNavbar;
