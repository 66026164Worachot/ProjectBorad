import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { CalendarRange, Clock3 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import boardgameAPI from "../../services/boardgameAPI";
import { menuAPI } from "../../services/menuAPI";
import { reservationAPI } from "../../services/reservationAPI";
import paymentAPI from "../../services/paymentAPI";
import settingsAPI from "../../services/settingsAPI";
import { auth } from "../../utils/auth";
import Logo from "../../assets/b_logo.svg";

// 🎬 Animation Variants
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" }
};

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.5 }
};

const scaleIn = {
  initial: { scale: 0.95, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { duration: 0.4, ease: "easeOut" }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const slideInFromLeft = {
  initial: { x: -50, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  transition: { duration: 0.5, ease: "easeOut" }
};

const slideInFromRight = {
  initial: { x: 50, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  transition: { duration: 0.5, ease: "easeOut" }
};

const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: { 
    scale: 1.03, 
    y: -8,
    transition: { duration: 0.3, ease: "easeOut" }
  }
};

const quickLinks = [
  { label: "การจองของฉัน", to: "/user/reservation" },
  { label: "เมนูอาหาร", to: "/user/foodmenu" },
  { label: "ประวัติการชำระเงิน", to: "/user/slip" },
  { label: "คลังบอร์ดเกม", to: "/user/boardgame" },
];

const formatDate = (value) => {
  if (!value) return "-";
  try {
    return format(parseISO(value), "dd MMM yyyy");
  } catch {
    return value;
  }
};

const formatTimeRange = (date, start, end) => {
  if (!date || !start || !end) return "";
  try {
    const startDate = new Date(`${date}T${start}`);
    const endDate = new Date(`${date}T${end}`);
    return `${format(startDate, "HH:mm")} - ${format(endDate, "HH:mm")}`;
  } catch {
    return `${start} - ${end}`;
  }
};

// 🎨 Motion Components
const MotionBox = motion(Box);
const MotionPaper = motion(Paper);
const MotionCard = motion(Card);
const MotionChip = motion(Chip);
const MotionStack = motion(Stack);

function Home() {
  const [profile, setProfile] = useState(null);
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [boardgames, setBoardgames] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const [profileRes, bookingsRes, gamesRes, menuRes, paymentRes] =
          await Promise.all([
            settingsAPI.getProfile(),
            reservationAPI.getMine({ upcomingOnly: true, limit: 3 }),
            boardgameAPI.getAll({ isTrending: true, limit: 6 }),
            menuAPI.getMenuItems({ isAvailable: true, limit: 6 }),
            paymentAPI.getMine({ limit: 5 }),
          ]);

        if (!isMounted) return;
        if (profileRes.data?.ok) setProfile(profileRes.data.data.user);
        if (bookingsRes.data?.ok)
          setUpcomingBookings(bookingsRes.data.data.bookings || []);
        if (gamesRes.data?.ok)
          setBoardgames(gamesRes.data.data.items || []);
        if (menuRes.data?.ok)
          setMenuItems(menuRes.data.data.items || []);
        if (paymentRes.data?.ok)
          setPayments(paymentRes.data.data.payments || []);
      } catch (err) {
        console.error("Load failed", err);
        setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  const greeting = useMemo(() => {
    if (profile?.full_name) return `ยินดีต้อนรับกลับมา, ${profile.full_name}`;
    const userInfo = auth.getUserInfo();
    return userInfo?.email
      ? `ยินดีต้อนรับกลับมา, ${userInfo.email}`
      : "ยินดีต้อนรับสู่ BOARD CELL";
  }, [profile]);

  return (
    <MotionBox
      initial="initial"
      animate="animate"
      sx={{
        background: "#ff6a000f",
        minHeight: "100vh",
        borderRadius: "1.2rem",
        py: { xs: 3, sm: 4, md: 6 },
        position: "relative",
        boxShadow: "0 18px 5px rgba(56, 53, 51, 0.39), inset 0 -2px 8px rgba(0,0,0,0.05)",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at 20% 50%, rgba(255,255,255,0.08) 0%, transparent 50%)`,
          pointerEvents: "none",
          borderRadius: "inherit",
          boxShadow: "inset 0 2px 4px rgba(255,255,255,0.1)",
        },
      }}
    >
      <Container sx={{ position: "relative", zIndex: 1 }}>
        {/* Header with Animation */}
        <MotionStack 
          alignItems="center" 
          mb={5}
          variants={fadeInUp}
        >
          <motion.img 
            src={Logo} 
            alt="BOARD CELL" 
            style={{ width: 160, marginBottom: 8 }}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          <motion.div variants={fadeInUp}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: "#0f172a",
                mb: 1,
                textAlign: "center",
                fontSize: { xs: "1.4rem", md: "2rem" },
                textShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }}
            >
              {greeting}
            </Typography>
          </motion.div>
          <motion.div variants={fadeInUp}>
            <Typography
              variant="body1"
              sx={{
                color: "rgba(0, 0, 0, 0.9)",
                textAlign: "center",
                maxWidth: 600,
              }}
            >
              ตรวจสอบการจองล่าสุด สถานะการชำระเงิน และเกมยอดนิยมได้ในหน้าเดียว
            </Typography>
          </motion.div>
        </MotionStack>

        {/* Quick Links with Stagger Animation */}
        <MotionStack 
          direction="row" 
          flexWrap="wrap" 
          justifyContent="center" 
          mb={4} 
          spacing={1.5}
          variants={staggerContainer}
        >
          {quickLinks.map((item, index) => (
            <MotionChip
              key={item.label}
              label={item.label}
              component={Link}
              to={item.to}
              clickable
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              sx={{
                bgcolor: "#ff6b00",
                color: "white",
                fontWeight: 600,
                border: "1px solid rgba(255,255,255,0.3)",
                "&:hover": {
                  bgcolor: "rgba(255,107,0,0.9)",
                },
                transition: "all 0.2s",
              }}
            />
          ))}
        </MotionStack>

        {error && (
          <motion.div {...fadeIn}>
            <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>
              {error}
            </Alert>
          </motion.div>
        )}

        <Grid container spacing={4}>
          {/* Bookings with Slide In Left */}
          <Grid item xs={12} md={6}>
            <MotionPaper
              variants={slideInFromLeft}
              sx={{
                p: 3,
                borderRadius: 4,
                bgcolor: "rgba(255,255,255,0.9)",
                backdropFilter: "blur(10px)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                >
                  <Avatar sx={{ bgcolor: "#ffe6e9", color: "#f5576c" }}>
                    <CalendarRange size={20} />
                  </Avatar>
                </motion.div>
                <Typography variant="h6" fontWeight={700} color="#0f172a">
                  การจองครั้งถัดไปของคุณ
                </Typography>
              </Stack>

              {loading ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <CircularProgress size={24} />
                </Box>
              ) : upcomingBookings.length === 0 ? (
                <Typography color="#64748b">ยังไม่มีการจองที่กำลังจะมาถึง</Typography>
              ) : (
                <MotionStack spacing={2} variants={staggerContainer}>
                  {upcomingBookings.map((b, index) => (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, x: 4 }}
                    >
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: "#fff7f8",
                          border: "1px solid rgba(245,87,108,0.2)",
                        }}
                      >
                        <Typography fontWeight={700} color="#f5576c">
                          {formatDate(b.booking_date)}
                        </Typography>
                        <Typography variant="body2" color="#475569">
                          {formatTimeRange(b.booking_date, b.start_time, b.end_time)}
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="body2" color="#475569">
                          โต๊ะ {b.table?.table_number || "-"} · {b.table?.category?.name || "ไม่ระบุ"} ·{" "}
                          {b.number_of_people || "?"} คน
                        </Typography>
                      </Box>
                    </motion.div>
                  ))}
                </MotionStack>
              )}
            </MotionPaper>
          </Grid>

          {/* Payments with Slide In Right */}
          <Grid item xs={12} md={6}>
            <MotionPaper
              variants={slideInFromRight}
              sx={{
                p: 3,
                borderRadius: 4,
                bgcolor: "rgba(255,255,255,0.9)",
                backdropFilter: "blur(10px)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                >
                  <Avatar sx={{ bgcolor: "#ffe6e9", color: "#ff6b00" }}>
                    <Clock3 size={20} />
                  </Avatar>
                </motion.div>
                <Typography variant="h6" fontWeight={700} color="#0f172a">
                  ประวัติการชำระเงินล่าสุด
                </Typography>
              </Stack>

              {loading ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <CircularProgress size={24} />
                </Box>
              ) : payments.length === 0 ? (
                <Typography color="#64748b">ยังไม่มีประวัติการชำระเงิน</Typography>
              ) : (
                <MotionStack variants={staggerContainer}>
                  {payments.map((p, index) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, x: -4 }}
                    >
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: "#fff7f8",
                          mb: 1,
                          border: "1px solid rgba(245,87,108,0.2)",
                        }}
                      >
                        <Typography fontWeight={600}>
                          {p.payment_type === "deposit"
                            ? "ชำระมัดจำ"
                            : p.payment_type === "remaining"
                              ? "ชำระส่วนที่เหลือ"
                              : "ชำระเต็มจำนวน"}
                        </Typography>
                        <Typography color="#f5576c" fontWeight={600}>
                          ฿{Number(p.amount).toLocaleString()}
                        </Typography>
                      </Stack>
                    </motion.div>
                  ))}
                </MotionStack>
              )}

              <Box textAlign="right" mt={2}>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    component={Link}
                    to="/user/slip"
                    sx={{
                      background: "linear-gradient(135deg, #f093fb 0%, #ff6b00 100%)",
                      color: "#fff",
                      textTransform: "none",
                      fontWeight: 600,
                      borderRadius: 2,
                      boxShadow: "0 4px 12px rgba(245,87,108,0.3)",
                      "&:hover": {
                        background: "linear-gradient(135deg, #e082ea 0%, #ff6b00 100%)",
                        boxShadow: "0 6px 16px rgba(245,87,108,0.4)",
                      },
                    }}
                  >
                    จัดการสลิป
                  </Button>
                </motion.div>
              </Box>
            </MotionPaper>
          </Grid>
        </Grid>

        {/* Trending Games with Animation */}
        <MotionBox mt={6} variants={fadeInUp}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Typography variant="h5" fontWeight={700} color="#1E293B">
                🎲 เกมยอดนิยม
              </Typography>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              whileHover={{ scale: 1.05 }}
            >
              <Button
                component={Link}
                to="/user/boardgame"
                size="small"
                sx={{
                  color: "#FF6B00",
                  textTransform: "none",
                  display: { xs: "none", sm: "inline-flex" }
                }}
              >
                ดูทั้งหมด →
              </Button>
            </motion.div>
          </Stack>

          {loading && boardgames.length === 0 ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Box
              component="section"
              aria-label="Trending boardgames"
              sx={{
                display: "flex",
                gap: { xs: 2, sm: 3 },
                overflowX: "auto",
                pb: 2,
                pl: { xs: 1.5, sm: 0 },
                pr: { xs: 1.5, sm: 0 },
                scrollSnapType: "x mandatory",
                WebkitOverflowScrolling: "touch",
                "& > *": { scrollSnapAlign: "center" },
                "&::-webkit-scrollbar": { height: 8 },
                "&::-webkit-scrollbar-track": {
                  bgcolor: "rgba(255,107,0,0.05)",
                  borderRadius: 4,
                },
                "&::-webkit-scrollbar-thumb": {
                  bgcolor: "rgba(255,107,0,0.3)",
                  borderRadius: 4,
                  "&:hover": { bgcolor: "rgba(255,107,0,0.5)" },
                },
              }}
            >
              {boardgames.map((g, index) => (
                <MotionCard
                  key={g.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  variants={cardHover}
                  initial="rest"
                  whileHover="hover"
                  sx={{
                    minWidth: { xs: 220, sm: 260, md: 300 },
                    maxWidth: { xs: 220, sm: 280, md: 300 },
                    borderRadius: 3,
                    boxShadow: "0 8px 24px rgba(255,107,0,0.08)",
                    bgcolor: "#fff",
                    border: "1px solid rgba(255,107,0,0.1)",
                    flexShrink: 0,
                    scrollSnapAlign: "center",
                  }}
                >
                  {g.image_url && (
                    <CardMedia
                      component="img"
                      height="180"
                      image={g.image_url}
                      alt={g.name}
                      sx={{ objectFit: "cover" }}
                    />
                  )}
                  <CardContent>
                    <Typography fontWeight={700} variant="h6" noWrap>
                      {g.name}
                    </Typography>
                    <Typography variant="body2" color="#475569" mt={0.5}>
                      ผู้เล่น {g.min_players || "?"} - {g.max_players || "?"} · {g.duration_minutes || "?"} นาที
                    </Typography>
                  </CardContent>
                </MotionCard>
              ))}
            </Box>
          )}

          <Box textAlign="center" mt={2} display={{ xs: "block", sm: "none" }}>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                component={Link}
                to="/user/boardgame"
                size="small"
                sx={{
                  color: "#FF6B00",
                  textTransform: "none",
                }}
              >
                ดูทั้งหมด →
              </Button>
            </motion.div>
          </Box>
        </MotionBox>

        {/* Available Menu with Animation */}
        <MotionBox mt={6} variants={fadeInUp}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Typography variant="h5" fontWeight={700} color="#1E293B">
                🍜 เมนูที่พร้อมเสิร์ฟ
              </Typography>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              whileHover={{ scale: 1.05 }}
            >
              <Button
                component={Link}
                to="/user/foodmenu"
                size="small"
                sx={{
                  color: "#FF6B00",
                  textTransform: "none",
                  display: { xs: "none", sm: "inline-flex" }
                }}
              >
                ดูทั้งหมด →
              </Button>
            </motion.div>
          </Stack>

          {loading && menuItems.length === 0 ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Box
              component="section"
              aria-label="Available menu"
              sx={{
                display: "flex",
                gap: { xs: 2, sm: 3 },
                overflowX: "auto",
                pb: 2,
                pl: { xs: 1.5, sm: 0 },
                pr: { xs: 1.5, sm: 0 },
                scrollSnapType: "x mandatory",
                WebkitOverflowScrolling: "touch",
                "& > *": { scrollSnapAlign: "center" },
                "&::-webkit-scrollbar": { height: 8 },
                "&::-webkit-scrollbar-track": {
                  bgcolor: "rgba(255,107,0,0.05)",
                  borderRadius: 4,
                },
                "&::-webkit-scrollbar-thumb": {
                  bgcolor: "rgba(255,107,0,0.3)",
                  borderRadius: 4,
                  "&:hover": { bgcolor: "rgba(255,107,0,0.5)" },
                },
              }}
            >
              {menuItems.map((item, index) => (
                <MotionCard
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  variants={cardHover}
                  initial="rest"
                  whileHover="hover"
                  sx={{
                    minWidth: { xs: 220, sm: 260, md: 300 },
                    maxWidth: { xs: 220, sm: 280, md: 300 },
                    borderRadius: 3,
                    boxShadow: "0 8px 24px rgba(255,107,0,0.08)",
                    bgcolor: "#fff",
                    border: "1px solid rgba(255,107,0,0.1)",
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    scrollSnapAlign: "center",
                  }}
                >
                  {item.image_url && (
                    <CardMedia
                      component="img"
                      height="180"
                      image={item.image_url}
                      alt={item.name}
                      sx={{ objectFit: "cover" }}
                    />
                  )}
                  <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
                    <Typography fontWeight={700} variant="h6" noWrap>
                      {item.name}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="#64748b"
                      my={0.5}
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        minHeight: "2.5em",
                      }}
                    >
                      {item.description || "ไม่มีคำอธิบาย"}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" mt="auto" pt={1.5}>
                      <Chip
                        size="small"
                        label={item.category?.name || "ทั่วไป"}
                        sx={{ textTransform: "capitalize", bgcolor: "#FFF2E8", color: "#C25A00" }}
                      />
                      <Typography variant="body1" fontWeight={700} color="#FF6B00">
                        ฿{Number(item.price || 0).toLocaleString()}
                      </Typography>
                    </Stack>
                  </CardContent>
                </MotionCard>
              ))}
            </Box>
          )}

          <Box textAlign="center" mt={2} display={{ xs: "block", sm: "none" }}>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                component={Link}
                to="/user/foodmenu"
                size="small"
                sx={{
                  color: "#FF6B00",
                  textTransform: "none",
                }}
              >
                ดูทั้งหมด →
              </Button>
            </motion.div>
          </Box>
        </MotionBox>
      </Container>
    </MotionBox>
  );
}

export default Home;