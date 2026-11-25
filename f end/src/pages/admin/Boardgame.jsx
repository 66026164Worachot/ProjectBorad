import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  Link,
  Menu,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AccessTime,
  Add,
  Build,
  CalendarMonth,
  Category,
  CheckCircle,
  ChevronRight,
  Delete,
  Edit,
  Groups,
  Home,
  LocalFireDepartment,
  MoreVert,
  Refresh,
  Search,
  Speed,
  SportsEsports,
  TableChart,
  Update,
  ViewModule,
  DoNotDisturb,
} from "@mui/icons-material";
import boardgameAPI from "../../services/boardgameAPI";
import { auth } from "../../utils/auth";

const defaultForm = {
  name: "",
  description: "",
  minPlayers: "",
  maxPlayers: "",
  playtimeMinutes: "",
  complexity: "",
  category: "",
  availableQuantity: "",
  imageUrl: "",
  isTrending: false,
  status: "available",
};

const fallbackImage = "https://via.placeholder.com/400x240?text=Board+Game";

const difficultyLabels = {
  easy: "ง่าย",
  medium: "ปานกลาง",
  hard: "ยาก",
};

const statusLabels = {
  available: "พร้อมให้บริการ",
  unavailable: "ไม่พร้อมให้บริการ",
  maintenance: "กำลังซ่อมบำรุง",
};

const statusChipProps = {
  available: { color: "success", icon: CheckCircle },
  unavailable: { color: "default", icon: DoNotDisturb },
  maintenance: { color: "warning", icon: Build },
};

const Boardgame = () => {
  const [boardgames, setBoardgames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [searchTerm, setSearchTerm] = useState("");
  const [trendingUpdatingId, setTrendingUpdatingId] = useState(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [dialogMode, setDialogMode] = useState("create");
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [filters, setFilters] = useState({ status: "all", difficulty: "all", trending: "all" });
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [menuGame, setMenuGame] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const currentUser = auth.getUserInfo();
  const canManage = currentUser?.role === "manager";

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const mapFromApi = useCallback(
    (item) => ({
      id: item.id,
      name: item.name,
      description: item.description || "",
      minPlayers: item.min_players ?? null,
      maxPlayers: item.max_players ?? null,
      playtimeMinutes: item.duration_minutes ?? null,
      complexity:
        typeof item.difficulty_level === "string"
          ? item.difficulty_level.toLowerCase()
          : null,
      category: item.category || "",
      availableQuantity:
        typeof item.available_quantity === "number" ? item.available_quantity : null,
      imageUrl: item.image_url || "",
      isTrending: Boolean(item.is_trending),
      status: item.status?.toLowerCase() || "available",
      createdAt: item.created_at || new Date().toISOString(),
      updatedAt: item.updated_at || item.created_at || new Date().toISOString(),
    }),
    []
  );

  const fetchBoardgames = useCallback(async () => {
    setLoading(true);
    try {
      const response = await boardgameAPI.getAll({ limit: 100 });
      if (response.data?.ok) {
        const rawItems = Array.isArray(response.data?.data?.items)
          ? response.data.data.items
          : [];
        const items = rawItems.map(mapFromApi);
        setBoardgames(items);
      } else {
        setBoardgames([]);
      }
    } catch (error) {
      console.error("FETCH_BOARDGAMES_ERROR", error);
      showSnackbar(
        error.response?.data?.error?.message || "ไม่สามารถดึงข้อมูลบอร์ดเกมได้",
        "error"
      );
      setBoardgames([]);
    } finally {
      setLoading(false);
    }
  }, [mapFromApi]);

  useEffect(() => {
    fetchBoardgames();
  }, [fetchBoardgames]);

  const trendingCount = useMemo(
    () => boardgames.filter((game) => game.isTrending).length,
    [boardgames]
  );

  const statusSummary = useMemo(() => {
    return boardgames.reduce(
      (acc, game) => {
        if (game.status === "available") acc.available += 1;
        if (game.status === "unavailable") acc.unavailable += 1;
        if (game.status === "maintenance") acc.maintenance += 1;
        return acc;
      },
      { available: 0, unavailable: 0, maintenance: 0 }
    );
  }, [boardgames]);

  const filteredBoardgames = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    let filtered = keyword
      ? boardgames.filter((game) => {
          const haystack = `${game.name} ${game.description}`.toLowerCase();
          return haystack.includes(keyword);
        })
      : boardgames;

    if (filters.status !== "all") {
      filtered = filtered.filter((game) => game.status === filters.status);
    }

    if (filters.difficulty !== "all") {
      filtered = filtered.filter((game) => game.complexity === filters.difficulty);
    }

    if (filters.trending === "trending") {
      filtered = filtered.filter((game) => game.isTrending);
    } else if (filters.trending === "normal") {
      filtered = filtered.filter((game) => !game.isTrending);
    }

    return [...filtered].sort((a, b) => {
      if (a.isTrending === b.isTrending) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return a.isTrending ? -1 : 1;
    });
  }, [boardgames, filters, searchTerm]);

  const handleDialogClose = () => {
    setDialogOpen(false);
    setForm(defaultForm);
    setDialogMode("create");
    setEditingId(null);
  };

  const handleFormChange = (field) => (event) => {
    const value = field === "isTrending" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenCreateDialog = () => {
    setDialogMode("create");
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const mapGameToForm = useCallback(
    (game) => ({
      name: game?.name || "",
      description: game?.description || "",
      minPlayers: game?.minPlayers ?? "",
      maxPlayers: game?.maxPlayers ?? "",
      playtimeMinutes: game?.playtimeMinutes ?? "",
      complexity: game?.complexity || "",
      category: game?.category || "",
      availableQuantity:
        typeof game?.availableQuantity === "number" ? game.availableQuantity : "",
      imageUrl: game?.imageUrl || "",
      isTrending: Boolean(game?.isTrending),
      status: game?.status || "available",
    }),
    []
  );

  const handleOpenEditDialog = (game) => {
    setDialogMode("edit");
    setEditingId(game.id);
    setForm(mapGameToForm(game));
    setDialogOpen(true);
  };

  const parseNumberField = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return null;
    }
    return parsed;
  };

  const handleSubmitBoardgame = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      showSnackbar("กรุณากรอกชื่อบอร์ดเกม", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        minPlayers: parseNumberField(form.minPlayers),
        maxPlayers: parseNumberField(form.maxPlayers),
        playtimeMinutes: parseNumberField(form.playtimeMinutes),
        complexity: form.complexity || null,
        category: form.category.trim() || null,
        availableQuantity: parseNumberField(form.availableQuantity),
        imageUrl: form.imageUrl.trim() || null,
        isTrending: form.isTrending,
        status: form.status || "available",
      };

      if (dialogMode === "edit" && editingId) {
        await boardgameAPI.update(editingId, payload);
        showSnackbar("อัปเดตบอร์ดเกมเรียบร้อยแล้ว", "success");
      } else {
        await boardgameAPI.create(payload);
        showSnackbar("เพิ่มบอร์ดเกมเรียบร้อยแล้ว", "success");
      }

      handleDialogClose();
      fetchBoardgames();
    } catch (error) {
      console.error("CREATE_BOARDGAME_ERROR", error);
      showSnackbar(
        error.response?.data?.error?.message || "ไม่สามารถเพิ่มบอร์ดเกมได้",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTrending = async (game, value) => {
    setTrendingUpdatingId(game.id);
    try {
      await boardgameAPI.update(game.id, { isTrending: value });
      setBoardgames((prev) =>
        prev.map((item) =>
          item.id === game.id ? { ...item, isTrending: value } : item
        )
      );
      showSnackbar(
        value ? "ตั้งเป็นเกมยอดฮิตเรียบร้อย" : "ยกเลิกสถานะเกมยอดฮิตแล้ว",
        "success"
      );
    } catch (error) {
      console.error("TOGGLE_TRENDING_ERROR", error);
      showSnackbar(
        error.response?.data?.error?.message || "ไม่สามารถอัปเดตสถานะยอดฮิตได้",
        "error"
      );
    } finally {
      setTrendingUpdatingId(null);
    }
  };

  const handleToggleStatus = async (game, checked) => {
    const nextStatus = checked ? "available" : "unavailable";

    setStatusUpdatingId(game.id);
    try {
      await boardgameAPI.update(game.id, { status: nextStatus });
      setBoardgames((prev) =>
        prev.map((item) =>
          item.id === game.id
            ? {
                ...item,
                status: nextStatus,
              }
            : item
        )
      );
      showSnackbar(
        checked ? "เปิดให้บริการเกมนี้แล้ว" : "ปิดการให้บริการเกมนี้เรียบร้อย",
        "success"
      );
    } catch (error) {
      console.error("TOGGLE_STATUS_ERROR", error);
      showSnackbar(
        error.response?.data?.error?.message || "ไม่สามารถอัปเดตสถานะการให้บริการได้",
        "error"
      );
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleMenuOpen = (event, game) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuGame(game);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuGame(null);
  };

  const handleDeleteRequest = (game) => {
    setDeleteTarget(game);
    handleMenuClose();
  };

  const handleDeleteBoardgame = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      await boardgameAPI.remove(deleteTarget.id);
      setBoardgames((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      showSnackbar("ลบบอร์ดเกมเรียบร้อยแล้ว", "success");
      setDeleteTarget(null);
    } catch (error) {
      console.error("DELETE_BOARDGAME_ERROR", error);
      showSnackbar(
        error.response?.data?.error?.message || "ไม่สามารถลบบอร์ดเกมได้",
        "error"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleFilterChange = (key) => (event) => {
    setFilters((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleTabChange = (_event, value) => {
    setActiveTab(value);
  };

  const handleQuickTrendingFilter = () => {
    setFilters((prev) => ({ ...prev, trending: "trending" }));
    setActiveTab(0);
  };

  const renderFilterCard = () => (
    <Card sx={{ mb: 3, p: { xs: 2, md: 3 } }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            placeholder="ค้นหาบอร์ดเกม..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: "text.secondary" }} />
                </InputAdornment>
              ),
            }}
          />
        </Grid> 
        <Grid item xs={12} sm={6} md={4}>
          <FormControl fullWidth>
            <InputLabel>สถานะ</InputLabel>
            <Select
              value={filters.status}
              label="สถานะ"
              onChange={handleFilterChange("status")}
            >
              <MenuItem value="all">สถานะทั้งหมด</MenuItem>
              <MenuItem value="available">พร้อมให้บริการ</MenuItem>
              <MenuItem value="unavailable">ไม่พร้อมให้บริการ</MenuItem>
              <MenuItem value="maintenance">กำลังซ่อมบำรุง</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <FormControl fullWidth>
            <InputLabel>ระดับความยาก</InputLabel>
            <Select
              value={filters.difficulty}
              label="ระดับความยาก"
              onChange={handleFilterChange("difficulty")}
            >
              <MenuItem value="all">ทั้งหมด</MenuItem>
              <MenuItem value="easy">ง่าย</MenuItem>
              <MenuItem value="medium">ปานกลาง</MenuItem>
              <MenuItem value="hard">ยาก</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <FormControl fullWidth>
            <InputLabel>ความนิยม</InputLabel>
            <Select
              value={filters.trending}
              label="ความนิยม"
              onChange={handleFilterChange("trending")}
            >
              <MenuItem value="all">ทั้งหมด</MenuItem>
              <MenuItem value="trending">เกมยอดฮิต</MenuItem>
              <MenuItem value="normal">เกมทั่วไป</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchBoardgames}
            disabled={loading}
          >
            รีเฟรชข้อมูล
          </Button>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Button
            fullWidth
            variant="text"
            onClick={() => {
              setFilters({ status: "all", difficulty: "all", trending: "all" });
              setSearchTerm("");
            }}
            disabled={loading}
          >
            ล้างตัวกรอง
          </Button>
        </Grid>
      </Grid>
    </Card>
  );

  const renderEmptyState = (title, description) => (
    <Card sx={{ p: { xs: 6, md: 8 }, textAlign: "center" }}>
      <Stack spacing={2} alignItems="center">
        <SportsEsports sx={{ fontSize: 56, color: "text.disabled" }} />
        <Typography variant="h6" fontWeight={700} color="text.primary">
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" maxWidth={360}>
          {description}
        </Typography>
        {canManage && (
          <Button variant="contained" startIcon={<Add />} onClick={handleOpenCreateDialog}>
            เพิ่มบอร์ดเกมแรกของคุณ
          </Button>
        )}
      </Stack>
    </Card>
  );

  const renderGridView = () => {
    if (loading) {
      return (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      );
    }

    if (filteredBoardgames.length === 0) {
      return renderEmptyState(
        "ยังไม่มีบอร์ดเกมที่ตรงกับการค้นหา",
        "ลองปรับตัวกรองหรือเพิ่มเกมใหม่เพื่อเริ่มต้นคลังของคุณ"
      );
    }

    return (
      <Grid container spacing={3}>
        {filteredBoardgames.map((game) => {
          const statusMeta = statusChipProps[game.status] || {};
          const StatusIcon = statusMeta.icon;
          const statusLabel = statusLabels[game.status] || "ไม่ระบุสถานะ";
          const playersLabel =
            game.minPlayers && game.maxPlayers
              ? `${game.minPlayers}-${game.maxPlayers} ผู้เล่น`
              : game.minPlayers
              ? `อย่างน้อย ${game.minPlayers} ผู้เล่น`
              : game.maxPlayers
              ? `สูงสุด ${game.maxPlayers} ผู้เล่น`
              : null;
          const createdAtLabel = formatDateTime(game.createdAt);
          const updatedAtLabel = formatDateTime(game.updatedAt);
          const isTrendingToggling = trendingUpdatingId === game.id;
          const isStatusToggling = statusUpdatingId === game.id;
          const isStatusAvailable = game.status === "available";
          const isStatusMaintenance = game.status === "maintenance";
          const statusToggleDisabled = isStatusToggling || isStatusMaintenance;

          return (
            <Grid item xs={12} sm={6} md={4} key={game.id}>
              <Card
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  overflow: "hidden",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: 4,
                  },
                }}
              >
                <CardMedia
                  component="img"
                  height="200"
                  image={game.imageUrl || fallbackImage}
                  alt={game.name}
                  sx={{ objectFit: "cover" }}
                />

                <Chip
                  icon={StatusIcon ? <StatusIcon fontSize="small" /> : undefined}
                  label={statusLabel}
                  size="small"
                  color={statusMeta.color || "default"}
                  variant={statusMeta.color ? "filled" : "outlined"}
                  sx={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    bgcolor:
                      statusMeta.color && statusMeta.color !== "default"
                        ? undefined
                        : "background.paper",
                  }}
                />

                {game.isTrending && (
                  <Chip
                    icon={<LocalFireDepartment fontSize="small" />}
                    label="เกมยอดฮิต"
                    size="small"
                    color="error"
                    sx={{ position: "absolute", top: 16, right: 16 }}
                  />
                )}

                <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar src={game.imageUrl || undefined} alt={game.name}>
                      {game.name.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight={700} noWrap>
                        {game.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {game.category || "หมวดหมู่ทั่วไป"}
                      </Typography>
                    </Box>
                    {canManage && (
                      <Tooltip title="ตัวเลือกเพิ่มเติม" arrow>
                        <IconButton size="small" sx={{ ml: "auto" }} onClick={(event) => handleMenuOpen(event, game)}>
                          <MoreVert />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>

                  <Typography variant="body2" color="text.secondary" sx={{ minHeight: 64 }}>
                    {game.description || "ยังไม่มีคำอธิบายสำหรับเกมนี้"}
                  </Typography>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {playersLabel && (
                      <Chip icon={<Groups fontSize="small" />} label={playersLabel} size="small" variant="outlined" />
                    )}
                    {game.playtimeMinutes && (
                      <Chip icon={<AccessTime fontSize="small" />} label={`${game.playtimeMinutes} นาที`} size="small" />
                    )}
                    {game.complexity && (
                      <Chip
                        icon={<Speed fontSize="small" />}
                        label={difficultyLabels[game.complexity] || game.complexity}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    {game.availableQuantity !== null && (
                      <Chip
                        icon={<SportsEsports fontSize="small" />}
                        label={`พร้อมให้ยืม ${game.availableQuantity ?? 0} ชุด`}
                        size="small"
                      />
                    )}
                  </Stack>

                  <Divider />

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" color="text.secondary">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CalendarMonth fontSize="small" />
                      <Typography variant="caption">เพิ่มเมื่อ {createdAtLabel}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Update fontSize="small" />
                      <Typography variant="caption">อัปเดตล่าสุด {updatedAtLabel}</Typography>
                    </Stack>
                  </Stack>
                </CardContent>

                {canManage && (
                  <>
                    <Divider />
                    <CardActions
                      sx={{
                        px: 3,
                        py: 2,
                        display: "flex",
                        flexDirection: { xs: "column", md: "row" },
                        alignItems: { xs: "stretch", md: "center" },
                        gap: 1.5,
                      }}
                    >
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1.5}
                        alignItems={{ xs: "flex-start", md: "center" }}
                        flexGrow={1}
                      >
                        <Tooltip
                          title={
                            isStatusMaintenance
                              ? "ไม่สามารถเปิด/ปิดระหว่างอยู่ในสถานะซ่อมบำรุง"
                              : "สลับสถานะการให้บริการของเกม"
                          }
                          arrow
                        >
                          <FormControlLabel
                            control={
                              <Switch
                                color="success"
                                checked={isStatusAvailable}
                                onChange={(event) => handleToggleStatus(game, event.target.checked)}
                                disabled={statusToggleDisabled}
                              />
                            }
                            label={isStatusAvailable ? "เปิดให้บริการ" : "ปิดการให้บริการ"}
                          />
                        </Tooltip>

                        <FormControlLabel
                          control={
                            <Switch
                              color="primary"
                              checked={game.isTrending}
                              onChange={(event) => handleToggleTrending(game, event.target.checked)}
                              disabled={isTrendingToggling || isStatusToggling}
                            />
                          }
                          label={game.isTrending ? "กำลังโปรโมต" : "ตั้งเป็นเกมยอดฮิต"}
                        />
                      </Stack>
                      <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
                        <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => handleOpenEditDialog(game)}>
                          แก้ไข
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          variant="text"
                          startIcon={<Delete />}
                          onClick={() => handleDeleteRequest(game)}
                        >
                          ลบ
                        </Button>
                      </Stack>
                    </CardActions>
                  </>
                )}
              </Card>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  const renderTableView = () => {
    if (loading) {
      return (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      );
    }

    if (filteredBoardgames.length === 0) {
      return renderEmptyState(
        "ยังไม่มีข้อมูลบนตาราง",
        "เพิ่มหรือค้นหาเกมใหม่เพื่อแสดงในมุมมองตาราง"
      );
    }

    return (
      <Card sx={{ p: { xs: 2, md: 3 } }}>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead sx={{ bgcolor: "#f8fafc" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>บอร์ดเกม</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>สถานะ</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>ผู้เล่น</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>ระยะเวลา</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>หมวดหมู่</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>ยอดฮิต</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>อัปเดตล่าสุด</TableCell>
                {canManage && <TableCell align="right" sx={{ fontWeight: 700 }}>การจัดการ</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredBoardgames.map((game) => {
                const statusMeta = statusChipProps[game.status] || {};
                const StatusIcon = statusMeta.icon;
                const statusLabel = statusLabels[game.status] || "ไม่ระบุสถานะ";
                const playersLabel =
                  game.minPlayers && game.maxPlayers
                    ? `${game.minPlayers}-${game.maxPlayers}`
                    : game.minPlayers
                    ? `≥ ${game.minPlayers}`
                    : game.maxPlayers
                    ? `≤ ${game.maxPlayers}`
                    : "-";
                const isTrendingToggling = trendingUpdatingId === game.id;
                const isStatusToggling = statusUpdatingId === game.id;
                const isStatusMaintenance = game.status === "maintenance";

                return (
                  <TableRow key={game.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar src={game.imageUrl || undefined} alt={game.name}>
                          {game.name.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={700}>
                            {game.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {game.description ? game.description.slice(0, 60) : "ยังไม่มีคำอธิบาย"}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        icon={StatusIcon ? <StatusIcon fontSize="small" /> : undefined}
                        label={statusLabel}
                        size="small"
                        color={statusMeta.color || "default"}
                        variant={statusMeta.color ? "filled" : "outlined"}
                      />
                    </TableCell>
                    <TableCell align="center">{playersLabel}</TableCell>
                    <TableCell align="center">
                      {game.playtimeMinutes ? `${game.playtimeMinutes} นาที` : "-"}
                    </TableCell>
                    <TableCell align="center">{game.category || "-"}</TableCell>
                    <TableCell align="center">
                      {canManage ? (
                        <Switch
                          size="small"
                          color="primary"
                          checked={game.isTrending}
                          onChange={(event) => handleToggleTrending(game, event.target.checked)}
                          disabled={isTrendingToggling || isStatusToggling}
                        />
                      ) : (
                        <Chip
                          label={game.isTrending ? "ใช่" : "ไม่ใช่"}
                          size="small"
                          color={game.isTrending ? "error" : "default"}
                          variant={game.isTrending ? "filled" : "outlined"}
                        />
                      )}
                    </TableCell>
                    <TableCell align="center">{formatDateTime(game.updatedAt)}</TableCell>
                    {canManage && (
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip
                            title={
                              isStatusMaintenance
                                ? "ไม่สามารถเปิด/ปิดระหว่างอยู่ในสถานะซ่อมบำรุง"
                                : "สลับสถานะการให้บริการ"
                            }
                            arrow
                          >
                            <span>
                              <Switch
                                size="small"
                                color="success"
                                checked={game.status === "available"}
                                onChange={(event) => handleToggleStatus(game, event.target.checked)}
                                disabled={isStatusToggling || isStatusMaintenance}
                              />
                            </span>
                          </Tooltip>
                          <Tooltip title="แก้ไขข้อมูล" arrow>
                            <IconButton size="small" onClick={() => handleOpenEditDialog(game)}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="ลบเกม" arrow>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteRequest(game)}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    );
  };

  const handleDeleteDialogClose = () => {
    if (deletingId) return;
    setDeleteTarget(null);
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return value;
    }
  };


  return (
    <Box sx={{ p: { xs: 2, sm: 4, md: 6 }, bgcolor: "#f8fafc", minHeight: "100vh" }}>
      <Box sx={{ maxWidth: 1400, mx: "auto" }}>
        <Box display="flex" alignItems="center" mb={3}>
          <Home sx={{ color: "#60a5fa" }} />
          <Breadcrumbs separator={<ChevronRight fontSize="small" />} sx={{ ml: 1 }}>
            <Link underline="hover" color="#000" href="/admin/dashboard">
              Home
            </Link>
            <Typography color="#2563eb">Board Game</Typography>
          </Breadcrumbs>
        </Box>

        <Card
          sx={{
            mb: 4,
            p: { xs: 3, md: 4 },
            color: "common.white",
            backgroundImage: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
            boxShadow: 6,
            borderRadius: 4,
          }}
        >
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={3}
            alignItems={{ xs: "flex-start", lg: "center" }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                sx={{
                  bgcolor: "rgba(255,255,255,0.18)",
                  width: 64,
                  height: 64,
                }}
              >
                <SportsEsports sx={{ fontSize: 32 }} />
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                  Board Game Management
                </Typography>
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)" }}>
                  ดูแลคลังบอร์ดเกมและโปรโมตเกมยอดฮิตให้ลูกค้าได้จากหน้าจอเดียว
                </Typography>
              </Box>
            </Stack>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", sm: "center" }}
              sx={{ ml: { lg: "auto" } }}
            >
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<Refresh />}
                onClick={fetchBoardgames}
                disabled={loading}
              >
                รีเฟรชข้อมูล
              </Button>
              <Badge
                badgeContent={trendingCount}
                color="error"
                overlap="circular"
                anchorOrigin={{ vertical: "top", horizontal: "right" }}
              >
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<LocalFireDepartment />}
                  onClick={handleQuickTrendingFilter}
                >
                  เกมยอดฮิต
                </Button>
              </Badge>
              {canManage && (
                <Button
                  variant="contained"
                  color="inherit"
                  startIcon={<Add />}
                  onClick={handleOpenCreateDialog}
                >
                  เพิ่มบอร์ดเกม
                </Button>
              )}
            </Stack>
          </Stack>
        </Card>

        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ p: 3 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <SportsEsports color="primary" />
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    {boardgames.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    บอร์ดเกมทั้งหมด
                  </Typography>
                </Box>
              </Stack>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ p: 3 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CheckCircle color="success" />
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    {statusSummary.available}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    พร้อมให้บริการ
                  </Typography>
                </Box>
              </Stack>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ p: 3 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <DoNotDisturb color="error" />
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    {statusSummary.unavailable}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ปิดให้บริการชั่วคราว
                  </Typography>
                </Box>
              </Stack>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ p: 3 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <LocalFireDepartment color="error" />
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    {trendingCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    เกมยอดฮิต
                  </Typography>
                </Box>
              </Stack>
            </Card>
          </Grid>
        </Grid>

        {!canManage && (
          <Alert severity="info" sx={{ mb: 3 }}>
            เฉพาะผู้จัดการเท่านั้นที่สามารถเพิ่ม ปรับสถานะ หรือโปรโมตเกมยอดฮิตได้
          </Alert>
        )}

        <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
          <Tab icon={<ViewModule />} iconPosition="start" label="คลังบอร์ดเกม" />
          <Tab icon={<TableChart />} iconPosition="start" label="ตารางข้อมูล" />
        </Tabs>

        {activeTab === 0 && (
          <>
            {renderFilterCard()}
            {renderGridView()}
          </>
        )}

        {activeTab === 1 && (
          <>
            {renderFilterCard()}
            {renderTableView()}
          </>
        )}
      </Box>

      {canManage && (
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <MenuItem
            onClick={() => {
              if (menuGame) {
                handleOpenEditDialog(menuGame);
              }
              handleMenuClose();
            }}
          >
            <Edit fontSize="small" sx={{ mr: 1 }} /> แก้ไขข้อมูล
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (menuGame) {
                handleDeleteRequest(menuGame);
              }
            }}
            sx={{ color: "error.main" }}
          >
            <Delete fontSize="small" sx={{ mr: 1 }} /> ลบเกม
          </MenuItem>
        </Menu>
      )}

      <Dialog
        open={dialogOpen}
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
        component="form"
        onSubmit={handleSubmitBoardgame}
      >
        <DialogTitle>{dialogMode === "edit" ? "แก้ไขข้อมูลบอร์ดเกม" : "เพิ่มบอร์ดเกมใหม่"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="ชื่อบอร์ดเกม"
              value={form.name}
              onChange={handleFormChange("name")}
              required
              fullWidth
            />
            <TextField
              label="คำอธิบาย"
              value={form.description}
              onChange={handleFormChange("description")}
              multiline
              minRows={3}
              fullWidth
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="จำนวนผู้เล่นต่ำสุด"
                type="number"
                inputProps={{ min: 0 }}
                value={form.minPlayers}
                onChange={handleFormChange("minPlayers")}
                fullWidth
              />
              <TextField
                label="จำนวนผู้เล่นสูงสุด"
                type="number"
                inputProps={{ min: 0 }}
                value={form.maxPlayers}
                onChange={handleFormChange("maxPlayers")}
                fullWidth
              />
            </Stack>
            <TextField
              label="ระยะเวลาในการเล่น (นาที)"
              type="number"
              inputProps={{ min: 0 }}
              value={form.playtimeMinutes}
              onChange={handleFormChange("playtimeMinutes")}
              fullWidth
            />
            <TextField
              label="ระดับความยาก"
              value={form.complexity}
              onChange={handleFormChange("complexity")}
              select
              fullWidth
            >
              <MenuItem value="">
                <em>ไม่ระบุ</em>
              </MenuItem>
              <MenuItem value="easy">ง่าย</MenuItem>
              <MenuItem value="medium">ปานกลาง</MenuItem>
              <MenuItem value="hard">ยาก</MenuItem>
            </TextField>
            <TextField
              label="หมวดหมู่"
              value={form.category}
              onChange={handleFormChange("category")}
              placeholder="เช่น Party, Strategy, Family"
              fullWidth
            />
            <TextField
              label="จำนวนชุดที่พร้อมให้ยืม"
              type="number"
              inputProps={{ min: 0 }}
              value={form.availableQuantity}
              onChange={handleFormChange("availableQuantity")}
              fullWidth
            />
            <TextField
              label="สถานะ"
              value={form.status}
              onChange={handleFormChange("status")}
              select
              fullWidth
              required
            >
              <MenuItem value="available">พร้อมให้บริการ</MenuItem>
              <MenuItem value="unavailable">ไม่พร้อมให้บริการ</MenuItem>
              <MenuItem value="maintenance">กำลังซ่อมบำรุง</MenuItem>
            </TextField>
            <TextField
              label="ลิงก์รูปภาพ"
              value={form.imageUrl}
              onChange={handleFormChange("imageUrl")}
              placeholder="https://"
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  color="primary"
                  checked={form.isTrending}
                  onChange={handleFormChange("isTrending")}
                />
              }
              label="ตั้งเป็นเกมยอดฮิต"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting
              ? "กำลังบันทึก..."
              : dialogMode === "edit"
              ? "บันทึกการเปลี่ยนแปลง"
              : "บันทึก"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={handleDeleteDialogClose}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>ยืนยันการลบบอร์ดเกม</DialogTitle>
        <DialogContent dividers>
          <DialogContentText>
            ต้องการลบ "{deleteTarget?.name}" ออกจากคลังบอร์ดเกมหรือไม่? การลบครั้งนี้ไม่สามารถย้อนกลับได้
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteDialogClose} disabled={Boolean(deletingId)}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleDeleteBoardgame}
            color="error"
            variant="contained"
            disabled={Boolean(deletingId)}
          >
            {deletingId ? "กำลังลบ..." : "ลบเกม"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );

};

export default Boardgame;