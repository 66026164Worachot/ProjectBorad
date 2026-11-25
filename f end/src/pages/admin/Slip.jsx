import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, IconButton, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Alert, Snackbar, CircularProgress, Avatar, Tooltip,
  Breadcrumbs, Link, ToggleButtonGroup, ToggleButton, Stack,
  TablePagination, Divider, Badge
} from '@mui/material';
import {
  Visibility, CheckCircle, Cancel, Refresh, Search,
  Home, ChevronRight, Receipt, AttachMoney, FilterList,
  CalendarToday, Person, CreditCard, AccountBalance,
  Close as CloseIcon, Fastfood, LocalOffer
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import axios from 'axios';
import { auth } from '../../utils/auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const formatCurrency = (value) => `฿${Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;

const formatDiscountLabel = (promotion) => {
  if (!promotion) return '';
  if (promotion.discount_type === 'percentage') {
    return `${promotion.discount_value}%`;
  }
  return formatCurrency(promotion.discount_value);
};

const getBookingStatusColor = (status) => {
  switch (status) {
    case 'waiting':
      return 'warning';
    case 'approved':
    case 'checked_in':
      return 'info';
    case 'checked_out':
    case 'completed':
      return 'success';
    case 'rejected':
    case 'cancelled':
      return 'error';
    default:
      return 'default';
  }
};

const getBookingPaymentColor = (status) => {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'deposit_paid':
      return 'info';
    case 'paid':
      return 'success';
    default:
      return 'default';
  }
};

const formatDateTime = (value) => {
  if (!value) return '-';
  try {
    return format(new Date(value), 'dd MMM yyyy HH:mm');
  } catch (error) {
    return value;
  }
};

const Slip = () => {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalPayments, setTotalPayments] = useState(0);
  
  // Dialog
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [bookingDetails, setBookingDetails] = useState(null);
  const [foodOrderDetails, setFoodOrderDetails] = useState(null);
  const [foodOrderNotFound, setFoodOrderNotFound] = useState(false);

  const userInfo = auth.getUserInfo();

  const bookingInfo = selectedPayment ? (bookingDetails || selectedPayment.booking) : null;
  const promotionInfo = bookingDetails?.promotion || null;
  const foodItems = foodOrderDetails?.items || [];
  const isFoodTransaction = !!selectedPayment?.transaction_ref?.startsWith('FOOD-');

  useEffect(() => {
    fetchPayments();
    fetchStats();
  }, [statusFilter, searchQuery, page, rowsPerPage]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/payments', {
        params: {
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: searchQuery,
          page: page + 1,
          limit: rowsPerPage,
          sortBy: 'created_at',
          sortOrder: 'desc'
        }
      });

      if (response.data.ok) {
        setPayments(response.data.data.payments);
        setTotalPayments(response.data.data.pagination.total);
      }
    } catch (err) {
      setError('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/api/payments/stats');
      if (response.data.ok) {
        setStats(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const fetchPaymentDetails = async (payment) => {
    if (!payment) return;

    setDetailLoading(true);
    setDetailError('');
    setBookingDetails(null);
    setFoodOrderDetails(null);
    setFoodOrderNotFound(false);

    try {
      if (payment.booking_id) {
        try {
          const bookingRes = await api.get(`/api/reservations/${payment.booking_id}`);
          if (bookingRes.data?.ok) {
            setBookingDetails(bookingRes.data.data);
          }
        } catch (bookingErr) {
          console.error('Failed to load booking details:', bookingErr);
          setDetailError((prev) => prev || bookingErr.response?.data?.error?.message || 'ไม่สามารถโหลดข้อมูลการจองได้');
        }
      }

      if (payment.transaction_ref?.startsWith('FOOD-')) {
        const orderNumber = payment.transaction_ref.replace('FOOD-', '');
        if (orderNumber) {
          try {
            const listRes = await api.get('/api/menu/orders', {
              params: {
                search: orderNumber,
                page: 1,
                limit: 1
              }
            });

            const orders = listRes.data?.data?.orders || [];
            if (orders.length > 0) {
              const orderRes = await api.get(`/api/menu/orders/${orders[0].id}`);
              if (orderRes.data?.ok) {
                setFoodOrderDetails(orderRes.data.data);
              }
            } else {
              setFoodOrderNotFound(true);
            }
          } catch (orderErr) {
            console.error('Failed to load food order details:', orderErr);
            setDetailError((prev) => prev || orderErr.response?.data?.error?.message || 'ไม่สามารถโหลดรายละเอียดอาหารได้');
          }
        }
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const handleVerifyPayment = async (id) => {
    try {
      const response = await api.patch(`/api/payments/${id}/verify`);
      if (response.data.ok) {
        setSuccess('Payment verified successfully');
        fetchPayments();
        fetchStats();
        setOpenDialog(false);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to verify payment');
    }
  };

  const handleRejectPayment = async (id) => {
    if (!rejectReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }

    try {
      const response = await api.patch(`/api/payments/${id}/reject`, {
        reason: rejectReason
      });
      if (response.data.ok) {
        setSuccess('Payment sent back to rejected status');
        fetchPayments();
        fetchStats();
        setOpenDialog(false);
        setRejectReason('');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to reject payment');
    }
  };

  const handleOpenDialog = (payment) => {
    setSelectedPayment(payment);
    setOpenDialog(true);
    fetchPaymentDetails(payment);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedPayment(null);
    setRejectReason('');
    setBookingDetails(null);
    setFoodOrderDetails(null);
    setFoodOrderNotFound(false);
    setDetailError('');
    setDetailLoading(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'verified': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getPaymentTypeLabel = (type) => {
    switch (type) {
      case 'deposit': return 'Deposit (10%)';
      case 'remaining': return 'Remaining (90%)';
      case 'full_payment': return 'Full Payment';
      default: return type;
    }
  };

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'bank_transfer': return <AccountBalance />;
      case 'credit_card': return <CreditCard />;
      default: return <AttachMoney />;
    }
  };

  const reservationTimeline = () => {
    if (!bookingInfo) return [];

    return [
      { label: 'สร้างการจอง', value: bookingInfo.created_at },
      { label: 'อนุมัติ', value: bookingInfo.approved_at },
      { label: 'เช็คอิน', value: bookingInfo.checked_in_at },
      { label: 'เช็คเอาท์', value: bookingInfo.checked_out_at },
      { label: 'จ่ายมัดจำ', value: bookingInfo.deposit_paid_at },
      { label: 'จ่ายยอดที่เหลือ', value: bookingInfo.remaining_paid_at }
    ].filter((event) => event.value);
  };

  const timelineEvents = reservationTimeline();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc' }}>
      <Box sx={{ maxWidth: 1800, mx: 'auto', p: { xs: 2, sm: 3, md: 4 } }}>
        
        {/* Header */}
        <Box mb={4}>
          <Box display="flex" alignItems="center" mb={2}>
            <Home fontSize="small" sx={{ color: '#3b82f6', mr: 1 }} />
            <Breadcrumbs separator={<ChevronRight fontSize="small" />}>
              <Link underline="hover" color="inherit" href="/admin/dashboard">Home</Link>
              <Typography color="primary" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                Payment Slips
              </Typography>
            </Breadcrumbs>
          </Box>

          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box>
              <Typography variant="h4" fontWeight="700" sx={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 0.5
              }}>
                💳 Payment Slip Verification
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Review and verify customer payment slips
              </Typography>
            </Box>

            <Tooltip title="Refresh">
              <IconButton 
                onClick={fetchPayments}
                disabled={loading}
                sx={{ 
                  bgcolor: 'white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  '&:hover': { bgcolor: '#f1f5f9' }
                }}
              >
                <Refresh className={loading ? 'spin' : ''} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Stats Cards */}
        {stats && (
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                borderRadius: 3,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
              }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5 }}>
                        Pending
                      </Typography>
                      <Typography variant="h3" fontWeight="700">
                        {stats.byStatus?.pending || 0}
                      </Typography>
                    </Box>
                    <Badge badgeContent={stats.byStatus?.pending || 0} color="error">
                      <Receipt sx={{ fontSize: 40, opacity: 0.9 }} />
                    </Badge>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                borderRadius: 3,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5 }}>
                        Verified
                      </Typography>
                      <Typography variant="h3" fontWeight="700">
                        {stats.byStatus?.verified || 0}
                      </Typography>
                    </Box>
                    <CheckCircle sx={{ fontSize: 40, opacity: 0.9 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                borderRadius: 3,
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
              }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5 }}>
                        Rejected
                      </Typography>
                      <Typography variant="h3" fontWeight="700">
                        {stats.byStatus?.rejected || 0}
                      </Typography>
                    </Box>
                    <Cancel sx={{ fontSize: 40, opacity: 0.9 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                borderRadius: 3,
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5 }}>
                        Total Amount
                      </Typography>
                      <Typography variant="h4" fontWeight="700">
                        ฿{(stats.verifiedAmount || 0).toLocaleString()}
                      </Typography>
                    </Box>
                    <AttachMoney sx={{ fontSize: 40, opacity: 0.9 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Filters */}
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField
              placeholder="Search by customer, email, phone, or transaction ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              sx={{ flexGrow: 1 }}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />

            <ToggleButtonGroup
              value={statusFilter}
              exclusive
              onChange={(e, val) => val && setStatusFilter(val)}
              size="small"
            >
              <ToggleButton value="pending">Pending</ToggleButton>
              <ToggleButton value="verified">Verified</ToggleButton>
              <ToggleButton value="rejected">Rejected</ToggleButton>
              <ToggleButton value="all">All</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Paper>

        {/* Payments Table */}
        <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Transaction</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Booking Info</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Method</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                      <Typography color="text.secondary">No payments found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="600">
                          {payment.transaction_ref}
                        </Typography>
                        <Chip 
                          label={getPaymentTypeLabel(payment.payment_type)}
                          size="small"
                          sx={{ mt: 0.5, fontSize: '0.7rem' }}
                        />
                      </TableCell>

                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: '#3b82f6' }}>
                            {payment.user?.full_name ? 
                              payment.user.full_name.charAt(0).toUpperCase() : 
                              payment.user?.email ? 
                                payment.user.email.charAt(0).toUpperCase() : 
                                '?'}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight="600">
                              {payment.user?.full_name || payment.user?.email || 'Unknown'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {payment.user?.email || 'No email'}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" fontWeight="500">
                          Table {payment.booking?.table?.table_number || 'N/A'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {payment.booking?.booking_date ? 
                            format(parseISO(payment.booking.booking_date), 'MMM dd, yyyy') : 
                            'N/A'}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body1" fontWeight="700" color="primary">
                          ฿{payment.amount.toLocaleString()}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Chip
                          icon={getPaymentMethodIcon(payment.payment_method)}
                          label={payment.payment_method.replace('_', ' ')}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>

                      <TableCell>
                        <Stack spacing={0.5}>
                          <Chip
                            label={payment.payment_status}
                            color={getStatusColor(payment.payment_status)}
                            size="small"
                            sx={{ textTransform: 'capitalize', fontWeight: 600 }}
                          />
                          {payment.rejection_reason && (
                            <Typography variant="caption" color="error">
                              Needs new slip: {payment.rejection_reason}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2">
                          {format(parseISO(payment.created_at), 'MMM dd, HH:mm')}
                        </Typography>
                      </TableCell>

                      <TableCell align="center">
                        <Tooltip title="View Details">
                          <IconButton 
                            size="small" 
                            onClick={() => handleOpenDialog(payment)}
                            color="primary"
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={totalPayments}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </Paper>

        {/* Detail Dialog */}
        <Dialog 
          open={openDialog} 
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
        >
          {selectedPayment && (
            <>
              <DialogTitle>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" fontWeight="700">
                    Payment Slip Details
                  </Typography>
                  <IconButton onClick={handleCloseDialog} size="small">
                    <CloseIcon />
                  </IconButton>
                </Box>
              </DialogTitle>

              <DialogContent dividers>
                <Grid container spacing={3}>
                  {/* Slip Image */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Payment Slip
                    </Typography>
                    <Box
                      component="img"
                      src={selectedPayment.slip_image_url || 'https://via.placeholder.com/400x600?text=No+Image'}
                      alt="Payment Slip"
                      sx={{
                        width: '100%',
                        height: 'auto',
                        borderRadius: 2,
                        border: '2px solid #e5e7eb',
                        maxHeight: 500,
                        objectFit: 'contain',
                        bgcolor: '#f8fafc'
                      }}
                    />
                  </Grid>

                  {/* Payment Info */}
                  <Grid item xs={12} md={6}>
                    <Stack spacing={2.5}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Transaction Reference
                        </Typography>
                        <Typography variant="body1" fontWeight="600">
                          {selectedPayment.transaction_ref}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Customer
                        </Typography>
                        <Typography variant="body1" fontWeight="600">
                          {selectedPayment.user?.full_name || 'N/A'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {selectedPayment.user?.email}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {selectedPayment.user?.phone || 'No phone'}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Amount & Type
                        </Typography>
                        <Typography variant="h5" fontWeight="700" color="primary">
                          ฿{selectedPayment.amount.toLocaleString()}
                        </Typography>
                        <Chip
                          label={getPaymentTypeLabel(selectedPayment.payment_type)}
                          size="small"
                          sx={{ mt: 0.5 }}
                        />
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Payment Method
                        </Typography>
                        <Typography variant="body1" fontWeight="600" sx={{ textTransform: 'capitalize' }}>
                          {selectedPayment.payment_method.replace('_', ' ')}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Booking Information
                        </Typography>
                        <Typography variant="body2">
                          Table: {selectedPayment.booking?.table?.table_number || 'N/A'}
                        </Typography>
                        <Typography variant="body2">
                          Date: {selectedPayment.booking?.booking_date ? 
                            format(parseISO(selectedPayment.booking.booking_date), 'MMMM dd, yyyy') : 
                            'N/A'}
                        </Typography>
                        <Typography variant="body2">
                          Time: {selectedPayment.booking?.start_time} - {selectedPayment.booking?.end_time}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Status
                        </Typography>
                        <Box mt={0.5}>
                          <Chip
                            label={selectedPayment.payment_status}
                            color={getStatusColor(selectedPayment.payment_status)}
                            sx={{ textTransform: 'capitalize', fontWeight: 600 }}
                          />
                        </Box>
                      </Box>

                      {selectedPayment.rejection_reason && (
                        <Alert
                          severity={selectedPayment.payment_status === 'pending' ? 'warning' : 'error'}
                          sx={{ mt: 1 }}
                        >
                          {selectedPayment.payment_status === 'pending'
                            ? `Waiting for a new slip: ${selectedPayment.rejection_reason}`
                            : selectedPayment.rejection_reason}
                        </Alert>
                      )}
                    </Stack>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 3 }} />

                <Box>
                  {bookingInfo && (
                    <>
                      <Typography variant="h6" fontWeight={700} gutterBottom>
                        Reservation Management
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        ตรวจสอบสถานะการจองและความคืบหน้าการชำระเงินจากระบบจัดการการจอง
                      </Typography>

                      {bookingInfo.status === 'cancelled' && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                          การจองนี้ถูกยกเลิกแล้ว ระบบจะไม่นับยอดชำระเพิ่มเติม และโต๊ะจะกลับไปว่างสำหรับการจองใหม่
                        </Alert>
                      )}

                      <Grid container spacing={3} sx={{ my: 1 }}>
                        <Grid item xs={12} md={6}>
                          <Paper sx={{ p: 2.5, borderRadius: 2, bgcolor: '#fff7ed' }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                              <Typography variant="subtitle1" fontWeight={700}>
                                สถานะการจอง
                              </Typography>
                              <Chip
                                label={(bookingInfo.status || 'ไม่ทราบ').replace('_', ' ')}
                                color={getBookingStatusColor(bookingInfo.status)}
                                size="small"
                                sx={{ textTransform: 'capitalize' }}
                              />
                            </Stack>

                            <Stack spacing={1}>
                              <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body2">ประเภทการชำระ</Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  {bookingInfo.payment_type === 'advance' ? 'จ่ายล่วงหน้า 10% + 90%' : 'ชำระเต็มจำนวน'}
                                </Typography>
                              </Stack>
                              <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body2">ยอดรวม</Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  {formatCurrency(bookingInfo.total_amount)}
                                </Typography>
                              </Stack>
                              <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body2">มัดจำ 10%</Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  {formatCurrency(bookingInfo.deposit_amount)}
                                </Typography>
                              </Stack>
                              <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body2">ยอดคงเหลือ</Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  {formatCurrency(bookingInfo.remaining_amount || (bookingInfo.total_amount - (bookingInfo.deposit_amount || 0)))}
                                </Typography>
                              </Stack>
                              {bookingInfo.status === 'cancelled' && (
                                <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                                  ยอดการชำระทั้งหมดถูกยกเลิกแล้ว
                                </Typography>
                              )}
                              {bookingInfo.special_requests && (
                                <Box mt={2} p={1.5} borderRadius={2} bgcolor="#fff" sx={{ border: '1px dashed #fbbf24' }}>
                                  <Typography variant="caption" color="text.secondary">
                                    ความต้องการเพิ่มเติมจากลูกค้า
                                  </Typography>
                                  <Typography variant="body2">{bookingInfo.special_requests}</Typography>
                                </Box>
                              )}
                            </Stack>
                          </Paper>
                        </Grid>

                        <Grid item xs={12} md={6}>
                          <Paper sx={{ p: 2.5, borderRadius: 2, bgcolor: '#f0f9ff' }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                              <Typography variant="subtitle1" fontWeight={700}>
                                ความคืบหน้าการชำระเงิน
                              </Typography>
                              <Chip
                                label={(bookingInfo.payment_status || 'pending').replace('_', ' ')}
                                color={getBookingPaymentColor(bookingInfo.payment_status)}
                                size="small"
                                sx={{ textTransform: 'capitalize' }}
                              />
                            </Stack>

                            <Stack spacing={1.5}>
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Box>
                                  <Typography variant="body2" fontWeight={600}>ชำระมัดจำ</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {bookingInfo.status === 'cancelled'
                                      ? 'ยกเลิกแล้ว'
                                      : bookingInfo.deposit_paid
                                        ? `ชำระเมื่อ ${formatDateTime(bookingInfo.deposit_paid_at)}`
                                        : 'ยังไม่ได้ชำระ'}
                                  </Typography>
                                </Box>
                                <Chip
                                  label={bookingInfo.status === 'cancelled'
                                    ? 'ยกเลิก'
                                    : bookingInfo.deposit_paid
                                      ? 'เรียบร้อย'
                                      : 'รอดำเนินการ'}
                                  color={bookingInfo.status === 'cancelled'
                                    ? 'default'
                                    : bookingInfo.deposit_paid
                                      ? 'success'
                                      : 'default'}
                                  size="small"
                                />
                              </Box>

                              <Divider sx={{ my: 1 }} />

                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Box>
                                  <Typography variant="body2" fontWeight={600}>ยอดคงเหลือ</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {bookingInfo.status === 'cancelled'
                                      ? 'ยกเลิกแล้ว'
                                      : bookingInfo.remaining_paid
                                        ? `ชำระเมื่อ ${formatDateTime(bookingInfo.remaining_paid_at)}`
                                        : 'ยังไม่ได้ชำระ'}
                                  </Typography>
                                </Box>
                                <Chip
                                  label={bookingInfo.status === 'cancelled'
                                    ? 'ยกเลิก'
                                    : bookingInfo.remaining_paid
                                      ? 'เรียบร้อย'
                                      : 'รอดำเนินการ'}
                                  color={bookingInfo.status === 'cancelled'
                                    ? 'default'
                                    : bookingInfo.remaining_paid
                                      ? 'success'
                                      : 'default'}
                                  size="small"
                                />
                              </Box>

                              {timelineEvents.length > 0 && (
                                <Box mt={1.5}>
                                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                    ไทม์ไลน์การจอง
                                  </Typography>
                                  <Stack spacing={0.75}>
                                    {timelineEvents.map((event) => (
                                      <Stack key={event.label} direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography variant="body2">{event.label}</Typography>
                                        <Typography variant="body2" fontWeight={500}>{formatDateTime(event.value)}</Typography>
                                      </Stack>
                                    ))}
                                  </Stack>
                                </Box>
                              )}
                            </Stack>
                          </Paper>
                        </Grid>
                      </Grid>
                    </>
                  )}

                  <Divider sx={{ my: 3 }} />

                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    รายละเอียดตามหมวดหมู่
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ตรวจสอบรายละเอียดการสั่งซื้อแยกตามหมวดอาหารและห้องเกม
                  </Typography>

                  {detailError && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      {detailError}
                    </Alert>
                  )}

                  {detailLoading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" sx={{ py: 4 }}>
                      <CircularProgress size={28} />
                    </Box>
                  ) : (
                    <Grid container spacing={3} sx={{ mt: 1 }}>
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2.5, borderRadius: 2, bgcolor: '#f8fafc' }}>
                          <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Fastfood color="primary" />
                              <Typography variant="subtitle1" fontWeight={700}>
                                หมวดอาหาร
                              </Typography>
                            </Box>
                            {foodOrderDetails && (
                              <Chip
                                size="small"
                                color="primary"
                                variant="outlined"
                                label={`ยอดรวม ${formatCurrency(foodOrderDetails.total_amount)}`}
                              />
                            )}
                          </Box>

                          <Divider sx={{ my: 2 }} />

                          {foodItems.length > 0 ? (
                            <Stack spacing={1.5}>
                              {foodItems.map((item) => (
                                <Box
                                  key={item.id}
                                  display="flex"
                                  justifyContent="space-between"
                                  alignItems="flex-start"
                                  gap={2}
                                >
                                  <Box>
                                    <Typography variant="body2" fontWeight={600}>
                                      {item.menu_item?.name || 'รายการไม่ระบุ'}
                                    </Typography>
                                    {item.notes && (
                                      <Typography variant="caption" color="text.secondary">
                                        หมายเหตุ: {item.notes}
                                      </Typography>
                                    )}
                                  </Box>
                                  <Box textAlign="right">
                                    <Typography variant="caption" color="text.secondary">
                                      x{item.quantity}
                                    </Typography>
                                    <Typography variant="body2" fontWeight={600}>
                                      {formatCurrency(item.subtotal)}
                                    </Typography>
                                  </Box>
                                </Box>
                              ))}
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              {isFoodTransaction ? 'ไม่มีรายการอาหารที่สามารถแสดงได้' : 'ไม่มีการสั่งอาหารในรายการนี้'}
                            </Typography>
                          )}

                          {foodOrderDetails?.special_instructions && (
                            <Box
                              mt={2}
                              p={1.5}
                              borderRadius={2}
                              bgcolor="white"
                              sx={{ border: '1px solid #e2e8f0' }}
                            >
                              <Typography variant="caption" color="text.secondary">
                                หมายเหตุเพิ่มเติม
                              </Typography>
                              <Typography variant="body2">
                                {foodOrderDetails.special_instructions}
                              </Typography>
                            </Box>
                          )}

                          {foodOrderNotFound && isFoodTransaction && !foodItems.length && (
                            <Typography variant="body2" color="error" sx={{ mt: 2 }}>
                              ไม่พบข้อมูลคำสั่งอาหารสำหรับรายการชำระเงินนี้
                            </Typography>
                          )}
                        </Paper>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2.5, borderRadius: 2, bgcolor: '#f8fafc' }}>
                          <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <CalendarToday color="primary" />
                              <Typography variant="subtitle1" fontWeight={700}>
                                รายละเอียดการจอง
                              </Typography>
                            </Box>
                            {bookingInfo?.total_amount ? (
                              <Chip
                                size="small"
                                color="primary"
                                variant="outlined"
                                label={`ยอดจอง ${formatCurrency(bookingInfo.total_amount)}`}
                              />
                            ) : null}
                          </Box>

                          <Divider sx={{ my: 2 }} />

                          <Stack spacing={1.5}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2">โต๊ะ</Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {bookingInfo?.table?.table_number || 'N/A'}
                              </Typography>
                            </Stack>

                            {bookingInfo?.table?.category?.name ? (
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2">หมวดห้อง</Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  {bookingInfo.table.category.name}
                                </Typography>
                              </Stack>
                            ) : null}

                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2">วันที่</Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {bookingInfo?.booking_date ?
                                  format(parseISO(bookingInfo.booking_date), 'dd MMM yyyy') :
                                  'N/A'}
                              </Typography>
                            </Stack>

                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2">เวลา</Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {bookingInfo?.start_time && bookingInfo?.end_time ?
                                  `${bookingInfo.start_time} - ${bookingInfo.end_time}` :
                                  'N/A'}
                              </Typography>
                            </Stack>

                            {Number.isFinite(Number(bookingInfo?.number_of_people)) ? (
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2">จำนวนผู้เล่น</Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  {Number(bookingInfo.number_of_people)} คน
                                </Typography>
                              </Stack>
                            ) : null}

                            {bookingInfo?.status ? (
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2">สถานะการจอง</Typography>
                                <Chip
                                  size="small"
                                  label={bookingInfo.status}
                                  color={getBookingStatusColor(bookingInfo.status)}
                                />
                              </Stack>
                            ) : null}

                            {bookingInfo?.payment_status ? (
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2">สถานะการชำระเงิน</Typography>
                                <Chip
                                  size="small"
                                  label={bookingInfo.payment_status}
                                  color={getBookingPaymentColor(bookingInfo.payment_status)}
                                />
                              </Stack>
                            ) : null}
                          </Stack>

                          <Divider sx={{ my: 2 }} />

                          <Stack spacing={1}>
                            <Typography variant="caption" color="text.secondary">
                              โค้ดส่วนลด
                            </Typography>
                            {promotionInfo ? (
                              <Chip
                                icon={<LocalOffer />}
                                label={`${promotionInfo.name} (${formatDiscountLabel(promotionInfo)})`}
                                color="success"
                                size="small"
                                sx={{ mt: 1 }}
                              />
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                ไม่มีการใช้โค้ดส่วนลด
                              </Typography>
                            )}
                          </Stack>
                        </Paper>
                      </Grid>
                    </Grid>
                  )}
                </Box>

                {/* Reject Reason Input */}
                {selectedPayment.payment_status === 'pending' && (
                  <Box mt={3}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Rejection Reason"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Enter reason if rejecting this payment..."
                    />
                  </Box>
                )}
              </DialogContent>

              <DialogActions sx={{ p: 2.5 }}>
                <Button onClick={handleCloseDialog}>
                  Close
                </Button>
                
                {selectedPayment.payment_status === 'pending' && (
                  <>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<Cancel />}
                      onClick={() => handleRejectPayment(selectedPayment.id)}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<CheckCircle />}
                      onClick={() => handleVerifyPayment(selectedPayment.id)}
                    >
                      Verify Payment
                    </Button>
                  </>
                )}
              </DialogActions>
            </>
          )}
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={!!error || !!success}
          autoHideDuration={4000}
          onClose={() => {
            setError('');
            setSuccess('');
          }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert 
            severity={error ? 'error' : 'success'}
            onClose={() => {
              setError('');
              setSuccess('');
            }}
          >
            {error || success}
          </Alert>
        </Snackbar>

        {/* CSS */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin {
            animation: spin 1s linear infinite;
          }
        `}</style>
      </Box>
    </Box>
  );
};

export default Slip;