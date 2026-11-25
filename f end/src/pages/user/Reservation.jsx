import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  Container as MuiContainer,
} from "@mui/material";
import {
  Clock4,
  MapPin,
  PartyPopper,
  Calendar,
  Users,
  CheckCircle2,
  TicketPercent,
} from "lucide-react";
import { format } from "date-fns";
import { reservationAPI } from "../../services/reservationAPI";
import { auth } from "../../utils/auth";
import WalletConnection from "../../components/WalletConnection";
import {
  calculateRoomPrice,
  formatCategoryPricing,
  formatCurrencyTHB,
  getCategoryPricing,
} from "../../utils/pricing";

const PRIMARY = "#ffffffff";
const SECONDARY = "#ff6b00ff";
const PRIMARY_LIGHT = "#ff944d";
const PRIMARY_FAINT = "rgba(255,107,0,0.08)";
const PRICE_GRADIENT = `linear-gradient(135deg, ${SECONDARY} 0%, ${PRIMARY_LIGHT} 100%)`;

const defaultForm = {
  bookingDate: "",
  startTime: "",
  endTime: "",
  tableId: "",
  guests: "",
  notes: "",
};

const timeOptions = Array.from({ length: 12 }, (_, index) => {
  const hour = 10 + index;
  return `${hour.toString().padStart(2, "0")}:00`;
});

const formatBookingLabel = (booking) => {
  const dateLabel = booking.booking_date
    ? format(new Date(`${booking.booking_date}T00:00:00`), "dd MMM yyyy")
    : "ไม่ระบุ";
  const timeLabel =
    booking.start_time && booking.end_time
      ? `${booking.start_time.slice(0, 5)} - ${booking.end_time.slice(0, 5)}`
      : "";

  return `${dateLabel}${timeLabel ? ` · ${timeLabel}` : ""}`;
};

function Reservation() {
  const [form, setForm] = useState(defaultForm);
  const [tables, setTables] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [availableTableIds, setAvailableTableIds] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [error, setError] = useState("");
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [promotionCode, setPromotionCode] = useState("");
  const [appliedPromotion, setAppliedPromotion] = useState(null);
  const [promotionError, setPromotionError] = useState("");
  const [promotionMessage, setPromotionMessage] = useState("");
  const [validatingPromotion, setValidatingPromotion] = useState(false);

  const userInfo = auth.getUserInfo();

  const tableIdNumber = useMemo(() => {
    if (typeof form.tableId === "string" && form.tableId !== "") {
      const parsed = Number(form.tableId);
      return Number.isNaN(parsed) ? form.tableId : parsed;
    }
    return form.tableId;
  }, [form.tableId]);

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      setLoading(true);
      setError("");

      try {
        const [bookingRes, tableRes, pricingRes] = await Promise.all([
          reservationAPI.getMine({ page: 1, limit: 6 }),
          reservationAPI.getTables(),
          reservationAPI.getPricing(),
        ]);

        if (!isMounted) return;

        if (bookingRes.data?.ok) {
          setBookings(bookingRes.data.data.bookings || []);
        }

        if (tableRes.data?.ok) {
          setTables(tableRes.data.data || []);
        }

        if (pricingRes.data?.ok) {
          setPricing(pricingRes.data.data || []);
        }
      } catch (err) {
        console.error("Failed to load reservation data", err);
        if (isMounted) {
          setError("ไม่สามารถโหลดข้อมูลการจองได้ กรุณาลองใหม่อีกครั้ง");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const { bookingDate, startTime, endTime } = form;
    if (!bookingDate || !startTime || !endTime) {
      setAvailableTableIds([]);
      return;
    }

    if (startTime >= endTime) {
      setAvailableTableIds([]);
      return;
    }

    let active = true;
    setCheckingAvailability(true);

    reservationAPI
      .getAvailableTables({
        date: bookingDate,
        start_time: startTime,
        end_time: endTime,
      })
      .then((response) => {
        if (!active) return;
        if (response.data?.ok) {
          const ids = (response.data.data || []).map((table) => table.id);
          setAvailableTableIds(ids);
        } else {
          setAvailableTableIds([]);
        }
      })
      .catch((err) => {
        console.error("Failed to check availability", err);
        if (active) {
          setAvailableTableIds([]);
        }
      })
      .finally(() => {
        if (active) {
          setCheckingAvailability(false);
        }
      });

    return () => {
      active = false;
    };
  }, [form.bookingDate, form.startTime, form.endTime]);

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === tableIdNumber),
    [tables, tableIdNumber]
  );

  const tableCapacity = useMemo(
    () => selectedTable?.capacity || selectedTable?.category?.capacity || 0,
    [selectedTable]
  );

  const { basePrice, extraHourPrice, hasAdditionalRate } = useMemo(
    () => getCategoryPricing(selectedTable?.category),
    [selectedTable]
  );

  const hours = useMemo(() => {
    if (!form.startTime || !form.endTime) return 0;
    const startHour = parseInt(form.startTime.split(":")[0], 10);
    const endHour = parseInt(form.endTime.split(":")[0], 10);
    const diff = endHour - startHour;
    return Number.isFinite(diff) && diff > 0 ? diff : 0;
  }, [form.startTime, form.endTime]);

  const estimatedPrice = useMemo(
    () => calculateRoomPrice(hours, basePrice, extraHourPrice),
    [hours, basePrice, extraHourPrice]
  );

  const discountAmount = useMemo(() => {
    if (!appliedPromotion || estimatedPrice <= 0) {
      return 0;
    }

    const discountValue = Number(appliedPromotion.discount_value) || 0;

    if (appliedPromotion.discount_type === "percentage") {
      return Math.min(estimatedPrice, estimatedPrice * (discountValue / 100));
    }

    if (appliedPromotion.discount_type === "fixed_amount") {
      return Math.min(estimatedPrice, discountValue);
    }

    return 0;
  }, [appliedPromotion, estimatedPrice]);

  const finalPrice = useMemo(
    () => Math.max(0, estimatedPrice - discountAmount),
    [estimatedPrice, discountAmount]
  );

  const pricingDescription = useMemo(() => {
    if (!selectedTable || basePrice <= 0) {
      return "เลือกโต๊ะเพื่อดูราคา";
    }

    if (hasAdditionalRate) {
      return `ชั่วโมงแรก ${formatCurrencyTHB(basePrice)} · ชั่วโมงถัดไป +${formatCurrencyTHB(
        extraHourPrice
      )}/ชม.`;
    }

    return `อัตรา ${formatCurrencyTHB(basePrice)} ต่อชั่วโมง`;
  }, [selectedTable, basePrice, extraHourPrice, hasAdditionalRate]);

  const describeCategoryPricing = (category) => {
    const pricing = getCategoryPricing(category);
    if (pricing.basePrice <= 0) {
      return "ราคาไม่ระบุ";
    }

    if (pricing.hasAdditionalRate) {
      return `ชั่วโมงแรก ${formatCurrencyTHB(pricing.basePrice)} · ชั่วโมงถัดไป +${formatCurrencyTHB(
        pricing.extraHourPrice
      )}/ชม.`;
    }

    return `${formatCurrencyTHB(pricing.basePrice)} / ชั่วโมง`;
  };

  const handleChange = (field) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "startTime"
        ? { endTime: prev.endTime && prev.endTime <= value ? "" : prev.endTime }
        : null),
    }));
    setMessage({ type: "", text: "" });
    if (["tableId", "startTime", "endTime", "bookingDate"].includes(field)) {
      setPromotionError("");
      setPromotionMessage("");
    }
  };

  const selectedTableBookings = useMemo(() => {
    if (!form.bookingDate || !tableIdNumber) {
      return [];
    }

    return bookings.filter((booking) => {
      if (booking.status === "cancelled") return false;
      if (booking.booking_date !== form.bookingDate) return false;
      const bookingTableId = booking.table?.id ?? booking.table_id;
      return bookingTableId === tableIdNumber;
    });
  }, [bookings, form.bookingDate, tableIdNumber]);

  const getHourFromTime = useCallback((timeValue) => {
    if (!timeValue) return null;
    const parts = timeValue.split(":");
    const hour = Number(parts[0]);
    return Number.isFinite(hour) ? hour : null;
  }, []);

  const isRangeConflicting = useCallback(
    (startHour, endHour) => {
      if (startHour === null || endHour === null) return false;
      return selectedTableBookings.some((booking) => {
        const bookingStart = getHourFromTime(booking.start_time);
        const bookingEnd = getHourFromTime(booking.end_time);
        if (bookingStart === null || bookingEnd === null) return false;
        return startHour < bookingEnd && endHour > bookingStart;
      });
    },
    [getHourFromTime, selectedTableBookings]
  );

  const isStartTimeDisabled = useCallback(
    (time) => {
      const startHour = getHourFromTime(time);
      if (startHour === null) return true;

      const overlapsExisting = isRangeConflicting(startHour, startHour + 1);
      if (overlapsExisting) return true;

      const hasValidEnd = timeOptions.some((candidate) => {
        const candidateHour = getHourFromTime(candidate);
        if (candidateHour === null || candidateHour <= startHour) return false;
        return !isRangeConflicting(startHour, candidateHour);
      });

      return !hasValidEnd;
    },
    [getHourFromTime, isRangeConflicting]
  );

  const isEndTimeDisabled = useCallback(
    (time) => {
      const endHour = getHourFromTime(time);
      const startHour = getHourFromTime(form.startTime);

      if (startHour === null || endHour === null) return true;
      if (endHour <= startHour) return true;

      return isRangeConflicting(startHour, endHour);
    },
    [form.startTime, getHourFromTime, isRangeConflicting]
  );

  useEffect(() => {
    if (!form.endTime) return;
    if (!form.startTime) return;

    if (isEndTimeDisabled(form.endTime)) {
      setForm((prev) => ({ ...prev, endTime: "" }));
    }
  }, [form.endTime, form.startTime, isEndTimeDisabled]);

  useEffect(() => {
    if (!promotionCode && appliedPromotion) {
      setAppliedPromotion(null);
    }
  }, [promotionCode, appliedPromotion]);

  useEffect(() => {
    setPromotionError("");
    setPromotionMessage("");
  }, [form.bookingDate, form.startTime, form.endTime, form.tableId]);

  const refreshBookings = async () => {
    try {
      const response = await reservationAPI.getMine({ page: 1, limit: 6 });
      if (response.data?.ok) {
        setBookings(response.data.data.bookings || []);
      }
    } catch (err) {
      console.error("Failed to refresh bookings", err);
    }
  };

  const handleApplyPromotion = async () => {
    const trimmedCode = promotionCode.trim().toUpperCase();

    if (!userInfo?.sub) {
      setPromotionError("กรุณาเข้าสู่ระบบก่อนใช้งานโค้ดส่วนลด");
      return;
    }

    if (!trimmedCode) {
      setPromotionError("กรุณากรอกโค้ดส่วนลด");
      return;
    }

    if (!form.bookingDate || !form.startTime || !form.endTime || !form.tableId) {
      setPromotionError("กรุณาเลือกวัน เวลา และโต๊ะก่อนใช้โค้ด");
      return;
    }

    setValidatingPromotion(true);
    setPromotionError("");
    setPromotionMessage("");

    try {
      const payload = {
        code: trimmedCode,
        user_id: userInfo.sub,
      };

      const response = await reservationAPI.validatePromotion(payload);

      if (response.data?.ok) {
        const promotionData = response.data.data;
        setAppliedPromotion(promotionData);
        setPromotionCode(trimmedCode);
        setPromotionMessage(response.data.message || "ใช้โค้ดส่วนลดเรียบร้อย");
      }
    } catch (err) {
      const apiMessage = err.response?.data?.error?.message;
      setPromotionError(apiMessage || "โค้ดส่วนลดไม่ถูกต้อง");
      setAppliedPromotion(null);
    } finally {
      setValidatingPromotion(false);
    }
  };

  const handleRemovePromotion = () => {
    setAppliedPromotion(null);
    setPromotionCode("");
    setPromotionError("");
    setPromotionMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!userInfo?.sub) {
      setMessage({ type: "error", text: "กรุณาเข้าสู่ระบบก่อนทำการจอง" });
      return;
    }

    if (!form.bookingDate || !form.startTime || !form.endTime || !form.tableId) {
      setMessage({ type: "error", text: "กรอกข้อมูลให้ครบถ้วนก่อนยืนยันการจอง" });
      return;
    }

    if (form.startTime >= form.endTime) {
      setMessage({ type: "error", text: "เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด" });
      return;
    }

    if (availableTableIds.length > 0) {
      const normalizedTableId =
        typeof tableIdNumber === "number" ? tableIdNumber : Number(tableIdNumber);

      if (Number.isFinite(normalizedTableId) && !availableTableIds.includes(normalizedTableId)) {
        setMessage({ type: "error", text: "โต๊ะที่เลือกไม่ว่างในช่วงเวลานี้" });
        return;
      }
    }

    setSubmitting(true);
    setMessage({ type: "", text: "" });

    try {
      const payload = {
        user_id: userInfo.sub,
        table_id: typeof tableIdNumber === "number" ? tableIdNumber : form.tableId,
        booking_date: form.bookingDate,
        start_time: form.startTime,
        end_time: form.endTime,
        number_of_people: form.guests ? Number(form.guests) : null,
        special_requests: form.notes || undefined,
        payment_type: "advance",
        total_amount: finalPrice,
        promotion_id: appliedPromotion?.id || null,
      };

      const response = await reservationAPI.create(payload);

      if (response.data?.ok) {
        setMessage({ type: "success", text: "บันทึกการจองเรียบร้อย ทีมงานจะตรวจสอบและติดต่อกลับ" });
        setForm(defaultForm);
        setAvailableTableIds([]);
        setAppliedPromotion(null);
        setPromotionCode("");
        setPromotionError("");
        setPromotionMessage("");
        refreshBookings();
      } else {
        setMessage({ type: "error", text: response.data?.error?.message || "ไม่สามารถสร้างการจองได้" });
      }
    } catch (err) {
      console.error("Create booking failed", err);
      const apiMessage = err.response?.data?.error?.message;
      setMessage({ type: "error", text: apiMessage || "ไม่สามารถสร้างการจองได้" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (bookingId) => {
    if (!bookingId) return;

    try {
      await reservationAPI.cancel(bookingId);
      setMessage({ type: "success", text: "ยกเลิกการจองเรียบร้อย" });
      refreshBookings();
    } catch (err) {
      console.error("Cancel booking failed", err);
      const apiMessage = err.response?.data?.error?.message;
      setMessage({ type: "error", text: apiMessage || "ไม่สามารถยกเลิกการจองได้" });
    }
  };

  const filteredTables = useMemo(() => {
    if (!form.bookingDate || !form.startTime || !form.endTime) {
      return tables;
    }
    if (availableTableIds.length === 0) {
      return tables;
    }
    return tables.filter((table) => availableTableIds.includes(table.id));
  }, [tables, form.bookingDate, form.startTime, form.endTime, availableTableIds]);

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
        <WalletConnection />
        {/* Header Section */}
        <Box sx={{ textAlign: "center", mb: { xs: 3, sm: 4, md: 5 }, px: { xs: 2, sm: 0 } }}>
          <Typography
            variant="overline"
            sx={{
              color: SECONDARY,
              letterSpacing: 4,
              fontSize: { xs: "0.75rem", sm: "0.875rem" },
              fontWeight: 600,
              display: "block",
              mb: 1,
            }}
          >
            BOARD GAME CAFE
          </Typography>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              color: "#0f172a",
              mb: 1.5,
              fontSize: { xs: "1.75rem", sm: "2.5rem", md: "3rem" },
              textShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            จองโต๊ะออนไลน์
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: "#475569",
              maxWidth: "700px",
              mx: "auto",
              fontSize: { xs: "0.875rem", sm: "1rem" },
              lineHeight: 1.7,
            }}
          >
            เลือกวัน เวลา และโต๊ะที่ต้องการ ระบบจะคำนวณราคาอัตโนมัติ
          </Typography>

          <Box
            sx={{
              mt: { xs: 4, md: 6 },
              p: { xs: 3, sm: 4 },
              borderRadius: { xs: 3, sm: 4 },
              background: "rgba(255,255,255,0.85)",
              border: `1px solid rgba(0,0,0,0.03)`,
              textAlign: "center",
            }}
          >
            <Typography variant="body2" color="#ff0000ff" mb={1}>
              💡 <strong>หมายเหตุ:</strong> ถ้ามีการจองนอกเวลาทำการ การตรวจสอบและยืนยันอาจจะเกิดความล่าช้า
            </Typography>
            <Typography variant="caption" color="#ed2828ff">
              หากมีคำถามหรือต้องการความช่วยเหลือ กรุณาติดต่อทีมงานโดยตรง
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
          {/* Booking Form */}
          <Grid item xs={12} lg={6}>
            <Paper elevation={8} sx={{ p: { xs: 3, sm: 4 }, borderRadius: { xs: 3, sm: 4 }, background: "white", height: "100%" }}>
              <Stack spacing={3}>
                {message.text && (
                  <Alert
                    severity={message.type === "error" ? "error" : "success"}
                    sx={{ borderRadius: 2 }}
                    icon={message.type === "success" ? <CheckCircle2 size={20} /> : undefined}
                  >
                    {message.text}
                  </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit}>
                  <Stack spacing={2.5}>
                    {/* Date Selection */}
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                        <Calendar size={18} color={PRIMARY} />
                        <Typography variant="subtitle2" fontWeight={600} color="#0f172a">
                          เลือกวันที่
                        </Typography>
                      </Stack>
                      <TextField
                        fullWidth
                        type="date"
                        value={form.bookingDate}
                        onChange={handleChange("bookingDate")}
                        InputLabelProps={{ shrink: true }}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            borderRadius: 2,
                            "&:hover fieldset": { borderColor: PRIMARY },
                            "&.Mui-focused fieldset": { borderColor: PRIMARY },
                          },
                        }}
                      />
                    </Box>
                                        {/* Table Selection */}
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                        <MapPin size={18} color={PRIMARY} />
                        <Typography variant="subtitle2" fontWeight={600} color="#0f172a">
                          เลือกโต๊ะ
                        </Typography>
                      </Stack>
                      <TextField
                        select
                        fullWidth
                        label="โต๊ะที่ต้องการ"
                        value={form.tableId}
                        onChange={handleChange("tableId")}
                        helperText={
                          checkingAvailability
                            ? "กำลังตรวจสอบโต๊ะว่าง"
                            : availableTableIds.length > 0
                              ? `พบโต๊ะว่าง ${availableTableIds.length} โต๊ะ`
                              : form.bookingDate && form.startTime && form.endTime
                                ? "ถ้าไม่พบโต๊ะว่าง กรุณาเปลี่ยนช่วงเวลา"
                                : "เลือกรอบเวลาก่อนแล้วระบบจะแนะนำโต๊ะที่ว่าง"
                        }
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            borderRadius: 2,
                            "&:hover fieldset": { borderColor: PRIMARY },
                            "&.Mui-focused fieldset": { borderColor: PRIMARY },
                          },
                        }}
                      >
                        {filteredTables.map((table) => (
                          <MenuItem key={table.id} value={table.id}>
                            โต๊ะ {table.table_number} · {table.category?.name || "ไม่ระบุ"}
                            {table.category ? ` · ${formatCategoryPricing(table.category, { style: "short" })}` : ""}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Box>

                    {/* Time Selection */}
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                        <Clock4 size={18} color={PRIMARY} />
                        <Typography variant="subtitle2" fontWeight={600} color="#0f172a">
                          เลือกช่วงเวลา
                        </Typography>
                      </Stack>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <TextField
                            select
                            fullWidth
                            label="เริ่มเวลา"
                            value={form.startTime}
                            onChange={handleChange("startTime")}
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                borderRadius: 2,
                                "&:hover fieldset": { borderColor: PRIMARY },
                                "&.Mui-focused fieldset": { borderColor: PRIMARY },
                              },
                            }}
                          >
                            {timeOptions.map((time) => (
                              <MenuItem key={time} value={time} disabled={isStartTimeDisabled(time)}>
                                {time}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid item xs={6}>
                          <TextField
                            select
                            fullWidth
                            label="สิ้นสุดเวลา"
                            value={form.endTime}
                            onChange={handleChange("endTime")}
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                borderRadius: 2,
                                "&:hover fieldset": { borderColor: PRIMARY },
                                "&.Mui-focused fieldset": { borderColor: PRIMARY },
                              },
                            }}
                          >
                            {timeOptions.map((time) => (
                              <MenuItem key={time} value={time} disabled={isEndTimeDisabled(time)}>
                                {time}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                      </Grid>
                    </Box>



                    {/* Additional Info */}
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                          <Users size={18} color={PRIMARY} />
                          <Typography variant="subtitle2" fontWeight={600} color="#0f172a">
                            จำนวนผู้เข้าร่วม
                          </Typography>
                        </Stack>
                        <TextField
                          fullWidth
                          type="number"
                          value={form.guests}
                          onChange={handleChange("guests")}
                          placeholder="ระบุจำนวน"
                          inputProps={{ min: 1, max: tableCapacity || undefined }}
                          helperText={tableCapacity ? `รองรับสูงสุด ${tableCapacity} คน` : ""}
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              borderRadius: 2,
                              "&:hover fieldset": { borderColor: PRIMARY },
                              "&.Mui-focused fieldset": { borderColor: PRIMARY },
                            },
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" fontWeight={600} color="#0f172a" mb={1}>
                          บันทึกเพิ่มเติม
                        </Typography>
                        <TextField
                          fullWidth
                          value={form.notes}
                          onChange={handleChange("notes")}
                          placeholder="ระบุคำขอพิเศษ (ถ้ามี)"
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              borderRadius: 2,
                              "&:hover fieldset": { borderColor: PRIMARY },
                              "&.Mui-focused fieldset": { borderColor: PRIMARY },
                            },
                          }}
                        />
                      </Grid>
                    </Grid>

                    {/* Promotion Code */}
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                        <TicketPercent size={18} color={PRIMARY} />
                        <Typography variant="subtitle2" fontWeight={600} color="#0f172a">
                          โค้ดส่วนลด
                        </Typography>
                      </Stack>
                      <Stack spacing={1.5}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                          <TextField
                            fullWidth
                            placeholder="กรอกโค้ดส่วนลด"
                            value={promotionCode}
                            onChange={(event) => {
                              const nextValue = event.target.value.toUpperCase();
                              setPromotionCode(nextValue);
                              setPromotionError("");
                              setPromotionMessage("");
                              if (appliedPromotion && nextValue !== (appliedPromotion.name || "")) {
                                setAppliedPromotion(null);
                              }
                            }}
                            error={Boolean(promotionError)}
                            helperText={promotionError || ""}
                            inputProps={{ maxLength: 12, style: { textTransform: "uppercase" } }}
                          />
                          <Button
                            variant={appliedPromotion ? "outlined" : "contained"}
                            color={appliedPromotion ? "inherit" : "primary"}
                            onClick={appliedPromotion ? handleRemovePromotion : handleApplyPromotion}
                            disabled={validatingPromotion}
                            sx={{
                              minWidth: { xs: "100%", sm: "140px" },
                              height: 56,
                              borderRadius: 2,
                              textTransform: "none",
                              fontWeight: 600,
                              ...(appliedPromotion
                                ? {
                                    borderColor: SECONDARY,
                                    color: SECONDARY,
                                  }
                                : {
                                    background: PRICE_GRADIENT,
                                    boxShadow: "0 4px 12px rgba(255,107,0,0.25)",
                                    "&:hover": {
                                      background: "linear-gradient(135deg, #e65e00 0%, #cc5400 100%)",
                                      boxShadow: "0 6px 18px rgba(255,107,0,0.35)",
                                    },
                                  }),
                            }}
                          >
                            {validatingPromotion ? (
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                justifyContent="center"
                              >
                                <CircularProgress
                                  size={18}
                                  sx={{ color: appliedPromotion ? SECONDARY : "white" }}
                                />
                                <span>กำลังตรวจสอบ</span>
                              </Stack>
                            ) : appliedPromotion ? (
                              "ยกเลิกโค้ด"
                            ) : (
                              "ใช้โค้ด"
                            )}
                          </Button>
                        </Stack>
                        {appliedPromotion && !promotionError && (
                          <Alert
                            severity="success"
                            icon={<CheckCircle2 size={18} />}
                            sx={{ borderRadius: 2, backgroundColor: "rgba(16,185,129,0.08)" }}
                          >
                            {promotionMessage || `ใช้โค้ด ${appliedPromotion.name} แล้ว`}
                          </Alert>
                        )}
                      </Stack>
                    </Box>

                    {/* Price Summary */}
                    <Paper sx={{ p: 3, borderRadius: 3, background: `linear-gradient(135deg, rgba(255,107,0,0.07) 0%, rgba(255,148,77,0.10) 100%)`, border: `2px solid rgba(255,107,0,0.12)` }}>
                      <Stack spacing={1.5}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" color="#475569">
                            ระยะเวลา
                          </Typography>
                          <Typography variant="body1" fontWeight={600} color="#0f172a">
                            {hours} ชั่วโมง
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" color="#475569">
                            {pricingDescription}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" color="#475569">
                            ค่าบริการก่อนหักส่วนลด
                          </Typography>
                          <Typography variant="body1" fontWeight={600} color="#0f172a">
                            {formatCurrencyTHB(estimatedPrice)}
                          </Typography>
                        </Stack>
                        {appliedPromotion && (
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip
                                size="small"
                                label={appliedPromotion.name}
                                sx={{ backgroundColor: PRIMARY_FAINT, color: SECONDARY, fontWeight: 600 }}
                              />
                              <Typography variant="body2" color="#475569">
                                ส่วนลด
                              </Typography>
                            </Stack>
                            <Typography variant="body1" fontWeight={600} color={SECONDARY}>
                              -{formatCurrencyTHB(discountAmount)}
                            </Typography>
                          </Stack>
                        )}
                        <Divider />
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="h6" fontWeight={700} color="#0f172a">
                            ยอดสุทธิที่ต้องชำระ
                          </Typography>
                          <Typography variant="h5" fontWeight={800} color="#0f172a">
                            {formatCurrencyTHB(finalPrice)}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="#64748b" textAlign="center">
                          *ยอดสุทธินี้ยังไม่รวมค่าอาหารหรือค่าใช้จ่ายอื่น ๆ
                        </Typography>
                      </Stack>
                    </Paper>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={submitting}
                      fullWidth
                      sx={{
                        py: 1.5,
                        borderRadius: 3,
                        textTransform: "none",
                        fontSize: "1rem",
                        fontWeight: 600,
                        background: PRICE_GRADIENT,
                        boxShadow: `0 4px 15px rgba(255,107,0,0.25)`,
                        "&:hover": {
                          background: `linear-gradient(135deg, #e65e00 0%, #cc5400 100%)`,
                          boxShadow: `0 6px 20px rgba(255,107,0,0.35)`,
                        },
                        "&:disabled": {
                          background: "#f3c9b8",
                        },
                      }}
                    >
                      {submitting ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <CircularProgress size={20} sx={{ color: "white" }} />
                          <span>กำลังบันทึก...</span>
                        </Stack>
                      ) : (
                        "ยืนยันการจอง"
                      )}
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          {/* Right Column - Bookings & Pricing */}
          <Grid item xs={12} lg={6}>
            <Stack spacing={{ xs: 2, sm: 3 }}>
              {/* My Bookings */}
              <Paper elevation={8} sx={{ p: { xs: 3, sm: 4 }, borderRadius: { xs: 3, sm: 4 }, background: "white" }}>
                <Stack direction="row" spacing={1.5} alignItems="center" mb={3}>
                  <Box sx={{ p: 1, borderRadius: 2, background: `linear-gradient(135deg, rgba(255,107,0,0.07) 0%, rgba(255,148,77,0.10) 100%)` }}>
                    <PartyPopper size={24} color={PRIMARY_LIGHT} />
                  </Box>
                  <Typography variant="h5" fontWeight={700} color="#0f172a">
                    การจองล่าสุดของฉัน
                  </Typography>
                </Stack>

                {loading ? (
                  <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress sx={{ color: PRIMARY }} />
                  </Box>
                ) : bookings.length === 0 ? (
                  <Box sx={{ textAlign: "center", py: 4, px: 2, borderRadius: 3, background: "linear-gradient(135deg, #fff8f3 0%, #fff3ec 100%)" }}>
                    <PartyPopper size={48} color={PRIMARY_LIGHT} style={{ marginBottom: 16 }} />
                    <Typography variant="body1" color="#64748b" fontWeight={500}>
                      ยังไม่มีการจองในระบบ
                    </Typography>
                    <Typography variant="body2" color="#94a3b8" mt={1}>
                      เมื่อคุณส่งคำขอ ระบบจะแสดงรายการที่นี่
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {bookings.map((booking) => {
                      const foodOrders = Array.isArray(booking.food_orders) ? booking.food_orders : [];
                      const hasFoodItems = foodOrders.some((order) => Array.isArray(order.items) && order.items.length > 0);

                      const getOrderTotal = (order) => {
                        if (order && order.total_amount !== undefined && order.total_amount !== null) {
                          const numeric = Number(order.total_amount);
                          if (Number.isFinite(numeric)) {
                            return numeric;
                          }
                        }

                        const items = Array.isArray(order?.items) ? order.items : [];
                        return items.reduce((sum, item) => {
                          const subtotalValue = (() => {
                            if (item.subtotal !== undefined && item.subtotal !== null) {
                              const numeric = Number(item.subtotal);
                              if (Number.isFinite(numeric)) {
                                return numeric;
                              }
                            }
                            const unitPrice = Number(item.unit_price || 0);
                            const quantity = Number(item.quantity || 0);
                            return unitPrice * quantity;
                          })();

                          return sum + (Number.isFinite(subtotalValue) ? subtotalValue : 0);
                        }, 0);
                      };

                      return (
                        <Card key={booking.id} sx={{ borderRadius: 3, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", transition: "all 0.2s", "&:hover": { boxShadow: "0 4px 12px rgba(0,0,0,0.1)", transform: "translateY(-2px)" } }}>
                          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                            <Stack spacing={2}>
                              {/* Header */}
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
                                <Box flex={1}>
                                  <Typography variant="h6" fontWeight={700} color="#0f172a" gutterBottom>
                                    {formatBookingLabel(booking)}
                                  </Typography>
                                  <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
                                    <Chip size="small" label={`โต๊ะ ${booking.table?.table_number || "-"}`} sx={{ bgcolor: "#fff4eb", color: "#c25a00", fontWeight: 600 }} />
                                    <Chip size="small" label={booking.table?.category?.name || "ไม่ระบุ"} sx={{ bgcolor: "#fff4eb", color: "#c25a00", fontWeight: 600 }} />
                                    {booking.number_of_people && <Chip size="small" icon={<Users size={14} />} label={`${booking.number_of_people} คน`} sx={{ bgcolor: "#fff4eb", color: "#c25a00", fontWeight: 600 }} />}
                                  </Stack>
                                </Box>
                                <Stack spacing={1} alignItems={{ xs: "flex-start", sm: "flex-end" }}>
                                  <Chip size="small" label={booking.status?.replace(/_/g, " ") || "pending"} color={booking.status === "approved" ? "success" : booking.status === "waiting" ? "warning" : booking.status === "cancelled" ? "default" : "info"} sx={{ textTransform: "capitalize", fontWeight: 600 }} />
                                  <Chip size="small" label={booking.payment_status?.replace(/_/g, " ") || "pending"} color={booking.payment_status === "paid" ? "success" : booking.payment_status === "deposit_paid" ? "info" : booking.payment_status === "cancelled" ? "default" : "warning"} sx={{ textTransform: "capitalize", fontWeight: 600 }} />
                                </Stack>
                              </Stack>

                              {/* Food Orders */}
                              {hasFoodItems && (
                                <Box sx={{ p: 2, borderRadius: 2, bgcolor: "#fefce8", border: "1px solid #fef08a" }}>
                                  <Typography variant="subtitle2" fontWeight={700} color="#713f12" gutterBottom>
                                    🍽️ รายการอาหาร
                                  </Typography>
                                  <Stack spacing={1}>
                                    {foodOrders.map((order, orderIndex) => {
                                      const orderItems = Array.isArray(order.items) ? order.items : [];
                                      const orderKey = order.id ?? `${booking.id}-order-${orderIndex}`;

                                      return (
                                        <Box key={orderKey}>
                                          {orderItems.map((item, itemIndex) => {
                                            const itemKey = item.id ?? `${orderKey}-item-${itemIndex}`;
                                            const quantity = Number(item.quantity || 0);
                                            const subtotal = (() => {
                                              if (item.subtotal !== undefined && item.subtotal !== null) {
                                                const numeric = Number(item.subtotal);
                                                if (Number.isFinite(numeric)) return numeric;
                                              }
                                              const unitPrice = Number(item.unit_price || 0);
                                              return unitPrice * quantity;
                                            })();

                                            return (
                                              <Stack key={itemKey} direction="row" justifyContent="space-between" alignItems="center">
                                                <Typography variant="body2" color="#854d0e">
                                                  {item.menu_item?.name || "รายการไม่ระบุ"} × {quantity}
                                                </Typography>
                                                <Typography variant="body2" fontWeight={600} color="#854d0e">
                                                  {formatCurrencyTHB(subtotal)}
                                                </Typography>
                                              </Stack>
                                            );
                                          })}
                                          <Typography variant="caption" color="#a16207" sx={{ mt: 0.5, display: "block" }}>
                                            ยอดรวม {formatCurrencyTHB(getOrderTotal(order))}
                                          </Typography>
                                        </Box>
                                      );
                                    })}
                                  </Stack>
                                </Box>
                              )}

                              {/* Footer */}
                              <Divider />
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }}>
                                <Box>
                                  <Typography variant="body2" color="#64748b">
                                    ยอดโดยประมาณ
                                  </Typography>
                                  <Typography variant="h6" fontWeight={700} color={PRIMARY}>
                                    {formatCurrencyTHB(booking.total_amount || estimatedPrice)}
                                  </Typography>
                                </Box>
                                {booking.status !== "cancelled" && booking.status !== "completed" && (
                                  <Button size="small" variant="outlined" color="error" onClick={() => handleCancel(booking.id)} sx={{ textTransform: "none", borderRadius: 2, fontWeight: 600 }}>
                                    ยกเลิกการจอง
                                  </Button>
                                )}
                              </Stack>
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                )}
              </Paper>

              {/* Room Categories & Pricing */}
              <Paper elevation={8} sx={{ p: { xs: 3, sm: 4 }, borderRadius: { xs: 3, sm: 4 }, background: "white" }}>
                <Stack direction="row" spacing={1.5} alignItems="center" mb={3}>
                  <Box sx={{ p: 1, borderRadius: 2, background: `linear-gradient(135deg, rgba(255,107,0,0.07) 0%, rgba(255,148,77,0.10) 100%)` }}>
                    <MapPin size={24} color={PRIMARY_LIGHT} />
                  </Box>
                  <Typography variant="h5" fontWeight={700} color="#0f172a">
                    หมวดห้องและราคา
                  </Typography>
                </Stack>

                {pricing.length === 0 ? (
                  <Box sx={{ textAlign: "center", py: 3, px: 2, borderRadius: 3, background: "linear-gradient(135deg, #fff8f3 0%, #fff3ec 100%)" }}>
                    <Typography variant="body2" color="#64748b">
                      ยังไม่มีข้อมูลราคา กรุณาติดต่อทีมงานเพื่อสอบถามรายละเอียด
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {pricing.map((category, index) => (
                      <Box key={category.id} sx={{ p: 3, borderRadius: 3, background: index % 2 === 0 ? `linear-gradient(135deg, rgba(255,107,0,0.03) 0%, rgba(255,148,77,0.04) 100%)` : "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", border: "1px solid #e2e8f0", transition: "all 0.2s", "&:hover": { boxShadow: `0 4px 12px rgba(255,107,0,0.08)`, transform: "translateY(-2px)" } }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                          <Box flex={1}>
                            <Typography variant="h6" fontWeight={700} color="#0f172a" gutterBottom>
                              {category.name}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={0.5}>
                              <Chip size="small" icon={<Users size={14} />} label={`รองรับ ${category.default_capacity || category.max_capacity || category.capacity || "-"} คน`} sx={{ bgcolor: "#fff4eb", color: "#c25a00", fontWeight: 600 }} />
                            </Stack>
                          </Box>
                          <Box sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: PRIMARY, color: "SECONDARY" }}>
                            <Typography variant="caption" fontWeight={600} display="block">
                              อัตรา
                            </Typography>
                            <Typography variant="body2" fontWeight={700}>
                              {describeCategoryPricing(category)}
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Paper>

              {/* Error Alert */}
              {error && (
                <Alert severity="error" sx={{ borderRadius: 3, border: "1px solid #fecaca" }}>
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

export default Reservation;
