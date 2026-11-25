import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Typography,
  Box,
  Divider,
  Tooltip,
  Badge,
  ButtonBase,
} from "@mui/material";
import { useMediaQuery } from "react-responsive";
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  Group as GroupIcon,
  CalendarMonth as CalendarMonthIcon,
  Description as DescriptionIcon,
  Settings as SettingsIcon,
  Star as StarIcon,
  PowerSettingsNew as PowerSettingsNewIcon,
  ChevronLeft as ChevronLeftIcon,
  SportsEsports as Gamepad2, 
} from "@mui/icons-material";
import { auth } from "../utils/auth";
import wLogo from "../assets/w_logo.svg";

const COLLAPSED_WIDTH = 80;
const EXPANDED_WIDTH = 260;

const Sidebar = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const isMobile = useMediaQuery({ maxWidth: 959 });

  const toggleDrawer = () => setOpen((s) => !s);

  const handleLogout = async () => {
    try {
      const refreshToken =
        typeof auth.getRefreshToken === "function" ? auth.getRefreshToken() : null;
      if (refreshToken) {
        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: refreshToken }),
          });
        } catch (e) {
          console.warn("Optional server logout failed:", e);
        }
      }
    } catch (err) {
      console.error("Logout pre-check error:", err);
    } finally {
      if (typeof auth.clearTokens === "function") auth.clearTokens();
      if (typeof auth.logout === "function") auth.logout();
      navigate("/login", { replace: true });
    }
  };

  const menuItems = [
    { text: "Dashboard", icon: <HomeIcon />, path: "/admin/dashboard" },
    { text: "Reservation", icon: <GroupIcon />, path: "/admin/reservation" },
    { text: "Board Game", icon: <Gamepad2 />, path: "/admin/boardgame" },
    { text: "Food Menu", icon: <CalendarMonthIcon />, path: "/admin/foodmenu" },
    { text: "Slip", icon: <DescriptionIcon />, path: "/admin/slip" },
    { text: "Account Management", icon: <StarIcon />, path: "/admin/usersystem" },
    { text: "Setting", icon: <SettingsIcon />, path: "/admin/setting" },
  ];

  return (
    <>
      {/* ✅ ปุ่ม Toggle แสดงเฉพาะบนมือถือ */}
      {isMobile && (
        <Box
          sx={{
            position: "fixed",
            top: 16,
            left: 16,
            zIndex: 1300,
            bgcolor: "rgba(20,45,60,0.95)",
            borderRadius: "50%",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <Tooltip title={open ? "Close menu" : "Open menu"}>
            <IconButton
              onClick={toggleDrawer}
              sx={{
                color: "white",
                "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
              }}
            >
              {open ? <ChevronLeftIcon /> : <MenuIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={open || !isMobile}
        onClose={toggleDrawer}
        ModalProps={{
          keepMounted: true,
        }}
        PaperProps={{
          elevation: 12,
          sx: {
            position: "fixed",
            left: isMobile ? 0 : 24,
            top: isMobile ? 0 : 12,
            height: isMobile ? "100vh" : "calc(100vh - 24px)",
            width: open || !isMobile ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
            boxSizing: "border-box",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: isMobile ? 0 : "8px 64px 64px 8px",
            background:
              "linear-gradient(180deg, rgba(14,34,50,1) 0%, rgba(20,45,60,1) 40%, rgba(32,58,74,1) 100%)",
            color: "rgba(255,255,255,0.95)",
            overflowX: "hidden",
            transition:
              "width 240ms ease-in-out, background 300ms, height 300ms, left 200ms",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 10px 30px rgba(2,6,23,0.6)",
            ml: 0,
            zIndex: 1200,
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            px: 2,
            py: 2,
          }}
        >
          <Avatar
            src={wLogo}
            alt="Logo"
            sx={{
              width: 156,
              height: 76,
              borderRadius: 2,
              transition: "all 200ms",
              objectFit: "contain",
            }}
          />
        </Box>

        <Divider sx={{ bgcolor: "rgba(255,255,255,0.06)" }} />

        {/* Menu */}
        <List sx={{ py: 1 }}>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding sx={{ display: "block" }}>
              <NavLink
                to={item.path}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  display: "block",
                }}
              >
                {({ isActive }) => (
                  <Tooltip title={!open && isMobile ? item.text : ""} placement="right">
                    <ListItemButton
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.75,
                        minHeight: 72,
                        px: open || !isMobile ? 3 : 1,
                        mx: 1,
                        borderRadius: 2,
                        transition: "all 180ms",
                        background: isActive
                          ? "linear-gradient(90deg, rgba(144,202,249,0.12), rgba(255,255,255,0.02))"
                          : "transparent",
                        boxShadow: isActive ? "inset 0 0 14px rgba(144,202,249,0.03)" : "none",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          background:
                            "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 0,
                          mr: 0,
                          justifyContent: "center",
                          display: "flex",
                          color: isActive ? "#90caf9" : "rgba(255,255,255,0.95)",
                          "& svg": { fontSize: 28, transition: "font-size 180ms" },
                        }}
                      >
                        <Badge
                          color="primary"
                          variant="dot"
                          invisible={!isActive}
                          sx={{ "& .MuiBadge-badge": { boxShadow: "none" } }}
                        >
                          {item.icon}
                        </Badge>
                      </ListItemIcon>

                      <ListItemText
                        primary={item.text}
                        sx={{
                          mt: 0.5,
                          textAlign: "center",
                          opacity: open || !isMobile ? 1 : 0,
                          whiteSpace: "nowrap",
                          "& .MuiListItemText-primary": {
                            fontWeight: 400,
                            fontSize: 15,
                            lineHeight: "18px",
                          },
                        }}
                      />
                    </ListItemButton>
                  </Tooltip>
                )}
              </NavLink>
            </ListItem>
          ))}
        </List>

        <Box sx={{ flexGrow: 1 }} />

        <Divider sx={{ bgcolor: "rgba(255,255,255,0.06)" }} />

        {/* Profile Section (คลิกได้ไปหน้า Setting) */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 2,
            py: 2,
          }}
        >
         
       

          <Tooltip title="Logout">
            <IconButton
              onClick={handleLogout}
              aria-label="Logout"
              sx={{
                color: "white",
                bgcolor: "rgba(255,255,255,0.04)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
              }}
            >
              <PowerSettingsNewIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {(open || !isMobile) && (
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
              v1.0 • © ProjectBoard
            </Typography>
          </Box>
        )}
      </Drawer>
    </>
  );
};

export default Sidebar;
