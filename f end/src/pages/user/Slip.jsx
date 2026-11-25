import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  Container as MuiContainer,
} from "@mui/material";
import InputAdornment from "@mui/material/InputAdornment";
import { format } from "date-fns";
import { UploadCloud, Receipt, Wallet, ShieldCheck, CreditCard, Sparkles } from "lucide-react";
import paymentAPI from "../../services/paymentAPI";
import { reservationAPI } from "../../services/reservationAPI";

const paymentMethods = [
  { value: "bank_transfer", label: "โอนผ่านธนาคาร" },
  { value: "promptpay", label: "พร้อมเพย์" },
  { value: "credit_card", label: "บัตรเครดิต" },
];

const formatCurrency = (value) => `฿${Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const formatDateTime = (value) => {
  if (!value) return "-";
  try {
    return format(new Date(value), "dd MMM yyyy HH:mm");
  } catch (error) {
    return value;
  }
};

function Slip() {
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    bookingId: "",
    amount: "",
    paymentMethod: "bank_transfer",
    transactionRef: "",
  });
  const [slipData, setSlipData] = useState("");
  const [slipName, setSlipName] = useState("");
  const [preview, setPreview] = useState("");

  const fileInputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError("");

      try {
        const [bookingRes, paymentRes] = await Promise.all([
          reservationAPI.getMine({ page: 1, limit: 10 }),
          paymentAPI.getMine({ limit: 15 }),
        ]);

        if (!isMounted) return;

        if (bookingRes.data?.ok) {
          const activeBookings = (bookingRes.data.data.bookings || []).filter(
            (booking) => booking.status !== "cancelled"
          );
          setBookings(activeBookings);
        }

        if (paymentRes.data?.ok) {
          setPayments(paymentRes.data.data.payments || []);
        }
      } catch (err) {
        console.error("Failed to load payment data", err);
        if (isMounted) {
          setError("ไม่สามารถโหลดข้อมูลการชำระเงินได้ กรุณาลองใหม่อีกครั้ง");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshPayments = async () => {
    try {
      const response = await paymentAPI.getMine({ limit: 15 });
      if (response.data?.ok) {
        setPayments(response.data.data.payments || []);
      }
    } catch (err) {
      console.error("Failed to refresh payments", err);
    }
  };

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === form.bookingId),
    [bookings, form.bookingId]
  );

  const recommendedAmount = useMemo(() => {
    if (!selectedBooking) return null;
    return selectedBooking.deposit_amount ?? selectedBooking.total_amount ?? null;
  }, [selectedBooking]);

  const depositPaid = useMemo(() => {
    if (!selectedBooking) return false;
    if (selectedBooking.deposit_paid) return true;
    return ["deposit_paid", "paid"].includes(selectedBooking.payment_status);
  }, [selectedBooking]);

  const existingDepositPayment = useMemo(() => {
    if (!form.bookingId) return null;
    return (
      payments.find(
        (payment) =>
          payment.payment_type === "deposit" && payment.booking?.id === form.bookingId
      ) || null
    );
  }, [payments, form.bookingId]);

  const existingSlipUrl = existingDepositPayment?.slip_image_url || "";
  const existingPaymentStatus = existingDepositPayment?.payment_status || "";
  const isUpdatingExistingPayment = Boolean(existingDepositPayment);
  const displayPreview = preview || existingSlipUrl;

  useEffect(() => {
    if (!selectedBooking) {
      setForm((prev) => ({ ...prev, amount: "" }));
      return;
    }

    const depositAmount = Number(
      selectedBooking.deposit_amount ?? selectedBooking.total_amount ?? 0
    );
    const formatted = depositAmount > 0 ? depositAmount.toFixed(2) : "";
    setForm((prev) => (prev.amount === formatted ? prev : { ...prev, amount: formatted }));
  }, [selectedBooking]);

  useEffect(() => {
    if (!existingDepositPayment) {
      setForm((prev) => (prev.transactionRef ? { ...prev, transactionRef: "" } : prev));
      return;
    }

    const transactionRef = existingDepositPayment.transaction_ref || "";
    setForm((prev) =>
      prev.transactionRef === transactionRef ? prev : { ...prev, transactionRef }
    );
  }, [existingDepositPayment]);

  useEffect(() => {
    setSlipData("");
    setSlipName("");
    setPreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [form.bookingId]);

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setMessage({ type: "error", text: "ไฟล์ต้องมีขนาดไม่เกิน 10 MB" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setSlipData(result);
        setPreview(result);
        setSlipName(file.name);
        setMessage({ type: "info", text: `เลือกไฟล์ ${file.name}` });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setMessage({ type: "", text: "" });
  };

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!form.bookingId || (!form.amount && !recommendedAmount) || !slipData) {
      setMessage({ type: "error", text: "กรอกข้อมูลและเลือกไฟล์สลิปให้ครบถ้วน" });
      return;
    }

    setUploading(true);
    setMessage({ type: "", text: "" });

    try {
      const rawAmount = form.amount || recommendedAmount || 0;
      const parsedAmount = Number.parseFloat(rawAmount);
      const normalizedAmount = Number.isFinite(parsedAmount)
        ? parsedAmount
        : Number(recommendedAmount || 0);

      const bookingIdForPayload = existingDepositPayment?.booking_id || form.bookingId;

      const basePayload = {
        amount: normalizedAmount,
        payment_method: form.paymentMethod,
        slip_image_url: slipData,
        transaction_ref: form.transactionRef || undefined,
        booking_id: bookingIdForPayload,
      };

      let response;
      if (isUpdatingExistingPayment && existingDepositPayment) {
        response = await paymentAPI.update(existingDepositPayment.id, basePayload);
      } else {
        response = await paymentAPI.create({
          ...basePayload,
          booking_id: form.bookingId,
          payment_type: "deposit",
        });
      }

      if (response.data?.ok) {
        setMessage({
          type: "success",
          text: isUpdatingExistingPayment
            ? "อัปเดตสลิปเรียบร้อย ระบบจะตรวจสอบอีกครั้ง"
            : "อัปโหลดสลิปเรียบร้อย ทีมงานจะตรวจสอบในไม่ช้า",
        });
        setSlipData("");
        setSlipName("");
        setPreview("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        refreshPayments();
      } else {
        setMessage({ type: "error", text: response.data?.error?.message || "ไม่สามารถอัปโหลดสลิปได้" });
      }
    } catch (err) {
      console.error("Upload slip failed", err);
      const apiMessage = err.response?.data?.error?.message;
      setMessage({ type: "error", text: apiMessage || "ไม่สามารถอัปโหลดสลิปได้" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box
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
      <MuiContainer maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
        {/* Hero Header */}
        <Paper
          elevation={8}
          sx={{
            p: { xs: 3, sm: 4, md: 5 },
            borderRadius: { xs: 3, sm: 4 },
            mb: 4,
            background: "white",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(140deg, rgba(240,147,251,0.1) 0%, rgba(245,87,108,0.1) 100%)",
              zIndex: 0,
            }}
          />

          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={2}>
              <CreditCard size={24} color="#f5576c" />
              <Typography
                variant="overline"
                sx={{
                  color: "#f5576c",
                  letterSpacing: 3,
                  fontWeight: 700,
                  fontSize: { xs: "0.75rem", sm: "0.875rem" }
                }}
              >
                PAYMENT SLIP UPLOAD
              </Typography>
            </Stack>

            <Typography
              variant="h3"
              fontWeight={800}
              color="#0f172a"
              mb={2}
              sx={{ fontSize: { xs: "1.75rem", sm: "2.5rem", md: "3rem" } }}
            >
              ส่งหลักฐานการชำระเงิน
            </Typography>


            <Typography
              variant="body1"
              color="#475569"
              sx={{
                fontSize: { xs: "0.875rem", sm: "1rem" },
                lineHeight: 1.7
              }}
            >
              เลือกการจอง ระบุยอดที่ชำระ และอัปโหลดสลิป ระบบจะส่งต่อให้ทีมงานตรวจสอบทันที
            </Typography>
          </Box>
        </Paper>


        {/* Footer Info */}
        <Box
          sx={{
            mt: { xs: 4, md: 6 },
            mb: { xs: 6, md: 4 },
            p: { xs: 3, sm: 4 },
            borderRadius: { xs: 3, sm: 4 },
            background: "rgba(255,255,255,0.2)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.3)",
            textAlign: "center"
          }}
        >
          <Typography variant="body1" color="#FA3A16" fontWeight={600} mb={1}>
            💡 <strong>หมายเหตุ:</strong> ตรวจสอบความถูกต้องของข้อมูลก่อนส่ง
          </Typography>
          <Typography variant="body2" color="#FA3A16">
            หากมีปัญหาหรือข้อสงสัย กรุณาติดต่อทีมงานผ่านช่องทางที่กำหนด
          </Typography>
        </Box>

        <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
          {/* Left Column - Upload Form */}
          <Grid item xs={12} lg={6}>
            <Paper
              elevation={6}
              sx={{
                p: { xs: 3, sm: 4, md: 5 },
                borderRadius: { xs: 3, sm: 4 },
                background: "white",
                height: "100%"
              }}
            >
              {message.text && (
                <Alert
                  severity={message.type === "error" ? "error" : message.type === "success" ? "success" : "info"}
                  sx={{ mb: 3, borderRadius: 2 }}
                >
                  {message.text}
                </Alert>
              )}

              <Box component="form" onSubmit={handleUpload} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                <TextField
                  select
                  fullWidth
                  label="การจอง"
                  value={form.bookingId}
                  onChange={handleChange("bookingId")}
                  helperText={
                    selectedBooking
                      ? depositPaid
                        ? `วันที่ ${selectedBooking.booking_date} · จ่ายโต๊ะนี้เรียบร้อยแล้ว`
                        : `วันที่ ${selectedBooking.booking_date} · ยอดมัดจำ ${formatCurrency(
                          selectedBooking.deposit_amount ?? selectedBooking.total_amount
                        )}`
                      : "เลือกรายการที่ต้องการอัปโหลดสลิป"
                  }
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      "&:hover fieldset": {
                        borderColor: "#667eea"
                      },
                      "&.Mui-focused fieldset": {
                        borderColor: "#667eea"
                      }
                    }
                  }}
                >
                  {bookings.map((booking) => (
                    <MenuItem key={booking.id} value={booking.id}>
                      {booking.booking_date} · โต๊ะ {booking.table?.table_number || "-"}
                    </MenuItem>
                  ))}
                </TextField>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    select
                    fullWidth
                    label="ช่องทางการชำระ"
                    value={form.paymentMethod}
                    onChange={handleChange("paymentMethod")}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        "&:hover fieldset": {
                          borderColor: "#667eea"
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "#667eea"
                        }
                      }
                    }}
                  >
                    {paymentMethods.map((method) => (
                      <MenuItem key={method.value} value={method.value}>
                        {method.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    fullWidth
                    label="จำนวนเงิน"
                    value={form.amount}
                    InputProps={{
                      readOnly: true,
                      startAdornment: <InputAdornment position="start">฿</InputAdornment>,
                    }}
                    helperText={
                      recommendedAmount
                        ? `ยอดมัดจำที่ต้องชำระ ${formatCurrency(recommendedAmount)}`
                        : "ไม่พบยอดมัดจำสำหรับรายการนี้"
                    }
                  />
                </Stack>

                <TextField
                  fullWidth
                  label="เลขที่อ้างอิง (ถ้ามี)"
                  value={form.transactionRef}
                  onChange={handleChange("transactionRef")}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      "&:hover fieldset": {
                        borderColor: "#667eea"
                      },
                      "&.Mui-focused fieldset": {
                        borderColor: "#667eea"
                      }
                    }
                  }}
                />

                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 2.5, sm: 3 },
                    borderRadius: 3,
                    borderColor: "#d0d7f7",
                    borderStyle: "dashed",
                    backgroundColor: "rgba(102,126,234,0.05)",
                    textAlign: "center",
                    borderWidth: 2
                  }}
                >
                  <Avatar sx={{ bgcolor: "#e0e7ff", color: "#667eea", width: 64, height: 64, mx: "auto", mb: 2 }}>
                    <UploadCloud size={28} />
                  </Avatar>
                  <Typography variant="subtitle1" fontWeight={700} color="#0f172a" gutterBottom>
                    ลากไฟล์มาวาง หรือเลือกไฟล์จากเครื่อง
                  </Typography>
                  <Typography variant="body2" color="#64748b" mb={2}>
                    รองรับไฟล์ JPG, PNG และ PDF ขนาดไม่เกิน 10 MB
                  </Typography>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*,application/pdf"
                    disabled={depositPaid}
                    style={{ display: "none" }}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={depositPaid}
                    sx={{
                      textTransform: "none",
                      borderColor: "#667eea",
                      color: "#667eea",
                      fontWeight: 600,
                      borderRadius: 2,
                      "&:hover": {
                        borderColor: "#5568d3",
                        bgcolor: "rgba(102,126,234,0.05)"
                      }
                    }}
                  >
                    เลือกไฟล์
                  </Button>
                  {slipName && (
                    <Typography variant="caption" display="block" mt={2} color="#667eea" fontWeight={600}>
                      ไฟล์ที่เลือก: {slipName}
                    </Typography>
                  )}
                </Paper>

                {isUpdatingExistingPayment && (
                  <Stack
                    spacing={1}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: "rgba(102,126,234,0.05)",
                      border: "1px solid #e0e7ff"
                    }}
                  >
                    <Chip
                      size="small"
                      label={`สถานะสลิป: ${existingPaymentStatus ? existingPaymentStatus.replace(/_/g, " ") : "pending"}`}
                      color={
                        existingPaymentStatus === "verified"
                          ? "success"
                          : existingPaymentStatus === "rejected"
                            ? "error"
                            : "info"
                      }
                      sx={{ textTransform: "capitalize", width: "fit-content" }}
                    />
                    <Typography variant="caption" color="#64748b">
                      การอัปโหลดใหม่จะแทนที่สลิปเดิมและส่งให้ทีมงานตรวจสอบอีกครั้ง
                    </Typography>
                  </Stack>
                )}

                {displayPreview && (
                  <Box
                    sx={{
                      borderRadius: 3,
                      overflow: "hidden",
                      border: "2px solid #e0e7ff",
                      boxShadow: "0 4px 12px rgba(102,126,234,0.1)"
                    }}
                  >
                    <img
                      src={displayPreview}
                      alt="slip preview"
                      style={{ width: "100%", maxHeight: 320, objectFit: "contain", display: "block" }}
                    />
                  </Box>
                )}

                {depositPaid && (
                  <Alert severity="success" sx={{ borderRadius: 2 }}>
                    จ่ายโต๊ะนี้เรียบร้อยแล้ว ไม่จำเป็นต้องอัปโหลดสลิปซ้ำ
                  </Alert>
                )}

                <Button
                  type="submit"
                  variant="contained"
                  disabled={uploading || depositPaid}
                  sx={{
                    textTransform: "none",
                    background: "#ff9d00ff",
                    "&:hover": {
                      background: "linear-gradient(135deg, #c16300ff 0%, #cf7303ff 100%)",
                      boxShadow: "0 6px 20px rgba(102,126,234,0.4)"
                    },
                    borderRadius: 3,
                    height: 48,
                    fontWeight: 700,
                    fontSize: "1rem",
                    boxShadow: "0 4px 15px rgba(102,126,234,0.3)"
                  }}
                >
                  {uploading
                    ? isUpdatingExistingPayment
                      ? "กำลังอัปเดต..."
                      : "กำลังอัปโหลด..."
                    : isUpdatingExistingPayment
                      ? "อัปเดตสลิปการชำระเงิน"
                      : "ส่งสลิปการชำระเงิน"}
                </Button>

                {uploading && <LinearProgress sx={{ borderRadius: 1 }} />}
              </Box>
            </Paper>
          </Grid>

          {/* Right Column - Payment History & Info */}
          <Grid item xs={12} lg={6}>
            <Stack spacing={{ xs: 2, sm: 3 }}>
              {/* Payment History */}
              <Paper
                elevation={3}
                sx={{
                  p: { xs: 2.5, sm: 3 },
                  borderRadius: { xs: 3, sm: 4 },
                  background: "white"
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center" mb={3}>
                  <Avatar sx={{ bgcolor: "#e0e7ff", color: "#667eea", width: 40, height: 40 }}>
                    <Wallet size={20} />
                  </Avatar>
                  <Typography variant="h6" fontWeight={700} color="#0f172a">
                    ประวัติการชำระเงินล่าสุด
                  </Typography>
                </Stack>

                {loading ? (
                  <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress size={32} sx={{ color: "#667eea" }} />
                  </Box>
                ) : payments.length === 0 ? (
                  <Box
                    sx={{
                      textAlign: "center",
                      py: { xs: 3, sm: 4 },
                      px: 2
                    }}
                  >
                    <Receipt size={48} color="#cbd5e1" style={{ marginBottom: 12 }} />
                    <Typography variant="body1" color="#64748b" fontWeight={600}>
                      ยังไม่มีการชำระเงินในระบบ
                    </Typography>
                    <Typography variant="body2" color="#94a3b8">
                      เมื่อคุณอัปโหลดสลิป รายการจะแสดงที่นี่
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {payments.map((payment) => (
                      <Card
                        key={payment.id}
                        variant="outlined"
                        sx={{
                          borderRadius: 3,
                          border: "2px solid #f1f5f9",
                          transition: "all 0.2s",
                          "&:hover": {
                            borderColor: "#667eea",
                            boxShadow: "0 4px 12px rgba(102,126,234,0.15)"
                          }
                        }}
                      >
                        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={2}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", sm: "center" }}
                          >
                            <Box flex={1}>
                              <Typography variant="subtitle1" fontWeight={700} color="#0f172a" mb={0.5}>
                                {payment.payment_type === "deposit"
                                  ? "ชำระมัดจำ"
                                  : payment.payment_type === "remaining"
                                    ? "ชำระส่วนที่เหลือ"
                                    : "ชำระเต็มจำนวน"}
                              </Typography>
                              <Typography variant="body2" color="#475569" mb={0.5}>
                                {formatDateTime(payment.created_at)} · {formatCurrency(payment.amount)}
                              </Typography>
                              <Typography variant="body2" color="#64748b">
                                การจองวันที่ {payment.booking?.booking_date || "-"}
                              </Typography>
                            </Box>
                            <Chip
                              label={payment.payment_status?.replace(/_/g, " ") || "pending"}
                              color={
                                payment.payment_status === "verified"
                                  ? "success"
                                  : payment.payment_status === "rejected"
                                    ? "error"
                                    : "warning"
                              }
                              sx={{
                                textTransform: "capitalize",
                                fontWeight: 600,
                                alignSelf: { xs: "flex-start", sm: "center" }
                              }}
                            />
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Paper>

              {/* Verification Info */}
              <Paper
                elevation={3}
                sx={{
                  p: { xs: 2.5, sm: 3 },
                  borderRadius: { xs: 3, sm: 4 },
                  background: "white"
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center" mb={3}>
                  <Avatar sx={{ bgcolor: "#e0e7ff", color: "#667eea", width: 40, height: 40 }}>
                    <Sparkles size={20} />
                  </Avatar>
                  <Typography variant="h6" fontWeight={700} color="#0f172a">
                    ขั้นตอนการตรวจสอบสลิป
                  </Typography>
                </Stack>

                <List sx={{ p: 0 }}>
                  {[
                    "ทีมงานจะตรวจสอบภายใน 15 นาทีในช่วงเวลาทำการ",
                    "เมื่ออนุมัติแล้ว สถานะการชำระเงินจะอัปเดตอัตโนมัติ",
                    "หากสลิปไม่ถูกต้อง สามารถอัปโหลดใหม่ได้ทันที"
                  ].map((item, index) => (
                    <ListItem key={index} disableGutters sx={{ py: 1.5 }}>
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            bgcolor: "#e0e7ff",
                            color: "#667eea",
                            width: 36,
                            height: 36
                          }}
                        >
                          <ShieldCheck size={18} />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={item}
                        primaryTypographyProps={{
                          variant: "body2",
                          color: "#475569",
                          fontWeight: 500
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>

              {error && (
                <Alert severity="error" sx={{ borderRadius: 3 }}>
                  {error}
                </Alert>
              )}
            </Stack>
          </Grid>
        </Grid>


      </MuiContainer>
    </Box>
  );
}

export default Slip;