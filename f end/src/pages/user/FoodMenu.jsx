import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Grid,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
  Container as MuiContainer,
} from "@mui/material";
import { Search, UtensilsCrossed, ChefHat, Sparkles, AlertCircle } from "lucide-react";
import { menuAPI } from "../../services/menuAPI";

const formatCurrency = (value) =>
  `฿${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const MotionPaper = motion(Paper);
const MotionBox = motion(Box);
const MotionGrid = motion(Grid);
const MotionCard = motion(Card);
const MotionChip = motion(Chip);
const MotionAlert = motion(Alert);

const gridContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const gridItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

function FoodMenu() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadCategories = async () => {
      try {
        const response = await menuAPI.getCategories(true);
        if (isMounted && response.data?.ok) {
          setCategories([{ id: "all", name: "ทั้งหมด" }, ...(response.data.data || [])]);
        }
      } catch (err) {
        console.error("Failed to load categories", err);
        if (isMounted) {
          setCategories([{ id: "all", name: "ทั้งหมด" }]);
        }
      }
    };

    loadCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchItems = async (category = selectedCategory, keyword = searchTerm) => {
    setFetching(true);
    setError("");

    try {
      const params = {
        page: 1,
        limit: 24,
        isAvailable: true,
      };

      if (category && category !== "all") params.categoryId = category;
      if (keyword) params.search = keyword;

      const response = await menuAPI.getMenuItems(params);
      if (response.data?.ok) {
        setItems(response.data.data.items || []);
      }
    } catch (err) {
      console.error("Failed to load menu items", err);
      const message = err.response?.data?.error?.message;
      setError(message || "ไม่สามารถโหลดข้อมูลเมนูได้");
    } finally {
      setLoading(false);
      setFetching(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    fetchItems("all", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
    fetchItems(categoryId, searchTerm);
  };

  const handleSearch = (event) => {
    event?.preventDefault();
    fetchItems(selectedCategory, searchTerm);
  };

  const displayedCategory = useMemo(() => {
    if (selectedCategory === "all") return "เมนูทั้งหมด";
    const category = categories.find((cat) => cat.id === selectedCategory);
    return category ? category.name : "เมนู";
  }, [categories, selectedCategory]);

  return (
    <Box
      sx={{
        background: "#ff6a000f",
        minHeight: "100vh",
        borderRadius: "1.2rem",
        py: { xs: 3, sm: 4, md: 6 },
        position: "relative",
        boxShadow:
          "0 18px 5px rgba(56, 53, 51, 0.39), inset 0 -2px 8px rgba(0,0,0,0.05)",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 20% 50%, rgba(255,255,255,0.08) 0%, transparent 50%)`,
          pointerEvents: "none",
          borderRadius: "inherit",
          boxShadow: "inset 0 2px 4px rgba(255,255,255,0.1)",
        },
      }}
    >
      <MuiContainer maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
        {/* Hero Header */}
        <MotionPaper
          elevation={8}
          sx={{
            p: { xs: 3, sm: 4, md: 5 },
            borderRadius: { xs: 3, sm: 4 },
            mb: 4,
            background: "white",
            position: "relative",
            overflow: "hidden",
          }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(140deg, rgba(175, 175, 175, 0.1) 0%, rgba(245,87,108,0.1) 100%)",
              zIndex: 0,
            }}
          />
          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={{ xs: 3, md: 4 }}
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Box flex={1}>
                <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                  <ChefHat size={24} color="#f5576c" />
                  <Typography
                    variant="overline"
                    sx={{
                      color: "#f5576c",
                      letterSpacing: 3,
                      fontWeight: 700,
                      fontSize: { xs: "0.75rem", sm: "0.875rem" },
                    }}
                  >
                    BOARD GAME CAFE MENU
                  </Typography>
                </Stack>

                <Typography
                  variant="h3"
                  fontWeight={800}
                  color="#0f172a"
                  mb={2}
                  sx={{ fontSize: { xs: "1.75rem", sm: "2.5rem", md: "3rem" } }}
                >
                  เลือกเมนูคู่กับค่ำคืน
                  <br />
                  แห่งบอร์ดเกม
                </Typography>

                <Typography
                  variant="body1"
                  color="#475569"
                  sx={{
                    fontSize: { xs: "0.875rem", sm: "1rem" },
                    lineHeight: 1.7,
                  }}
                >
                  เมนูทั้งหมดอัปเดตแบบเรียลไทม์จากระบบหลังบ้าน พร้อมเสิร์ฟทุกคำสั่ง
                </Typography>
              </Box>

              {/* Search Box */}
              <Box sx={{ width: { xs: "100%", md: "400px" }, flexShrink: 0 }}>
                <Box
                  component="form"
                  onSubmit={handleSearch}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    background:
                      "linear-gradient(135deg, rgba(240,147,251,0.1) 0%, rgba(245,87,108,0.1) 100%)",
                    border: "2px solid rgba(245,87,108,0.2)",
                  }}
                >
                  <Stack spacing={1} mb={2}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Search size={18} color="#f5576c" />
                      <Typography variant="subtitle2" fontWeight={700} color="#0f172a">
                        ค้นหาเมนู
                      </Typography>
                    </Stack>
                  </Stack>

                  <TextField
                    fullWidth
                    placeholder="ชื่อเมนูหรือเครื่องดื่ม..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    size="small"
                    sx={{
                      mb: 1.5,
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        bgcolor: "white",
                        "&:hover fieldset": { borderColor: "#f5576c" },
                        "&.Mui-focused fieldset": { borderColor: "#f5576c" },
                      },
                    }}
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    startIcon={<Search size={18} />}
                    sx={{
                      textTransform: "none",
                      borderRadius: 2,
                      fontWeight: 600,
                      background:
                        "linear-gradient(135deg, #f093fb 0%, #ff6b00 100%)",
                      boxShadow: "0 4px 15px rgba(245,87,108,0.3)",
                      "&:hover": {
                        background:
                          "linear-gradient(135deg, #e082ea 0%, #ff6b00 100%)",
                        boxShadow: "0 6px 20px rgba(245,87,108,0.4)",
                      },
                    }}
                  >
                    ค้นหา
                  </Button>
                </Box>
              </Box>
            </Stack>
          </Box>
        </MotionPaper>

        {/* Category Chips */}
        <MotionPaper
          elevation={3}
          sx={{
            p: { xs: 2, sm: 3 },
            borderRadius: 3,
            mb: 4,
            background: "white",
          }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        >
          <Stack direction="row" spacing={1} alignItems="center" mb={2}>
            <Sparkles size={18} color="#f5576c" />
            <Typography variant="subtitle2" fontWeight={700} color="#0f172a">
              หมวดหมู่
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            {categories.map((category) => (
              <MotionChip
                key={category.id}
                label={category.name}
                onClick={() => handleCategoryChange(category.id)}
                sx={{
                  textTransform: "capitalize",
                  fontWeight: 600,
                  borderRadius: 2,
                  ...(selectedCategory === category.id
                    ? {
                        background:
                          "linear-gradient(135deg, #f093fb 0%, #ff6b00 100%)",
                        color: "white",
                        boxShadow: "0 4px 12px rgba(245,87,108,0.3)",
                      }
                    : {
                        bgcolor: "#f8fafc",
                        color: "#475569",
                        border: "1px solid #e2e8f0",
                        "&:hover": { bgcolor: "#f1f5f9" },
                      }),
                }}
                whileHover={{
                  y: -2,
                  boxShadow:
                    selectedCategory === category.id
                      ? "0 6px 16px rgba(245,87,108,0.4)"
                      : "0 4px 8px rgba(0,0,0,0.1)",
                }}
                whileTap={{ scale: 0.95 }}
              />
            ))}
          </Stack>
        </MotionPaper>

        {/* AnimatePresence */}
        <AnimatePresence mode="wait">
          {error && (
            <MotionAlert
              key="error"
              severity="error"
              icon={<AlertCircle size={20} />}
              sx={{
                mb: 3,
                borderRadius: 3,
                border: "1px solid #fecaca",
              }}
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {error}
            </MotionAlert>
          )}

          {loading ? (
            <MotionBox
              key="loading"
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                py: 8,
              }}
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <CircularProgress size={48} sx={{ color: "#f5576c", mb: 2 }} />
              <Typography variant="body1" color="#f5576c" fontWeight={600}>
                กำลังโหลดเมนู...
              </Typography>
            </MotionBox>
          ) : items.length === 0 ? (
            <MotionPaper
              key="empty"
              elevation={3}
              sx={{
                p: { xs: 4, sm: 6 },
                borderRadius: 4,
                textAlign: "center",
                background: "white",
              }}
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <UtensilsCrossed size={64} color="#cbd5e1" style={{ marginBottom: 16 }} />
              <Typography variant="h6" color="#64748b" fontWeight={600} mb={1}>
                ไม่พบเมนูที่ตรงกับการค้นหา
              </Typography>
              <Typography variant="body2" color="#94a3b8">
                ลองเปลี่ยนหมวดหมู่หรือคำค้นหา
              </Typography>
            </MotionPaper>
          ) : (
            // ✅ ไม่มี motion ซ้ำตอนเปลี่ยนหมวดหมู่
            <motion.div>
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                mb={3}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  background: "rgba(255,255,255,0.2)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: "white",
                    color: "#f5576c",
                    width: 48,
                    height: 48,
                  }}
                >
                  <UtensilsCrossed size={24} />
                </Avatar>
                <Box flex={1}>
                  <Typography variant="h5" fontWeight={700} color="#0f172a">
                    {displayedCategory}
                  </Typography>
                  <Typography variant="body2" color="#475569">
                    พบ {items.length} รายการ
                  </Typography>
                </Box>
                {fetching && <CircularProgress size={24} sx={{ color: "#f5576c" }} />}
              </Stack>

              <MotionGrid
                container
                spacing={{ xs: 2, sm: 3 }}
                variants={gridContainerVariants}
                initial={isInitialLoad ? "hidden" : false}
                animate="visible"
              >
                {items.map((item) => {
                  const rawQuantity = [
                    item.available_stock,
                    item.available_quantity,
                    item.remaining_quantity,
                    item.stock_quantity,
                    item.quantity,
                  ].find((value) => {
                    if (value === null || value === undefined || value === "") return false;
                    const numeric = Number(value);
                    return Number.isFinite(numeric);
                  });

                  const numericQuantity = Number(rawQuantity);
                  const hasQuantityInfo =
                    rawQuantity !== undefined && rawQuantity !== null && rawQuantity !== "";
                  const isOutOfStock = hasQuantityInfo && numericQuantity <= 0;
                  const isLowStock = hasQuantityInfo && numericQuantity > 0 && numericQuantity <= 5;

                  return (
                    <MotionGrid item xs={12} sm={6} md={4} lg={3} key={item.id} variants={gridItemVariants}>
                      <MotionCard
                        sx={{
                          borderRadius: 3,
                          overflow: "hidden",
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          background: "white",
                          position: "relative",
                          border: "1px solid #e2e8f0",
                        }}
                        whileHover={{
                          y: -8,
                          boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                          borderColor: "#f5576c",
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        {isOutOfStock && (
                          <Box
                            sx={{
                              position: "absolute",
                              inset: 0,
                              bgcolor: "rgba(0,0,0,0.6)",
                              zIndex: 2,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Chip
                              label="หมดชั่วคราว"
                              size="large"
                              sx={{
                                bgcolor: "#dc2626",
                                color: "white",
                                fontWeight: 700,
                                fontSize: "1rem",
                                px: 2,
                              }}
                            />
                          </Box>
                        )}

                        {item.image_url ? (
                          <CardMedia
                            component="img"
                            height="200"
                            image={item.image_url}
                            alt={item.name}
                            sx={{
                              objectFit: "cover",
                              filter: isOutOfStock ? "grayscale(1)" : "none",
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              height: 200,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "#f1f5f9",
                            }}
                          >
                            <UtensilsCrossed size={48} color="#cbd5e1" />
                          </Box>
                        )}

                        <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
                          <Typography
                            variant="subtitle1"
                            fontWeight={700}
                            color="#0f172a"
                            gutterBottom
                            sx={{
                              display: "-webkit-box",
                              WebkitBoxOrient: "vertical",
                              WebkitLineClamp: 1,
                              overflow: "hidden",
                            }}
                          >
                            {item.name}
                          </Typography>

                          <Typography
                            variant="body2"
                            color="#64748b"
                            sx={{
                              display: "-webkit-box",
                              WebkitBoxOrient: "vertical",
                              WebkitLineClamp: 2,
                              overflow: "hidden",
                            }}
                          >
                            {item.description || "ไม่มีคำอธิบาย"}
                          </Typography>

                          <Stack direction="row" spacing={1} alignItems="center" mt={2}>
                            <Typography
                              variant="h6"
                              fontWeight={800}
                              color="#f5576c"
                              sx={{ flexGrow: 1 }}
                            >
                              {formatCurrency(item.price)}
                            </Typography>

                            {isLowStock && !isOutOfStock && (
                              <Chip
                                label={`เหลือ ${numericQuantity} ชิ้น`}
                                size="small"
                                sx={{
                                  bgcolor: "#fef3c7",
                                  color: "#92400e",
                                  fontWeight: 600,
                                }}
                              />
                            )}
                          </Stack>
                        </CardContent>
                      </MotionCard>
                    </MotionGrid>
                  );
                })}
              </MotionGrid>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Info */}
        {items.length > 0 && (
          <Box
            sx={{
              mt: { xs: 4, md: 6 },
              p: { xs: 3, sm: 4 },
              borderRadius: { xs: 3, sm: 4 },
              background: "rgba(255,255,255,0.2)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.3)",
              textAlign: "center",
            }}
          >
            {/* <Typography variant="body2" color="#475569">
              © {new Date().getFullYear()} Board Game Café · ระบบจัดการเมนูทั้งหมด
            </Typography> */}
          </Box>
        )}
      </MuiContainer>
    </Box>
  );
}

export default FoodMenu;
