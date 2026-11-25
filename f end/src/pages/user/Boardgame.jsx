import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  Avatar,
  Select,
  Divider,
  Tooltip,
} from "@mui/material";
import { Container as MuiContainer } from "@mui/material";
import {
  Search,
  Sparkles,
  SlidersHorizontal,
  Gamepad2,
  Users,
  Layers3,
  Trophy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import boardgameAPI from "../../services/boardgameAPI";

const difficultyLabels = {
  easy: "ง่าย",
  medium: "ปานกลาง",
  hard: "ยาก",
};
const difficultyOrder = { easy: 1, medium: 2, hard: 3 };

function Boardgame() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showTrending, setShowTrending] = useState(false);
  const [sortOrder, setSortOrder] = useState("none");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [playersFilter, setPlayersFilter] = useState("all");

  // ดึงข้อมูลเกม
  const fetchGames = async ({ query = "", trending = false } = {}) => {
    setError("");
    try {
      const response = await boardgameAPI.getAll({
        search: query,
        isTrending: trending || undefined,
        limit: 100,
      });
      if (response.data?.ok) {
        setGames(response.data.data.items || []);
      }
    } catch (err) {
      console.error("Failed to load boardgames", err);
      const message = err.response?.data?.error?.message;
      setError(message || "ไม่สามารถโหลดข้อมูลบอร์ดเกมได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchGames({ query: searchTerm, trending: showTrending });
  };

  const toggleTrending = () => {
    const nextValue = !showTrending;
    setShowTrending(nextValue);
    fetchGames({ query: searchTerm, trending: nextValue });
  };

  // 🔸 กรองและเรียงข้อมูล
  const filteredAndSortedGames = useMemo(() => {
    let filtered = games;

    // กรองตามประเภท
    if (categoryFilter !== "all") {
      filtered = filtered.filter(
        (g) => g.category?.toLowerCase() === categoryFilter
      );
    }

    // กรองตามระดับความยาก
    if (difficultyFilter !== "all") {
      filtered = filtered.filter(
        (g) => g.difficulty_level?.toLowerCase() === difficultyFilter
      );
    }

    // กรองตามจำนวนผู้เล่น
    if (playersFilter !== "all") {
      filtered = filtered.filter((g) => {
        const min = g.min_players || 0;
        const max = g.max_players || 99;
        const p = Number(playersFilter);
        return p >= min && p <= max;
      });
    }

    // เรียงข้อมูล
    const sorted = [...filtered];
    if (sortOrder === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "th"));
    } else if (sortOrder === "difficulty") {
      sorted.sort(
        (a, b) =>
          (difficultyOrder[a.difficulty_level] || 0) -
          (difficultyOrder[b.difficulty_level] || 0)
      );
    } else if (sortOrder === "players") {
      sorted.sort((a, b) => (a.max_players || 0) - (b.max_players || 0));
    } else if (sortOrder === "category") {
      sorted.sort((a, b) =>
        (a.category || "").localeCompare(b.category || "", "th")
      );
    }

    return sorted;
  }, [games, sortOrder, categoryFilter, difficultyFilter, playersFilter]);

  const categories = useMemo(() => {
    const cats = Array.from(
      new Set(games.map((g) => g.category).filter(Boolean))
    );
    return cats;
  }, [games]);

  const subtitle = useMemo(() => {
    if (showTrending) return "รายชื่อเกมยอดนิยมที่ทีมงานคัดสรร";
    return "สำรวจคลังเกมทั้งหมดและเลือกเกมที่เหมาะกับกลุ่มของคุณ";
  }, [showTrending]);

  return (
    <Box
      sx={{
        background: "#ff6a000f",
        minHeight: "100vh",
        borderRadius: "1.2rem",
        py: { xs: 3, sm: 4, md: 6 },
        position: "relative",
      }}
    >
      <MuiContainer maxWidth="xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Paper
            elevation={8}
            sx={{
              p: { xs: 3, sm: 4, md: 5 },
              borderRadius: 4,
              mb: 5,
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.95))",
              backdropFilter: "blur(10px)",
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={4}
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Box flex={1}>
                <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                  <Gamepad2 size={26} color="#ff6b00" />
                  <Typography
                    variant="overline"
                    sx={{ color: "#ff6b00", letterSpacing: 3, fontWeight: 700 }}
                  >
                    BOARDGAME LIBRARY
                  </Typography>
                </Stack>
                <Typography
                  variant="h3"
                  fontWeight={800}
                  color="#0f172a"
                  mb={2}
                  sx={{ fontSize: { xs: "1.8rem", sm: "2.5rem", md: "3rem" } }}
                >
                  ค้นหาเกมที่ใช่ <br /> สำหรับค่ำคืนแห่งความสนุก 🎲
                </Typography>
                <Typography variant="body1" color="#475569" lineHeight={1.8}>
                  {subtitle}
                </Typography>
              </Box>

              {/* Search */}
              <Box sx={{ width: { xs: "100%", md: "420px" } }}>
                <Box
                  component="form"
                  onSubmit={handleSearch}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    background:
                      "linear-gradient(135deg, rgba(255,107,0,0.08), rgba(240,147,251,0.08))",
                    border: "2px solid rgba(255,107,0,0.15)",
                  }}
                >
                  <Stack direction="row" spacing={1} mb={2} alignItems="center">
                    <Search size={18} color="#ff6b00" />
                    <Typography variant="subtitle2" fontWeight={700}>
                      ค้นหาบอร์ดเกม
                    </Typography>
                  </Stack>

                  <TextField
                    fullWidth
                    placeholder="ค้นหาเกม..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    size="small"
                    sx={{
                      mb: 2,
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        bgcolor: "white",
                      },
                    }}
                  />

                  <Stack direction="row" spacing={1}>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<Search size={18} />}
                      fullWidth
                      sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        background:
                          "linear-gradient(135deg, #f093fb 0%, #ff6b00 100%)",
                      }}
                    >
                      ค้นหา
                    </Button>
                    <Button
                      variant={showTrending ? "contained" : "outlined"}
                      onClick={toggleTrending}
                      sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        borderColor: "#ff6b00",
                        color: showTrending ? "white" : "#ff6b00",
                        background: showTrending
                          ? "linear-gradient(135deg, #f093fb 0%, #ff6b00 100%)"
                          : "transparent",
                      }}
                    >
                      <Sparkles size={18} style={{ marginRight: 6 }} />
                      มาแรง
                    </Button>
                  </Stack>
                </Box>
              </Box>
            </Stack>
          </Paper>
        </motion.div>

        {/* Filter & Sort */}
        <Paper
          elevation={3}
          sx={{
            p: 3,
            borderRadius: 3,
            mb: 4,
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            alignItems: "center",
          }}
        >
          <Avatar sx={{ bgcolor: "white", color: "#ff6b00" }}>
            <SlidersHorizontal size={20} />
          </Avatar>
          <Select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            size="small"
            sx={{ bgcolor: "white", borderRadius: 2, fontWeight: 600 }}
          >
            <MenuItem value="none">ไม่จัดเรียง</MenuItem>
            <MenuItem value="name">ตามชื่อ</MenuItem>
            <MenuItem value="difficulty">ตามระดับความยาก</MenuItem>
            <MenuItem value="players">ตามจำนวนผู้เล่น</MenuItem>
            <MenuItem value="category">ตามประเภท</MenuItem>
          </Select>

          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            size="small"
            sx={{ bgcolor: "white", borderRadius: 2, fontWeight: 600 }}
          >
            <MenuItem value="all">ทุกประเภท</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat} value={cat.toLowerCase()}>
                {cat}
              </MenuItem>
            ))}
          </Select>

          <Select
            value={playersFilter}
            onChange={(e) => setPlayersFilter(e.target.value)}
            size="small"
            sx={{ bgcolor: "white", borderRadius: 2, fontWeight: 600 }}
          >
            <MenuItem value="all">ผู้เล่นทั้งหมด</MenuItem>
            {[1, 2, 3, 4, 5, 6, 8].map((p) => (
              <MenuItem key={p} value={p}>{`${p} คน`}</MenuItem>
            ))}
          </Select>

          <Select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            size="small"
            sx={{ bgcolor: "white", borderRadius: 2, fontWeight: 600 }}
          >
            <MenuItem value="all">ทุกระดับความยาก</MenuItem>
            <MenuItem value="easy">ง่าย</MenuItem>
            <MenuItem value="medium">ปานกลาง</MenuItem>
            <MenuItem value="hard">ยาก</MenuItem>
          </Select>
        </Paper>

        {/* แสดงผลรายการเกม */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box textAlign="center" py={6}>
            <CircularProgress sx={{ color: "#ff6b00" }} />
          </Box>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div layout transition={{ layout: { duration: 0.5 } }}>
              <Box
                sx={{
                  display: "flex",
                  overflowX: "auto",
                  gap: { xs: 2, sm: 3 },
                  pb: 3,
                  scrollSnapType: "x mandatory",
                  "& > *": { scrollSnapAlign: "center" },
                }}
              >
                {filteredAndSortedGames.map((game, i) => (
                  <motion.div
                    key={game.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <Tooltip title={game.description || "ไม่มีคำอธิบาย"}>
                      <Card
                        sx={{
                          minWidth: { xs: 240, sm: 260, md: 280 },
                          borderRadius: 4,
                          flexShrink: 0,
                          background: "rgba(255,255,255,0.9)",
                          backdropFilter: "blur(8px)",
                          border: "1px solid rgba(255,107,0,0.2)",
                        }}
                      >
                        {game.image_url && (
                          <CardMedia
                            component="img"
                            height="180"
                            image={game.image_url}
                            alt={game.name}
                            sx={{ objectFit: "cover" }}
                          />
                        )}
                        <CardContent>
                          <Typography fontWeight={700} variant="h6" noWrap>
                            {game.name}
                          </Typography>
                          <Typography variant="body2" color="#64748b" my={0.5}>
                            👥 {game.min_players || "?"} -{" "}
                            {game.max_players || "?"} คน · ⏱{" "}
                            {game.duration_minutes || "?"} นาที
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            <Chip
                              size="small"
                              label={
                                difficultyLabels[game.difficulty_level] ||
                                "ไม่ระบุ"
                              }
                              sx={{
                                bgcolor: "#fef3c7",
                                color: "#92400e",
                                fontWeight: 600,
                              }}
                            />
                            {game.category && (
                              <Chip
                                size="small"
                                label={game.category}
                                sx={{
                                  bgcolor: "#dcfce7",
                                  color: "#166534",
                                  fontWeight: 600,
                                }}
                              />
                            )}
                          </Stack>
                        </CardContent>
                      </Card>
                    </Tooltip>
                  </motion.div>
                ))}
              </Box>
            </motion.div>
          </AnimatePresence>
        )}
      </MuiContainer>
    </Box>
  );
}

export default Boardgame;
