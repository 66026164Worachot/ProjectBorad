import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  Chip,
  Breadcrumbs,
  Link,
  Tooltip,
  Stack,
  Divider,
  Avatar,
  LinearProgress,
  GlobalStyles
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Home,
  ChevronRight,
  CalendarToday,
  People,
  AttachMoney,
  LocalDining,
  HourglassEmpty,
  TrendingDown,
  LocalBar,
  NotificationsActive,
  TaskAlt
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine
} from 'recharts';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { format, parseISO } from 'date-fns';
import { dashboardAPI } from '../../services/dashboardAPI';
import { auth } from '../../utils/auth';

// 🎨 Theme Colors
const COLORS = {
  primary: '#1d4ed8',
  secondary: '#ff6b00',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#0ea5e9',
  purple: '#6366f1'
};

// 🎭 Animation Variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } }
};

const scaleIn = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { duration: 0.4 }
};

// 🎨 Global Styles
const globalStyles = {
  ':root': {
    '--primary': COLORS.primary,
    '--secondary': COLORS.secondary,
    '--bg-start': 'rgba(240,245,250,1)',
    '--bg-mid': 'rgba(229,236,243,1)',
    '--bg-end': 'rgba(215,226,239,1)',
    '--card-radius': '16px',
    '--glass-bg': 'rgba(255,255,255,0.98)',
    '--soft-shadow': '0 14px 36px rgba(8,12,30,0.08)'
  },
  'html, body, #root': {
    height: '100%',
    margin: 0,
    padding: 0,
    background: 'radial-gradient(560px 220px at 6% 10%, rgba(59,93,180,0.06), transparent), radial-gradient(380px 180px at 92% 86%, rgba(255,107,0,0.04), transparent), linear-gradient(180deg, var(--bg-start) 0%, var(--bg-mid) 45%, var(--bg-end) 100%)',
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    color: '#0f172a'
  },
  '.glass-card': {
    backdropFilter: 'blur(8px) saturate(110%) !important',
    background: 'linear-gradient(180deg, var(--glass-bg), rgba(255,255,255,0.96)) !important',
    borderRadius: 'var(--card-radius)',
    border: '1px solid rgba(15,23,42,0.08) !important',
    boxShadow: 'var(--soft-shadow) !important',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease'
  },
  '.glass-card:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 20px 50px rgba(8,12,30,0.12) !important'
  },
  '.hero-card': {
    background: `linear-gradient(135deg, ${COLORS.secondary} 0%, ${COLORS.warning} 100%) !important`,
    color: 'white !important',
    borderRadius: 'var(--card-radius)',
    boxShadow: '0 28px 76px rgba(8,12,30,0.15) !important'
  }
};

// 📊 Dashboard Component
const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('today');
  const [chartPeriod, setChartPeriod] = useState('monthly');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date().toISOString());

  const userInfo = auth.getUserInfo();
  const isManager = userInfo?.role === 'manager';

  // 🔄 Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getStats(period);
      if (response.data.ok) {
        setStats(response.data.data);
        setLastUpdate(response.data.data.lastUpdated || new Date().toISOString());
        setError('');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStats]);

  // 📊 Data Extraction
  const {
    totalBookings = 0,
    waitingBookings = 0,
    approvedBookings = 0,
    completedBookings = 0,
    checkedInBookings = 0,
    cancelledBookings = 0
  } = useMemo(() => ({
    totalBookings: stats?.bookings?.total || 0,
    waitingBookings: stats?.bookings?.byStatus?.waiting || 0,
    approvedBookings: stats?.bookings?.byStatus?.approved || 0,
    completedBookings: stats?.bookings?.byStatus?.completed || 0,
    checkedInBookings: stats?.bookings?.byStatus?.checked_in || 0,
    cancelledBookings: stats?.bookings?.byStatus?.cancelled || 0
  }), [stats]);

  const {
    totalPayments = 0,
    verifiedPayments = 0,
    pendingPayments = 0,
    rejectedPayments = 0
  } = useMemo(() => ({
    totalPayments: stats?.payments?.total || 0,
    verifiedPayments: stats?.payments?.byStatus?.verified || 0,
    pendingPayments: stats?.payments?.byStatus?.pending || 0,
    rejectedPayments: stats?.payments?.byStatus?.rejected || 0
  }), [stats]);

  const {
    totalRevenue = 0,
    roomRevenue = 0,
    foodRevenue = 0,
    paidRevenue = 0,
    pendingRevenue = 0,
    depositCollected = 0
  } = useMemo(() => ({
    totalRevenue: stats?.revenue?.totalRevenue || 0,
    roomRevenue: stats?.revenue?.roomRevenue || 0,
    foodRevenue: stats?.revenue?.foodRevenue || 0,
    paidRevenue: stats?.revenue?.paidRevenue || stats?.revenue?.roomRevenue || 0,
    pendingRevenue: stats?.revenue?.pendingRevenue || 0,
    depositCollected: stats?.revenue?.depositCollected || 0
  }), [stats]);

  const activeGuests = checkedInBookings;
  const cancellationRate = totalBookings ? (cancelledBookings / totalBookings) * 100 : 0;
  const collectionRate = totalRevenue ? (paidRevenue / totalRevenue) * 100 : 0;

  const periodLabel = useMemo(() => {
    const labels = { today: 'Today', week: 'This Week', month: 'This Month' };
    return labels[period] || 'Today';
  }, [period]);

  const lastUpdatedLabel = useMemo(() => {
    try {
      return `Last updated: ${format(parseISO(lastUpdate), 'MMM dd, yyyy HH:mm:ss')}`;
    } catch {
      return `Last updated: ${format(new Date(lastUpdate), 'MMM dd, yyyy HH:mm:ss')}`;
    }
  }, [lastUpdate]);

  // 📈 Chart Data
  const salesChartData = useMemo(() => {
    const trends = stats?.bookings?.trends || [];

    if (chartPeriod === 'monthly' && trends.length > 0) {
      return trends.map(t => ({
        month: format(new Date(t.date), 'MMM dd'),
        value: t.revenue || 0,
        target: totalRevenue * 0.8
      }));
    }

    const fallbackData = {
      quarterly: [
        { month: 'Q1', value: totalRevenue * 0.7, target: totalRevenue * 0.8 },
        { month: 'Q2', value: totalRevenue * 0.75, target: totalRevenue * 0.8 },
        { month: 'Q3', value: totalRevenue * 0.8, target: totalRevenue * 0.8 },
        { month: 'Q4', value: totalRevenue, target: totalRevenue * 0.8 }
      ],
      annually: [
        { month: '2020', value: totalRevenue * 0.6, target: totalRevenue * 0.8 },
        { month: '2021', value: totalRevenue * 0.7, target: totalRevenue * 0.8 },
        { month: '2022', value: totalRevenue * 0.8, target: totalRevenue * 0.8 },
        { month: '2023', value: totalRevenue * 0.9, target: totalRevenue * 0.8 },
        { month: '2024', value: totalRevenue, target: totalRevenue * 0.8 }
      ]
    };

    return fallbackData[chartPeriod] || [];
  }, [stats, chartPeriod, totalRevenue]);

  // 🚨 Operational Alerts
  const operationalAlerts = useMemo(() => {
    const alerts = [
      waitingBookings > 0 && {
        id: 'waiting-bookings',
        label: `${waitingBookings} booking${waitingBookings > 1 ? 's' : ''} pending approval`,
        detail: 'เร่งตรวจสอบการจองเพื่อรักษาความเร็วในการตอบกลับ',
        color: COLORS.warning,
        icon: HourglassEmpty,
        path: '/admin/reservation?tab=pending'
      },
      pendingPayments > 0 && {
        id: 'pending-payments',
        label: `${pendingPayments} payment${pendingPayments > 1 ? 's' : ''} awaiting verification`,
        detail: 'ติดตามทีมการเงินเพื่อปิดยอดให้เร็วขึ้น',
        color: COLORS.danger,
        icon: AttachMoney,
        path: '/admin/slip'
      },
      rejectedPayments > 0 && {
        id: 'rejected-payments',
        label: `${rejectedPayments} payment${rejectedPayments > 1 ? 's' : ''} rejected`,
        detail: 'ควรติดต่อแขกหรือค่ายบัญชีเพื่อหาสาเหตุ',
        color: COLORS.purple,
        icon: TrendingDown,
        path: '/admin/slip?tab=rejected'
      },
      cancellationRate > 5 && {
        id: 'high-cancel',
        label: `Cancellation rate at ${cancellationRate.toFixed(1)}%`,
        detail: 'ตรวจสอบเหตุผลการยกเลิกเพื่อป้องกันการสูญเสียรายได้',
        color: COLORS.info,
        icon: NotificationsActive,
        path: '/admin/reservation?tab=cancelled'
      }
    ];
    return alerts.filter(Boolean);
  }, [waitingBookings, pendingPayments, rejectedPayments, cancellationRate]);

  // 🎯 Loading & Error States
  if (loading && !stats) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress size={60} thickness={4} sx={{ color: COLORS.secondary }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', p: { xs: 2, md: 4 } }}>
      <GlobalStyles styles={globalStyles} />

      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        {/* 🏠 Breadcrumbs */}
        <motion.div {...fadeInUp}>
          <Stack direction="row" alignItems="center" gap={1} mb={3}>
            <Home fontSize="small" sx={{ color: COLORS.secondary }} />
            <Breadcrumbs separator={<ChevronRight fontSize="small" />}>
              <Link underline="hover" color="inherit" href="/admin/dashboard">Home</Link>
              <Typography color="primary" fontWeight={600}>Dashboard</Typography>
            </Breadcrumbs>
          </Stack>
        </motion.div>

        <motion.div variants={staggerContainer} initial="initial" animate="animate">
          <Grid container spacing={3}>
            {/* 🎯 Hero Card */}
            <Grid item xs={12} md={7} >
              <motion.div variants={scaleIn}>
                <Card className="hero-card" sx={{ height: '100%', position: 'relative', overflow: 'hidden', minHeight: 400, minWidth: 580 }}>
                  <CardContent sx={{ p: 4, position: 'relative', zIndex: 1 }}>
                    <Typography variant="overline" sx={{ letterSpacing: 1.5, opacity: 0.9 }}>
                      {period.toUpperCase()} OVERVIEW
                    </Typography>
                    <Typography variant="h4" fontWeight={700} sx={{ my: 1 }}>
                      {isManager ? 'Executive Performance Center' : 'Operations Control Room'}
                    </Typography>
                    <Typography variant="body2" sx={{ maxWidth: 520, opacity: 0.95, mb: 4 }}>
                      ติดตามประสิทธิภาพธุรกิจแบบเรียลไทม์ ทั้งยอดรายได้ ผู้ใช้งาน และสถานะการจอง
                    </Typography>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} divider={<Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                          <AttachMoney />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Revenue</Typography>
                          <Typography variant="h5" fontWeight={700}>
                            ฿<CountUp end={totalRevenue} duration={1.4} separator="," decimals={2} />
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                          <People />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ opacity: 0.9 }}>Active Guests</Typography>
                          <Typography variant="h5" fontWeight={700}>
                            <CountUp end={activeGuests} duration={1.4} /> คน
                          </Typography>
                        </Box>
                      </Stack>
                    </Stack>

                    <Chip
                      icon={<CalendarToday sx={{ fontSize: 16 }} />}
                      label={lastUpdatedLabel}
                      size="small"
                      sx={{ mt: 4, bgcolor: 'rgba(255,255,255,0.15)', color: 'white', borderRadius: 2, fontWeight: 600 }}
                    />
                  </CardContent>
                  <Box sx={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%', opacity: 0.1, background: 'url(/admin-texture.svg)', backgroundSize: 'cover' }} />
                </Card>
              </motion.div>
            </Grid>

            {/* 🎛️ Control Center */}
            <Grid item xs={12} md={5}>
              <motion.div variants={scaleIn}>
                <Card
                  className="glass-card"
                  sx={{
                    p: 3,
                    height: '100%',
                    minWidth: 480,
                    minHeight: 400, // ⬅️ บังคับความสูงเท่ากันเสมอ
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* 🔹 Header */}
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" fontWeight={700}>
                      Control Center
                    </Typography>

                    {/* 🔸 Buttons */}
                    <Stack direction="row" spacing={1}>
                      <Tooltip title={autoRefresh ? 'Auto-refresh ON' : 'Enable auto-refresh'}>
                        <IconButton
                          onClick={() => setAutoRefresh(prev => !prev)}
                          sx={{
                            bgcolor: autoRefresh ? COLORS.secondary : 'rgba(226,232,240,0.8)',
                            color: autoRefresh ? '#fff' : '#1e293b',
                            transition: '0.3s',
                            '&:hover': { bgcolor: autoRefresh ? '#e55e00' : 'rgba(203,213,225,0.9)' },
                          }}
                        >
                          {autoRefresh ? <PauseIcon /> : <PlayIcon />}
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Refresh now">
                        <IconButton
                          onClick={fetchStats}
                          disabled={loading}
                          sx={{
                            bgcolor: 'rgba(226,232,240,0.8)',
                            color: COLORS.secondary,
                            '&:hover': { bgcolor: 'rgba(203,213,225,0.9)' },
                          }}
                        >
                          <RefreshIcon
                            sx={{
                              animation: loading ? 'rotation 1s linear infinite' : 'none',
                              '@keyframes rotation': {
                                from: { transform: 'rotate(0deg)' },
                                to: { transform: 'rotate(360deg)' },
                              },
                            }}
                          />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  {/* 🔹 Period Toggle */}
                  <ToggleButtonGroup
                    value={period}
                    exclusive
                    onChange={(_, val) => val && setPeriod(val)}
                    size="small"
                    fullWidth
                    sx={{
                      gap: 1,
                      mb: 3,
                      '& .MuiToggleButton-root': {
                        flex: 1,
                        fontWeight: 600,
                        textTransform: 'none',
                        borderRadius: '10px !important',
                        py: 1.2,
                        border: 'none',
                        bgcolor: 'rgba(255,255,255,0.6)',
                        transition: '0.3s',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.8)' },
                        '&.Mui-selected': {
                          bgcolor: `${COLORS.secondary} !important`,
                          color: '#fff !important',
                          '&:hover': { bgcolor: '#e55e00 !important' },
                        },
                      },
                    }}
                  >
                    {['today', 'week', 'month'].map(val => (
                      <ToggleButton key={val} value={val}>
                        {val.charAt(0).toUpperCase() + val.slice(1)}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>

                  <Divider sx={{ mb: 2 }} />

                  {/* 🔹 Alerts Section */}
                  <Stack spacing={2} sx={{ flexGrow: 1 }}>
                    {operationalAlerts.length > 0 ? (
                      operationalAlerts.map(alert => {
                        const Icon = alert.icon;
                        return (
                          <motion.div
                            key={alert.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            transition={{ duration: 0.3 }}
                          >
                            <Stack
                              direction="row"
                              spacing={2}
                              alignItems="center"
                              onClick={() => alert.path && navigate(alert.path)}
                              sx={{
                                p: 2,
                                borderRadius: 3,
                                bgcolor: `${alert.color}15`,
                                border: `1px solid ${alert.color}40`,
                                cursor: 'pointer',
                                transition: 'all 0.25s ease',
                                '&:hover': {
                                  bgcolor: `${alert.color}25`,
                                  boxShadow: `0 4px 12px ${alert.color}25`,
                                },
                              }}
                            >
                              <Avatar sx={{ bgcolor: `${alert.color}25`, color: alert.color }}>
                                <Icon />
                              </Avatar>
                              <Box>
                                <Typography variant="subtitle2" fontWeight={700}>
                                  {alert.label}
                                </Typography> 
                                <Typography variant="body2" color="text.secondary">
                                  {alert.detail}
                                </Typography>
                              </Box>
                            </Stack>
                          </motion.div>
                        );
                      })
                    ) : (
                      <Stack
                        alignItems="center"
                        justifyContent="center"
                        spacing={1}
                        sx={{ flexGrow: 1, color: '#64748b', minHeight: 200 }}
                      >
                        <TaskAlt fontSize="large" />
                        <Typography variant="body2">All systems optimal</Typography>
                      </Stack>
                    )}
                  </Stack>
                </Card>
              </motion.div>
            </Grid>

            {/* 📊 Sales Analytics Chart */}
            <Grid item xs={12} md={8} >
              <motion.div variants={fadeInUp}>
                <Card
                  className="glass-card"
                  sx={{
                    p: 3,
                    height: "100%",
                    minWidth: 430, // ⬅️ บังคับความสูงเท่ากันเสมอ
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* 🔹 Header */}
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={11.5}
                    minWidth={530}
                  >
                    <Box>
                      <Typography variant="h6" fontWeight={700}>
                        Sales Analytics
                      </Typography>
                      <Typography variant="body1" color="text.secondary">
                        รายละเอียดการขายในช่วง {periodLabel.toLowerCase()}
                      </Typography>
                    </Box>

                    {/* 🔸 Period Selector */}
                    <ToggleButtonGroup
                      value={chartPeriod}
                      exclusive
                      onChange={(_, val) => val && setChartPeriod(val)}
                      size="small"
                      sx={{
                        gap: 0.5,
                        "& .MuiToggleButton-root": {
                          textTransform: "none",
                          px: 2,
                          py: 0.75,
                          border: "none",
                          borderRadius: "8px !important",
                          color: "#64748b",
                          "&.Mui-selected": {
                            bgcolor: "#1e293b !important",
                            color: "white !important",
                          },
                        },
                      }}
                    >
                      {["monthly", "quarterly", "annually"].map((val) => (
                        <ToggleButton key={val} value={val}>
                          {val.charAt(0).toUpperCase() + val.slice(1)}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Stack>

                  {/* 🔹 Chart Container */}
                  <Box
                    sx={{
                      flexGrow: 1,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      minHeight: 350, // ⬅️ Force ความสูงให้เท่ากับตอนมีกราฟ
                      position: "relative",
                      transition: "all 0.3s ease",
                    }}
                  >
                    {salesChartData && salesChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={350}>
                        <AreaChart
                          data={salesChartData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                              <stop
                                offset="5%"
                                stopColor={COLORS.secondary}
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="95%"
                                stopColor={COLORS.secondary}
                                stopOpacity={0.05}
                              />
                            </linearGradient>
                          </defs>

                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                          <XAxis
                            dataKey="month"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#6b7280", fontSize: 12 }}
                            dy={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#6b7280", fontSize: 12 }}
                            tickFormatter={(val) => `฿${(val / 1000).toFixed(0)}k`}
                          />
                          <RechartsTooltip
                            contentStyle={{
                              backgroundColor: "white",
                              border: "1px solid #e5e7eb",
                              borderRadius: 8,
                              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                            }}
                            labelStyle={{ color: "#111827", fontWeight: 600 }}
                            formatter={(val) => [`฿${val.toLocaleString()}`, "Revenue"]}
                          />
                          <ReferenceLine
                            y={totalRevenue * 0.8}
                            stroke={COLORS.primary}
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            label={{
                              value: `Target: ฿${((totalRevenue * 0.8) / 1000).toFixed(0)}k`,
                              position: "right",
                              fill: COLORS.primary,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke={COLORS.secondary}
                            strokeWidth={3}
                            fill="url(#colorSales)"
                            animationDuration={800}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      // 🔸 Placeholder แทน chart
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          color: "#64748b",
                        }}
                      >
                        <Typography variant="h6" fontWeight={600} mb={1}>
                          ⚠️ ไม่มีข้อมูล
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          ไม่พบข้อมูลการขายในช่วงเวลานี้
                        </Typography>
                      </motion.div>
                    )}
                  </Box>
                </Card>
              </motion.div>
            </Grid>



            {/* 💰 Revenue Breakdown */}
            <Grid item xs={12} md={4}>
              <motion.div variants={fadeInUp}>
                <Card className="glass-card" sx={{ p: 3, height: '100%', minWidth: 475 }}>
                  <Typography variant="h6" fontWeight={700} mb={1}>Revenue Breakdown</Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>รายละเอียดรายได้ตามประเภท</Typography>

                  <Stack spacing={2.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ bgcolor: `${COLORS.secondary}20`, color: COLORS.secondary, width: 48, height: 48 }}>
                          <AttachMoney />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={600}>Total Revenue</Typography>
                          <Typography variant="caption" color="text.secondary">ยอดรวมทั้งหมด</Typography>
                        </Box>
                      </Stack>
                      <Typography variant="h6" fontWeight={700} color={COLORS.secondary}>
                        ฿<CountUp end={totalRevenue} duration={1.2} separator="," decimals={2} />
                      </Typography>
                    </Stack>

                    <Divider />

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ bgcolor: `${COLORS.primary}15`, color: COLORS.primary }}>
                          <Home />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={600}>Room Revenue</Typography>
                          <Typography variant="caption" color="text.secondary">รายได้จากห้องพัก</Typography>
                        </Box>
                      </Stack>
                      <Typography variant="body1" fontWeight={600}>
                        ฿<CountUp end={roomRevenue} duration={1.2} separator="," decimals={2} />
                      </Typography>
                    </Stack>

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ bgcolor: `${COLORS.warning}15`, color: COLORS.warning }}>
                          <LocalDining />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={600}>Food Revenue</Typography>
                          <Typography variant="caption" color="text.secondary">รายได้จากอาหาร</Typography>
                        </Box>
                      </Stack>
                      <Typography variant="body1" fontWeight={600}>
                        ฿<CountUp end={foodRevenue} duration={1.2} separator="," decimals={2} />
                      </Typography>
                    </Stack>

                    <Divider />

                    <Box>
                      <Stack direction="row" justifyContent="space-between" mb={1}>
                        <Typography variant="subtitle2" color="text.secondary">Collection Rate</Typography>
                        <Typography variant="subtitle2" fontWeight={700} color={COLORS.success}>
                          {collectionRate.toFixed(1)}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(collectionRate, 100)}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          bgcolor: '#e2e8f0',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 4,
                            bgcolor: collectionRate >= 80 ? COLORS.success : collectionRate >= 60 ? COLORS.warning : COLORS.danger
                          }
                        }}
                      />
                    </Box>

                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Verified Payments</Typography>
                        <Typography variant="body2" fontWeight={600}>{verifiedPayments}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Pending Payments</Typography>
                        <Typography variant="body2" fontWeight={600} color="warning.main">{pendingPayments}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Pending Revenue</Typography>
                        <Typography variant="body2" fontWeight={600} color="warning.main">
                          ฿<CountUp end={pendingRevenue} duration={1.2} separator="," decimals={2} />
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Deposit Collected</Typography>
                        <Typography variant="body2" fontWeight={600} color="success.main">
                          ฿<CountUp end={depositCollected} duration={1.2} separator="," decimals={2} />
                        </Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                </Card>
              </motion.div>
            </Grid>

            {/* 📋 Bookings Summary */}
            <Grid item xs={12} md={6}>
              <motion.div variants={fadeInUp}>
                <Card className="glass-card" sx={{ p: 3, height: '100%', minHeight: 420 }}>
                  <Typography variant="h6" fontWeight={700} mb={1}>Bookings Summary</Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    สถานะการจองในช่วง {periodLabel.toLowerCase()}
                  </Typography>

                  <Stack spacing={2.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" color="text.secondary">Total Bookings</Typography>
                        <Typography variant="h4" fontWeight={700}>{totalBookings}</Typography>
                      </Box>
                      <LocalBar sx={{ fontSize: 50, color: COLORS.secondary, opacity: 0.2 }} />
                    </Stack>

                    <Divider />

                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Box sx={{ p: 2, bgcolor: `${COLORS.warning}10`, borderRadius: 2, border: `1px solid ${COLORS.warning}30`, textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">Waiting</Typography>
                            <Typography variant="h5" fontWeight={700} color={COLORS.warning}>{waitingBookings}</Typography>
                          </Box>
                        </motion.div>
                      </Grid>
                      <Grid item xs={6}>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Box sx={{ p: 2, bgcolor: `${COLORS.success}10`, borderRadius: 2, border: `1px solid ${COLORS.success}30`, textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">Approved</Typography>
                            <Typography variant="h5" fontWeight={700} color={COLORS.success}>{approvedBookings}</Typography>
                          </Box>
                        </motion.div>
                      </Grid>
                      <Grid item xs={6}>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Box sx={{ p: 2, bgcolor: `${COLORS.primary}10`, borderRadius: 2, border: `1px solid ${COLORS.primary}30`, textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">Checked In</Typography>
                            <Typography variant="h5" fontWeight={700} color={COLORS.primary}>{checkedInBookings}</Typography>
                          </Box>
                        </motion.div>
                      </Grid>
                      <Grid item xs={6}>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Box sx={{ p: 2, bgcolor: '#64748b10', borderRadius: 2, border: '1px solid #64748b30', textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">Completed</Typography>
                            <Typography variant="h5" fontWeight={700} color="#64748b">{completedBookings}</Typography>
                          </Box>
                        </motion.div>
                      </Grid>
                    </Grid>

                    {cancelledBookings > 0 && (
                      <>
                        <Divider />
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" color="text.secondary">Cancelled Bookings</Typography>
                          <Typography variant="h6" fontWeight={700} color={COLORS.danger}>{cancelledBookings}</Typography>
                        </Stack>
                      </>
                    )}
                  </Stack>
                </Card>
              </motion.div>
            </Grid>

            {/* 💳 Payments Summary */}
            <Grid item xs={12} md={6} >
              <motion.div variants={fadeInUp}>
                <Card className="glass-card" sx={{ p: 3, height: '100%', minWidth: 590   }}>
                  <Typography variant="h6" fontWeight={700} mb={1}>Payments Summary</Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    สถานะการชำระเงินในช่วง {periodLabel.toLowerCase()}
                  </Typography>

                  <Stack spacing={2.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" color="text.secondary">Total Payments</Typography>
                        <Typography variant="h4" fontWeight={700}>{totalPayments}</Typography>
                      </Box>
                      <AttachMoney sx={{ fontSize: 50, color: COLORS.success, opacity: 0.2 }} />
                    </Stack>

                    <Divider />

                    <Grid container spacing={2}>
                      <Grid item xs={4}>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Box sx={{ p: 2, bgcolor: `${COLORS.warning}10`, borderRadius: 2, border: `1px solid ${COLORS.warning}30`, textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">Pending</Typography>
                            <Typography variant="h5" fontWeight={700} color={COLORS.warning}>{pendingPayments}</Typography>
                          </Box>
                        </motion.div>
                      </Grid>
                      <Grid item xs={4}>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Box sx={{ p: 2, bgcolor: `${COLORS.success}10`, borderRadius: 2, border: `1px solid ${COLORS.success}30`, textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">Verified</Typography>
                            <Typography variant="h5" fontWeight={700} color={COLORS.success}>{verifiedPayments}</Typography>
                          </Box>
                        </motion.div>
                      </Grid>
                      <Grid item xs={4}>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Box sx={{ p: 2, bgcolor: `${COLORS.danger}10`, borderRadius: 2, border: `1px solid ${COLORS.danger}30`, textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">Rejected</Typography>
                            <Typography variant="h5" fontWeight={700} color={COLORS.danger}>{rejectedPayments}</Typography>
                          </Box>
                        </motion.div>
                      </Grid>
                    </Grid>

                    <Divider />

                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Total Paid Revenue</Typography>
                        <Typography variant="body2" fontWeight={700} sx={{ color: COLORS.success }}>
                          ฿{paidRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Pending Revenue</Typography>
                        <Typography variant="body2" fontWeight={700} sx={{ color: COLORS.warning }}>
                          ฿{pendingRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                </Card>
              </motion.div>
            </Grid>
          </Grid>
        </motion.div>
      </Box>
    </Box>
  );
};

export default Dashboard;