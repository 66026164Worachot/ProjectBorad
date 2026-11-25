// pages/Reservation.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Button, Card, CardContent, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Dialog, DialogTitle, DialogContent, DialogActions,
  MenuItem, Select, FormControl, InputLabel, Alert, Snackbar,
  TablePagination, CircularProgress, Breadcrumbs, Link, Tooltip,
  InputAdornment, Grid, Chip, Avatar, TextField, Tabs, Tab,
  Autocomplete, Divider, Switch, FormControlLabel
} from '@mui/material';
import {
  Add, Search as SearchIcon, Refresh, CheckCircle, Cancel,
  Home, ChevronRight, CalendarToday, Event, EventAvailable,
  Login, Logout, Block, Visibility, TableBar,
  People, LocalOffer, AttachMoney, Sort, Edit, Delete, Category
} from '@mui/icons-material';
import { reservationAPI } from '../../services/reservationAPI';
import { userAPI } from '../../services/userAPI';
import { auth } from '../../utils/auth';
import {
  calculateRoomPrice,
  formatCategoryPricing,
  formatCurrencyTHB,
  getCategoryPricing
} from '../../utils/pricing';

const createInitialPromotionFormState = () => ({
  code: '',
  discount_type: 'percentage',
  discount_value: '',
  max_uses: '1',
  description: '',
  start_date: '',
  end_date: ''
});

const createInitialCategoryFormState = () => ({
  code: '',
  name: '',
  description: '',
  base_price: '',
  extra_hour_price: '',
  is_active: true
});

const createInitialTableFormState = () => ({
  table_number: '',
  category_id: '',
  capacity: '',
  status: 'available',
  description: ''
});

const Reservation = () => {
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [bookings, setBookings] = useState([]);
  const [tables, setTables] = useState([]);
  const [availableTables, setAvailableTables] = useState([]);
  const [users, setUsers] = useState([]);
  const [roomCategories, setRoomCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_desc'); // ⭐ เพิ่ม sorting state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalBookings, setTotalBookings] = useState(0);
  
  // Dialog states
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [openRejectDialog, setOpenRejectDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
   const [openPromotionDialog, setOpenPromotionDialog] = useState(false);
  const [promotionForm, setPromotionForm] = useState(createInitialPromotionFormState);
  const [promotionFormErrors, setPromotionFormErrors] = useState({});
  const [creatingPromotion, setCreatingPromotion] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState(createInitialCategoryFormState);
  const [categoryFormErrors, setCategoryFormErrors] = useState({});
  const [editingCategory, setEditingCategory] = useState(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [tableForm, setTableForm] = useState(createInitialTableFormState);
  const [tableFormErrors, setTableFormErrors] = useState({});
  const [editingTable, setEditingTable] = useState(null);
  const [savingTable, setSavingTable] = useState(false);
  // Create form state
  const [createForm, setCreateForm] = useState({
    user_id: null,
    table_id: '',
    booking_date: '',
    start_time: '10',
    end_time: '12',
    special_requests: '',
    promotion_code: '',
    promotion_id: null,
    payment_type: 'advance',
    total_amount: 0,
    discount_amount: 0,
    final_amount: 0,
    deposit_amount: 0,
    remaining_amount: 0
  });

  // Generate hour options (10:00 - 22:00)
  const hourOptions = useMemo(
    () => Array.from({ length: 13 }, (_, i) => i + 10),
    []
  );

  const selectedTable = useMemo(() => {
    if (!createForm.table_id) return null;
    return (
      tables.find(t => t.id === createForm.table_id) ||
      availableTables.find(t => t.id === createForm.table_id) ||
      null
    );
  }, [createForm.table_id, tables, availableTables]);

  const relevantBookingsForCreate = useMemo(() => {
    if (!createForm.booking_date || !createForm.table_id) {
      return [];
    }

    return bookings.filter((booking) => {
      if (!booking) return false;
      const status = (booking.status || '').toLowerCase();
      if (['cancelled', 'rejected'].includes(status)) return false;
      if (booking.booking_date !== createForm.booking_date) return false;

      const bookingTableId = booking.table?.id ?? booking.table_id;
      if (bookingTableId === null || bookingTableId === undefined) return false;

      return String(bookingTableId) === String(createForm.table_id);
    });
  }, [bookings, createForm.booking_date, createForm.table_id]);

  const extractHour = useCallback((timeValue) => {
    if (timeValue === null || timeValue === undefined || timeValue === '') {
      return null;
    }

    const [hourPart] = String(timeValue).split(':');
    const hour = Number(hourPart);
    return Number.isFinite(hour) ? hour : null;
  }, []);

  const doesRangeOverlap = useCallback(
    (startHour, endHour) => {
      if (startHour === null || endHour === null) return false;

      return relevantBookingsForCreate.some((booking) => {
        const bookingStart = extractHour(booking.start_time);
        const bookingEnd = extractHour(booking.end_time);
        if (bookingStart === null || bookingEnd === null) return false;

        return startHour < bookingEnd && endHour > bookingStart;
      });
    },
    [extractHour, relevantBookingsForCreate]
  );

  const isCreateStartDisabled = useCallback(
    (timeValue) => {
      if (!createForm.booking_date || !createForm.table_id) {
        return false;
      }

      const startHour = extractHour(timeValue);
      if (startHour === null) {
        return true;
      }

      const overlapsExisting = doesRangeOverlap(startHour, startHour + 1);
      if (overlapsExisting) {
        return true;
      }

      const hasValidEnd = hourOptions.some((option) => {
        const candidateHour = extractHour(String(option));
        if (candidateHour === null || candidateHour <= startHour) {
          return false;
        }
        return !doesRangeOverlap(startHour, candidateHour);
      });

      return !hasValidEnd;
    },
    [createForm.booking_date, createForm.table_id, doesRangeOverlap, extractHour, hourOptions]
  );

  const isCreateEndDisabled = useCallback(
    (timeValue) => {
      if (!createForm.booking_date || !createForm.table_id) {
        return false;
      }

      const endHour = extractHour(timeValue);
      const startHour = extractHour(createForm.start_time);

      if (startHour === null || endHour === null) {
        return true;
      }

      if (endHour <= startHour) {
        return true;
      }

      return doesRangeOverlap(startHour, endHour);
    },
    [createForm.booking_date, createForm.table_id, createForm.start_time, doesRangeOverlap, extractHour]
  );

  const activeRoomCategories = useMemo(
    () => roomCategories.filter(category => category?.is_active !== false),
    [roomCategories]
  );

  const [appliedPromotion, setAppliedPromotion] = useState(null);
  const [promotionError, setPromotionError] = useState('');
  const [validatingPromotion, setValidatingPromotion] = useState(false);

  // Table availability check
  const [availabilityDate, setAvailabilityDate] = useState('');
  const [availabilityStartTime, setAvailabilityStartTime] = useState('10');
  const [availabilityEndTime, setAvailabilityEndTime] = useState('12');
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  
  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Current user
  const currentUser = auth.getUserInfo();
  const canManage = ['staff', 'manager'].includes(currentUser?.role);
  const isManager = currentUser?.role === 'manager';
  const tableStatusOptions = ['available', 'occupied', 'maintenance', 'reserved', 'disabled'];

  const getTableCapacityDisplay = (table) => {
    const rawCapacity =
      table?.capacity ??
      table?.category?.default_capacity ??
      table?.category?.capacity ??
      null;

    if (rawCapacity === null || rawCapacity === undefined || rawCapacity === '') {
      return '-';
    }

    const numeric = Number(rawCapacity);
    return Number.isFinite(numeric) ? numeric : rawCapacity;
  };

  const getTableStatusColor = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'available':
        return 'success';
      case 'occupied':
        return 'warning';
      case 'maintenance':
        return 'info';
      case 'reserved':
        return 'secondary';
      case 'disabled':
      case 'unavailable':
        return 'default';
      default:
        return 'default';
    }
  };

  const formatAmount = (value) => formatCurrencyTHB(value ?? 0);

  const getCategoryPricingDetails = (category) => getCategoryPricing(category);

  const getDurationHoursLabel = (start, end) => {
    const startHour = Number(start);
    const endHour = Number(end);

    if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || endHour <= startHour) {
      return '-';
    }

    return `${endHour - startHour} hours`;
  };

  // Fetch data on mount and filter changes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await fetchRoomCategories();
      await fetchTables();
      await fetchUsers();
      await fetchBookings();
      if (canManage) await fetchStats();
      setLoading(false);
    };
    
    fetchData();
  }, [page, rowsPerPage, statusFilter, dateFilter, tableFilter, searchQuery, isManager]);

  useEffect(() => {
    if (!isManager && activeTab > 1) {
      setActiveTab(0);
    }
  }, [isManager, activeTab]);

  // Set default availability time when switching tabs
  useEffect(() => {
    if (activeTab === 1) {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const currentHour = now.getHours();
      
      setAvailabilityDate(dateStr);
      setAvailabilityStartTime(String(currentHour >= 10 && currentHour < 22 ? currentHour : 10));
      setAvailabilityEndTime(String(currentHour >= 10 && currentHour < 20 ? currentHour + 2 : 12));
    }
  }, [activeTab]);

  // Calculate price when form changes
  useEffect(() => {
    if (openCreateDialog) {
      calculateTotalPrice();
    }
  }, [
    createForm.start_time,
    createForm.end_time,
    createForm.payment_type,
    createForm.table_id,
    appliedPromotion,
    tables,
    availableTables,
    openCreateDialog
  ]);

  useEffect(() => {
    if (!openCreateDialog) return;
    if (!createForm.end_time) return;

    if (isCreateEndDisabled(createForm.end_time)) {
      setCreateForm((prev) => ({
        ...prev,
        end_time: ''
      }));
    }
  }, [openCreateDialog, createForm.end_time, isCreateEndDisabled]);

  // ⭐ ฟังก์ชัน Sorting
  const sortBookings = (bookingsToSort) => {
    const sorted = [...bookingsToSort];
    
    switch (sortBy) {
      case 'created_desc':
        return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      case 'created_asc':
        return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      case 'booking_desc':
        return sorted.sort((a, b) => new Date(b.booking_date) - new Date(a.booking_date));
      case 'booking_asc':
        return sorted.sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date));
      case 'amount_desc':
        return sorted.sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0));
      case 'amount_asc':
        return sorted.sort((a, b) => (a.total_amount || 0) - (b.total_amount || 0));
      case 'updated_desc':
        return sorted.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      default:
        return sorted;
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await reservationAPI.getAll({
        status: statusFilter,
        date: dateFilter,
        tableId: tableFilter,
        search: searchQuery,
        page: page + 1,
        limit: rowsPerPage
      });
      
      if (response.data.ok) {
        setBookings(response.data.data.bookings);
        setTotalBookings(response.data.data.pagination.total);
      }
    } catch (error) {
      showSnackbar('Failed to fetch bookings', 'error');
    }
  };

  const fetchTables = async () => {
    try {
      const response = await reservationAPI.getTables();
      if (response.data.ok) {
        setTables(response.data.data);
      }
    } catch (error) {
      console.error('Fetch tables error:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await userAPI.getAll({ limit: 100 });
      if (response.data.ok) {
        setUsers(response.data.data.users);
      }
    } catch (error) {
      console.error('Fetch users error:', error);
    }
  };

  const fetchRoomCategories = async () => {
    try {
      console.log('📄 Fetching room categories...');
      const response = isManager
        ? await reservationAPI.getRoomCategories()
        : await reservationAPI.getPricing();
      console.log('📋 Room category response:', response.data);

      if (response.data.ok) {
        const categories = response.data.data || [];
        setRoomCategories(categories);
        console.log('✅ Room categories loaded:', categories);

        if (!isManager && categories.length === 0) {
          console.error('⚠️ No room category data in database!');
          showSnackbar('No room category pricing available', 'warning');
        }
      }
    } catch (error) {
      console.error('❌ Fetch room categories error:', error);
      showSnackbar(
        isManager ? 'Failed to load table categories' : 'Failed to load room category pricing',
        'error'
      );
    }
  };

  const fetchStats = async () => {
    try {
      const response = await reservationAPI.getStats();
      if (response.data.ok) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Fetch stats error:', error);
    }
  };

  const calculateTotalPrice = () => {
    const startHour = parseInt(createForm.start_time, 10);
    const endHour = parseInt(createForm.end_time, 10);
    const hours = endHour - startHour;
    const tableForPricing = selectedTable;

    console.log('💰 Calculating price:', {
      startHour,
      endHour,
      hours,
      table: tableForPricing?.table_number,
      category: tableForPricing?.category?.code,
      payment_type: createForm.payment_type
    });

    if (!Number.isFinite(hours) || hours <= 0 || !tableForPricing?.category) {
      setCreateForm(prev => ({
        ...prev,
        total_amount: 0,
        discount_amount: 0,
        final_amount: 0,
        deposit_amount: 0,
        remaining_amount: 0
      }));
      return;
    }

    const { basePrice: firstHourPrice, extraHourPrice } = getCategoryPricingDetails(tableForPricing?.category);

    if (!Number.isFinite(firstHourPrice) || firstHourPrice <= 0) {
      setCreateForm(prev => ({
        ...prev,
        total_amount: 0,
        discount_amount: 0,
        final_amount: 0,
        deposit_amount: 0,
        remaining_amount: 0
      }));
      return;
    }

    const subtotal = calculateRoomPrice(hours, firstHourPrice, extraHourPrice);

    let discount = 0;
    if (appliedPromotion) {
      if (appliedPromotion.discount_type === 'percentage') {
        discount = subtotal * (Number(appliedPromotion.discount_value) / 100);
      } else if (appliedPromotion.discount_type === 'fixed_amount') {
        discount = Math.min(Number(appliedPromotion.discount_value), subtotal);
      }
    }

    const finalPrice = Math.max(0, subtotal - discount);
    
    let depositAmount = 0;
    let remainingAmount = 0;
    
    if (createForm.payment_type === 'walk_in') {
      depositAmount = finalPrice;
      remainingAmount = 0;
    } else {
      depositAmount = finalPrice * 0.10;
      remainingAmount = finalPrice - depositAmount;
    }

    console.log('💵 Price breakdown:', {
      baseRate: firstHourPrice,
      additionalHourRate: extraHourPrice,
      subtotal,
      discount,
      finalPrice,
      depositAmount,
      remainingAmount
    });

    setCreateForm(prev => ({
      ...prev,
      total_amount: Number(subtotal.toFixed(2)),
      discount_amount: Number(discount.toFixed(2)),
      final_amount: Number(finalPrice.toFixed(2)),
      deposit_amount: Number(depositAmount.toFixed(2)),
      remaining_amount: Number(remainingAmount.toFixed(2))
    }));
  };

  const handleValidatePromotion = async (codeOverride, successMessage = null) => {
    const codeToValidate = (codeOverride ?? createForm.promotion_code ?? '').trim().toUpperCase();
    if (!codeToValidate) {
      setPromotionError('Please enter a promotion code');
      return;
    }

    if (!createForm.user_id) {
      const message = 'Please select a customer before applying a promotion code';
      setPromotionError(message);
      showSnackbar(message, 'info');
      return;
    }

    setValidatingPromotion(true);
    setPromotionError('');

    try {
      const payload = {
        code: codeToValidate,
        user_id: createForm.user_id,
        ...(selectedBooking?.id ? { booking_id: selectedBooking.id } : {})
      };

      const response = await reservationAPI.validatePromotion(payload);

      if (response.data.ok) {
        const promotionData = response.data.data;
        const message = successMessage ?? response.data.message ?? 'Promotion code applied!';

        setAppliedPromotion(promotionData);
        setCreateForm(prev => ({ ...prev, promotion_id: promotionData.id, promotion_code: codeToValidate }));
        setPromotionError('');
        showSnackbar(message, 'success');
      }
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Invalid promotion code';
      setPromotionError(message);
      setAppliedPromotion(null);
      setCreateForm(prev => ({ ...prev, promotion_id: null }));
    } finally {
      setValidatingPromotion(false);
    }
  };

  const handleOpenPromotionDialog = () => {
    setPromotionForm(createInitialPromotionFormState());
    setPromotionFormErrors({});
    setOpenPromotionDialog(true);
  };

  const handleClosePromotionDialog = () => {
    setOpenPromotionDialog(false);
    setPromotionForm(createInitialPromotionFormState());
    setPromotionFormErrors({});
  };

  const handlePromotionFormChange = (field) => (event) => {
    const value = event.target.value;

    const nextValue = (() => {
      if (field === 'code') {
        return value.toUpperCase().slice(0, 8);
      }
      if (field === 'max_uses') {
        return value.replace(/[^0-9]/g, '');
      }
      return value;
    })();

    setPromotionForm(prev => ({
      ...prev,
      [field]: nextValue
    }));

    setPromotionFormErrors(prev => {
      const next = { ...prev };
      delete next[field];
      delete next.submit;
      return next;
    });
  };

  const handleGeneratePromotionCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let generated = '';

    for (let i = 0; i < 8; i += 1) {
      generated += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    setPromotionForm(prev => ({ ...prev, code: generated }));

    setPromotionFormErrors(prev => {
      const next = { ...prev };
      delete next.code;
      delete next.submit;
      return next;
    });
  };

  const handleCreatePromotion = async () => {
    const errors = {};

    if (!promotionForm.code.trim()) {
      errors.code = 'Promotion code is required';
    }

    const discountValueNumber = Number(promotionForm.discount_value);

    if (!promotionForm.discount_value && promotionForm.discount_value !== 0) {
      errors.discount_value = 'Discount value is required';
    } else if (Number.isNaN(discountValueNumber)) {
      errors.discount_value = 'Discount value must be a number';
    } else if (discountValueNumber <= 0) {
      errors.discount_value = 'Discount value must be greater than zero';
    } else if (promotionForm.discount_type === 'percentage' && discountValueNumber > 100) {
      errors.discount_value = 'Percentage discount cannot exceed 100%';
    }

    if (promotionForm.start_date && promotionForm.end_date) {
      const start = new Date(promotionForm.start_date);
      const end = new Date(promotionForm.end_date);

      if (end < start) {
        errors.end_date = 'End date must be after start date';
      }
    }

    const maxUsesNumber = Number(promotionForm.max_uses);

    if (!promotionForm.max_uses) {
      errors.max_uses = 'Usage limit is required';
    } else if (!Number.isInteger(maxUsesNumber) || maxUsesNumber <= 0) {
      errors.max_uses = 'Usage limit must be a positive whole number';
    }

    if (Object.keys(errors).length > 0) {
      setPromotionFormErrors(errors);
      return;
    }

    setCreatingPromotion(true);

    try {
      const payload = {
        name: promotionForm.code.trim().toUpperCase(),
        discount_type: promotionForm.discount_type,
        discount_value: discountValueNumber,
        max_uses: maxUsesNumber,
        ...(promotionForm.description.trim() && { description: promotionForm.description.trim() }),
        ...(promotionForm.start_date && { start_date: promotionForm.start_date }),
        ...(promotionForm.end_date && { end_date: promotionForm.end_date })
      };

      const response = await reservationAPI.createPromotion(payload);

      if (response.data.ok) {
        const createdPromotion = response.data.data;
        const newCode = (createdPromotion?.name || promotionForm.code.trim().toUpperCase());
        const successMessage = response.data.message || 'Promotion created and applied!';

        setPromotionForm(createInitialPromotionFormState());
        setPromotionFormErrors({});
        setPromotionError('');
        setCreateForm(prev => ({ ...prev, promotion_code: newCode }));

        if (createForm.user_id) {
          await handleValidatePromotion(newCode, successMessage);
        } else {
          showSnackbar('Promotion created. Select a customer before applying it.', 'info');
        }

        setOpenPromotionDialog(false);
      }
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to create promotion';
      setPromotionFormErrors(prev => ({ ...prev, submit: message }));
      showSnackbar(message, 'error');
    } finally {
      setCreatingPromotion(false);
    }
  };


  const handleOpenCategoryDialog = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        code: category.code || '',
        name: category.name || '',
        description: category.description || '',
        base_price: category.base_price !== undefined && category.base_price !== null
          ? String(category.base_price)
          : category.price_per_hour !== undefined && category.price_per_hour !== null
            ? String(category.price_per_hour)
            : '',
        extra_hour_price: category.extra_hour_price !== undefined && category.extra_hour_price !== null
          ? String(category.extra_hour_price)
          : '',
        is_active: category.is_active !== false
      });
    } else {
      setEditingCategory(null);
      setCategoryForm(createInitialCategoryFormState());
    }

    setCategoryFormErrors({});
    setCategoryDialogOpen(true);
  };

  const handleCloseCategoryDialog = () => {
    setCategoryDialogOpen(false);
    setCategoryForm(createInitialCategoryFormState());
    setCategoryFormErrors({});
    setEditingCategory(null);
    setSavingCategory(false);
  };

  const validateCategoryForm = () => {
    const errors = {};
    const code = categoryForm.code.trim().toUpperCase();
    const name = categoryForm.name.trim();
    const base = Number(categoryForm.base_price);
    const extra = categoryForm.extra_hour_price === ''
      ? null
      : Number(categoryForm.extra_hour_price);

    if (!code) {
      errors.code = 'Code is required';
    }

    if (!name) {
      errors.name = 'Name is required';
    }

    if (!categoryForm.base_price && categoryForm.base_price !== 0) {
      errors.base_price = 'Base price is required';
    } else if (!Number.isFinite(base) || base <= 0) {
      errors.base_price = 'Base price must be greater than zero';
    }

    if (categoryForm.extra_hour_price !== '' && (!Number.isFinite(extra) || extra < 0)) {
      errors.extra_hour_price = 'Additional hour price must be zero or greater';
    }

    return { errors, code, name, basePrice: base, extraPrice: extra };
  };

  const handleSubmitCategory = async () => {
    const { errors, code, name, basePrice, extraPrice } = validateCategoryForm();

    if (Object.keys(errors).length > 0) {
      setCategoryFormErrors(errors);
      return;
    }

    const payload = {
      code,
      name,
      description: categoryForm.description.trim() || null,
      base_price: Number(basePrice.toFixed(2)),
      extra_hour_price: extraPrice === null
        ? Number(basePrice.toFixed(2))
        : Number(extraPrice.toFixed(2)),
      is_active: Boolean(categoryForm.is_active)
    };

    setSavingCategory(true);

    try {
      if (editingCategory) {
        await reservationAPI.updateRoomCategory(editingCategory.id, payload);
        showSnackbar('Table category updated', 'success');
      } else {
        await reservationAPI.createRoomCategory(payload);
        showSnackbar('Table category created', 'success');
      }

      handleCloseCategoryDialog();
      await fetchRoomCategories();
      await fetchTables();
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to save table category';
      setCategoryFormErrors(prev => ({ ...prev, submit: message }));
      showSnackbar(message, 'error');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (category) => {
    if (!window.confirm(`Delete table category "${category.name || category.code}"?`)) return;

    try {
      await reservationAPI.deleteRoomCategory(category.id);
      showSnackbar('Table category deleted', 'success');
      await fetchRoomCategories();
      await fetchTables();
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to delete table category';
      showSnackbar(message, 'error');
    }
  };

  const handleOpenTableDialog = (table = null) => {
    if (table) {
      setEditingTable(table);
      setTableForm({
        table_number: table.table_number || '',
        category_id: table.category_id || table.category?.id || '',
        capacity: table.capacity !== undefined && table.capacity !== null ? String(table.capacity) : '',
        status: table.status || 'available',
        description: table.description || ''
      });
    } else {
      setEditingTable(null);
      setTableForm(createInitialTableFormState());
    }

    setTableFormErrors({});
    setTableDialogOpen(true);
  };

  const handleCloseTableDialog = () => {
    setTableDialogOpen(false);
    setTableForm(createInitialTableFormState());
    setTableFormErrors({});
    setEditingTable(null);
    setSavingTable(false);
  };

  const validateTableForm = () => {
    const errors = {};
    const tableNumber = tableForm.table_number.trim().toUpperCase();
    const status = tableForm.status.trim();
    const capacityValue = tableForm.capacity === '' ? null : Number(tableForm.capacity);

    if (!tableNumber) {
      errors.table_number = 'Table number is required';
    }

    if (!status) {
      errors.status = 'Status is required';
    }

    if (capacityValue !== null && (!Number.isFinite(capacityValue) || capacityValue <= 0)) {
      errors.capacity = 'Capacity must be a positive number';
    }

    return { errors, tableNumber, status, capacityValue };
  };

  const handleSubmitTable = async () => {
    const { errors, tableNumber, status, capacityValue } = validateTableForm();

    if (Object.keys(errors).length > 0) {
      setTableFormErrors(errors);
      return;
    }

    const payload = {
      table_number: tableNumber,
      status: status.toLowerCase(),
      description: tableForm.description.trim() || null,
      category_id: tableForm.category_id || null,
      ...(capacityValue === null
        ? {}
        : { capacity: Number(Math.trunc(capacityValue)) })
    };

    setSavingTable(true);

    try {
      if (editingTable) {
        await reservationAPI.updateTable(editingTable.id, payload);
        showSnackbar('Table updated', 'success');
      } else {
        await reservationAPI.createTable(payload);
        showSnackbar('Table created', 'success');
      }

      handleCloseTableDialog();
      await fetchTables();
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to save table';
      setTableFormErrors(prev => ({ ...prev, submit: message }));
      showSnackbar(message, 'error');
    } finally {
      setSavingTable(false);
    }
  };

  const handleDeleteTable = async (table) => {
    if (!window.confirm(`Delete table ${table.table_number}?`)) return;

    try {
      await reservationAPI.deleteTable(table.id);
      showSnackbar('Table deleted', 'success');
      await fetchTables();
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to delete table';
      showSnackbar(message, 'error');
    }
  };


  const handleRemovePromotion = () => {
    setAppliedPromotion(null);
    setCreateForm(prev => ({ 
      ...prev, 
      promotion_code: '', 
      promotion_id: null 
    }));
    setPromotionError('');
  };

  const checkAvailability = async () => {
    if (!availabilityDate || !availabilityStartTime || !availabilityEndTime) {
      showSnackbar('Please fill in date and time', 'warning');
      return;
    }

    setCheckingAvailability(true);
    try {
      const response = await reservationAPI.getAvailableTables({
        date: availabilityDate,
        start_time: `${availabilityStartTime}:00:00`,
        end_time: `${availabilityEndTime}:00:00`
      });

      if (response.data.ok) {
        setAvailableTables(response.data.data);
        showSnackbar(`Found ${response.data.data.length} available tables`, 'success');
      }
    } catch (error) {
      showSnackbar('Failed to check availability', 'error');
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleOpenCreateDialog = () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    
    const defaultStartHour = currentHour >= 10 && currentHour < 22 ? currentHour : 10;
    const defaultEndHour = defaultStartHour < 20 ? defaultStartHour + 2 : 22;
    
    setCreateForm({
      user_id: null,
      table_id: '',
      booking_date: dateStr,
      start_time: String(defaultStartHour),
      end_time: String(defaultEndHour),
      special_requests: '',
      promotion_code: '',
      promotion_id: null,
      payment_type: 'advance',
      total_amount: 0,
      discount_amount: 0,
      final_amount: 0,
      deposit_amount: 0,
      remaining_amount: 0
    });
    setAppliedPromotion(null);
    setPromotionError('');
    setOpenCreateDialog(true);
  };

  const handleCreateBooking = async () => {
    try {
      if (!createForm.user_id || !createForm.table_id || !createForm.booking_date ||
          !createForm.start_time || !createForm.end_time) {
        showSnackbar('Please fill in all required fields', 'warning');
        return;
      }

      if (parseInt(createForm.start_time) >= parseInt(createForm.end_time)) {
        showSnackbar('End time must be after start time', 'warning');
        return;
      }

      const bookingData = {
        user_id: createForm.user_id,
        table_id: createForm.table_id,
        booking_date: createForm.booking_date,
        start_time: `${createForm.start_time}:00:00`,
        end_time: `${createForm.end_time}:00:00`,
        special_requests: createForm.special_requests,
        promotion_id: createForm.promotion_id,
        payment_type: createForm.payment_type,
        total_amount: createForm.total_amount,
        final_amount: createForm.final_amount
      };

      console.log('📤 Creating booking:', bookingData);

      const response = await reservationAPI.create(bookingData);
      
      if (response.data.ok) {
        const { message, payment_placeholder, payment_placeholder_error } = response.data;

        if (payment_placeholder) {
          console.log('🧾 Prepared payment placeholder:', payment_placeholder);
        }

        if (payment_placeholder_error) {
          console.warn('⚠️ Payment placeholder warning:', payment_placeholder_error);
        }

        showSnackbar(
          message || 'Booking created successfully',
          payment_placeholder_error ? 'warning' : 'success'
        );
        setOpenCreateDialog(false);
        fetchBookings();
        if (canManage) fetchStats();
      }
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to create booking';
      showSnackbar(message, 'error');
      console.error('Create booking error:', error);
    }
  };

  const handleViewDetails = async (booking) => {
    try {
      const response = await reservationAPI.getById(booking.id);
      if (response.data.ok) {
        setSelectedBooking(response.data.data);
        setOpenDetailDialog(true);
      }
    } catch (error) {
      showSnackbar('Failed to load details', 'error');
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this booking?')) return;
    
    try {
      await reservationAPI.approve(id);
      showSnackbar('Booking approved', 'success');
      fetchBookings();
      if (canManage) fetchStats();
    } catch (error) {
      showSnackbar('Failed to approve', 'error');
    }
  };

  const handleOpenRejectDialog = (booking) => {
    setSelectedBooking(booking);
    setRejectReason('');
    setOpenRejectDialog(true);
  };

  const handleRejectConfirm = async () => {
    try {
      await reservationAPI.reject(selectedBooking.id, rejectReason);
      showSnackbar('Booking rejected', 'success');
      setOpenRejectDialog(false);
      fetchBookings();
      if (canManage) fetchStats();
    } catch (error) {
      showSnackbar('Failed to reject', 'error');
    }
  };

  const handleCheckIn = async (id) => {
    if (!window.confirm('Check-in this booking?')) return;
    
    try {
      await reservationAPI.checkIn(id);
      showSnackbar('Check-in successful', 'success');
      fetchBookings();
      if (canManage) fetchStats();
    } catch (error) {
      showSnackbar('Failed to check-in', 'error');
    }
  };

  const handleCheckOut = async (id) => {
    if (!window.confirm('Check-out this booking?')) return;
    
    try {
      await reservationAPI.checkOut(id);
      showSnackbar('Check-out successful', 'success');
      fetchBookings();
      if (canManage) fetchStats();
    } catch (error) {
      showSnackbar('Failed to check-out', 'error');
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    
    try {
      await reservationAPI.cancel(id);
      showSnackbar('Booking cancelled', 'success');
      fetchBookings();
      if (canManage) fetchStats();
    } catch (error) {
      showSnackbar('Failed to cancel', 'error');
    }
  };

  const handlePayDeposit = async (id) => {
    if (!window.confirm('Confirm deposit payment (10%)?')) return;
    
    try {
      await reservationAPI.payDeposit(id);
      showSnackbar('Deposit paid successfully', 'success');
      fetchBookings();
      if (canManage) fetchStats();
    } catch (error) {
      showSnackbar('Failed to process deposit payment', 'error');
    }
  };

  const handlePayRemaining = async (id) => {
    if (!window.confirm('Confirm remaining payment (90%)?')) return;
    
    try {
      await reservationAPI.payRemaining(id);
      showSnackbar('Remaining amount paid successfully', 'success');
      fetchBookings();
      if (canManage) fetchStats();
    } catch (error) {
      showSnackbar('Failed to process remaining payment', 'error');
    }
  };

  const handlePayFull = async (id) => {
    if (!window.confirm('Confirm full payment (100%)?')) return;
    
    try {
      await reservationAPI.payFull(id);
      showSnackbar('Full payment completed successfully', 'success');
      fetchBookings();
      if (canManage) fetchStats();
    } catch (error) {
      showSnackbar('Failed to process full payment', 'error');
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const getStatusColor = (status) => {
    const colors = {
      waiting: 'warning',
      approved: 'info',
      checked_in: 'success',
      checked_out: 'default',
      cancelled: 'error',
      rejected: 'error',
      completed: 'success'
    };
    return colors[status] || 'default';
  };

  const getStatusIcon = (status) => {
    const icons = {
      waiting: <CalendarToday />,
      approved: <EventAvailable />,
      checked_in: <Login />,
      checked_out: <Logout />,
      cancelled: <Cancel />,
      rejected: <Block />,
      completed: <CheckCircle />
    };
    return icons[status] || <Event />;
  };

  const getPaymentStatusColor = (status) => {
    const colors = {
      pending: 'warning',
      deposit_paid: 'info',
      paid: 'success',
      cancelled: 'default'
    };
    return colors[status] || 'default';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-GB');
  };

  const formatTime = (time) => {
    return time ? time.substring(0, 5) : '-';
  };

  const getBookedTables = () => {
    if (!availabilityDate || !availabilityStartTime || !availabilityEndTime) return [];
    const availableIds = availableTables.map(t => t.id);
    return tables.filter(t => !availableIds.includes(t.id));
  };

  // ⭐ ใช้ sortBookings() กับ bookings ก่อนแสดงผล
  const sortedBookings = sortBookings(bookings);

  return (
    <Box sx={{ p: { xs: 2, sm: 4, md: 6 }, minHeight: '100vh' }}>
      <Box sx={{ maxWidth: 1600, mx: 'auto' }}>
        
        {/* Breadcrumb */}
        <Box display="flex" alignItems="center" mb={3}>
          <Home size={20} color="#60a5fa" />
          <Breadcrumbs separator={<ChevronRight size={16} color="#94a3b8" />} sx={{ ml: 1 }}>
            <Link underline="hover" color="#000" href="/admin/dashboard">Home</Link>
            <Typography color="#1882ec">Reservations</Typography>
          </Breadcrumbs>
        </Box>

        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h4" fontWeight="700" gutterBottom>
              Reservation Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage bookings and table reservations
            </Typography>
          </Box>
          {canManage && (
            <Button variant="contained" startIcon={<Add />} onClick={handleOpenCreateDialog}>
              Create Booking
            </Button>
          )}
        </Box>

        {/* Stats Cards */}
        {stats && canManage && (
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="body2" color="text.secondary">Total</Typography>
                      <Typography variant="h4" fontWeight="700">{stats.total}</Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: '#3b82f6' }}><Event /></Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="body2" color="text.secondary">Waiting</Typography>
                      <Typography variant="h4" fontWeight="700" color="warning.main">
                        {stats.byStatus.waiting}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: '#f59e0b' }}><CalendarToday /></Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="body2" color="text.secondary">Checked In</Typography>
                      <Typography variant="h4" fontWeight="700" color="success.main">
                        {stats.byStatus.checked_in}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: '#10b981' }}><Login /></Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="body2" color="text.secondary">Today</Typography>
                      <Typography variant="h4" fontWeight="700">{stats.today}</Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: '#8b5cf6' }}><EventAvailable /></Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 3 }}>
          <Tab label="All Bookings" />
          <Tab label="Table Availability" />
          {isManager && <Tab label="Table Categories" />}
          {isManager && <Tab label="Tables" />}
        </Tabs>

        {/* Tab 1: All Bookings */}
        {activeTab === 0 && (
          <>
            <Card sx={{ mb: 3, p: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    placeholder="Search by customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="waiting">Waiting</MenuItem>
                      <MenuItem value="approved">Approved</MenuItem>
                      <MenuItem value="checked_in">Checked In</MenuItem>
                      <MenuItem value="checked_out">Checked Out</MenuItem>
                      <MenuItem value="cancelled">Cancelled</MenuItem>
                      <MenuItem value="rejected">Rejected</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>Table</InputLabel>
                    <Select value={tableFilter} label="Table" onChange={(e) => setTableFilter(e.target.value)}>
                      <MenuItem value="all">All Tables</MenuItem>
                      {tables.map(t => <MenuItem key={t.id} value={t.id}>Table {t.table_number}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                {/* ⭐ เพิ่ม Sorting Dropdown */}
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>Sort By</InputLabel>
                    <Select 
                      value={sortBy} 
                      label="Sort By" 
                      onChange={(e) => setSortBy(e.target.value)}
                      startAdornment={<InputAdornment position="start"><Sort /></InputAdornment>}
                    >
                      <MenuItem value="created_desc">Created: Latest</MenuItem>
                      <MenuItem value="created_asc">Created: Oldest</MenuItem>
                      <MenuItem value="booking_desc">Booking Date: Latest</MenuItem>
                      <MenuItem value="booking_asc">Booking Date: Oldest</MenuItem>
                      <MenuItem value="amount_desc">Amount: High-Low</MenuItem>
                      <MenuItem value="amount_asc">Amount: Low-High</MenuItem>
                      <MenuItem value="updated_desc">Updated: Latest</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={12} md={1}>
                  <Button fullWidth variant="outlined" startIcon={<Refresh />} onClick={fetchBookings} sx={{ height: '56px' }}>
                    Refresh
                  </Button>
                </Grid>
              </Grid>
            </Card>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell>Customer</TableCell>
                    <TableCell>Table</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Time</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Payment</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : sortedBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                        <Typography color="text.secondary">No bookings found</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedBookings.map((booking) => (
                      <TableRow key={booking.id} hover>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={2}>
                            <Avatar sx={{ bgcolor: '#6366f1' }}>
                              {(booking.user?.full_name || booking.user?.email || 'U')[0].toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography fontWeight="500">{booking.user?.full_name || 'No name'}</Typography>
                              <Typography variant="caption" color="text.secondary">{booking.user?.email}</Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={`Table ${booking.table?.table_number}`} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{formatDate(booking.booking_date)}</TableCell>
                        <TableCell>{formatTime(booking.start_time)} - {formatTime(booking.end_time)}</TableCell>
                        <TableCell>
                          <Chip
                            icon={getStatusIcon(booking.status)}
                            label={booking.status.replace('_', ' ')}
                            color={getStatusColor(booking.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={booking.payment_status?.replace('_', ' ') || 'pending'}
                            color={getPaymentStatusColor(booking.payment_status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight="600">฿{booking.total_amount || 0}</Typography>
                          {booking.payment_type === 'advance' && booking.payment_status === 'pending' && (
                            <Typography variant="caption" color="text.secondary">
                              Deposit: ฿{booking.deposit_amount || 0}
                            </Typography>
                          )}
                          {booking.payment_status === 'deposit_paid' && (
                            <Typography variant="caption" color="text.secondary">
                              Remaining: ฿{booking.remaining_amount || 0}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="View">
                            <IconButton size="small" onClick={() => handleViewDetails(booking)}>
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {canManage && booking.payment_status === 'pending' && booking.payment_type === 'advance' && (
                            <Tooltip title="Pay Deposit (10%)">
                              <IconButton size="small" color="warning" onClick={() => handlePayDeposit(booking.id)}>
                                <AttachMoney fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          {canManage && booking.payment_status === 'pending' && booking.payment_type === 'walk_in' && (
                            <Tooltip title="Pay Full Amount">
                              <IconButton size="small" color="success" onClick={() => handlePayFull(booking.id)}>
                                <AttachMoney fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          {canManage && booking.payment_status === 'deposit_paid' && (
                            <Tooltip title="Pay Remaining (90%)">
                              <IconButton size="small" color="success" onClick={() => handlePayRemaining(booking.id)}>
                                <AttachMoney fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          {canManage && booking.status === 'waiting' && (
                            <>
                              <Tooltip title="Approve">
                                <IconButton size="small" color="success" onClick={() => handleApprove(booking.id)}>
                                  <CheckCircle fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Reject">
                                <IconButton size="small" color="error" onClick={() => handleOpenRejectDialog(booking)}>
                                  <Block fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          {canManage && booking.status === 'approved' && (
                            <Tooltip title="Check In">
                              <IconButton size="small" color="primary" onClick={() => handleCheckIn(booking.id)}>
                                <Login fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canManage && booking.status === 'checked_in' && (
                            <Tooltip title="Check Out">
                              <IconButton size="small" color="primary" onClick={() => handleCheckOut(booking.id)}>
                                <Logout fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {['waiting', 'approved'].includes(booking.status) && (
                            <Tooltip title="Cancel">
                              <IconButton size="small" color="error" onClick={() => handleCancel(booking.id)}>
                                <Cancel fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={totalBookings}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[5, 10, 25, 50]}
              />
            </TableContainer>
          </>
        )}

        {/* Tab 2: Table Availability */}
        {activeTab === 1 && (
          <>
            <Card sx={{ mb: 3, p: 3 }}>
              <Typography variant="h6" fontWeight="600" mb={3}>Check Table Availability</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Date"
                    value={availabilityDate}
                    onChange={(e) => setAvailabilityDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Start Time</InputLabel>
                    <Select value={availabilityStartTime} label="Start Time" onChange={(e) => setAvailabilityStartTime(e.target.value)}>
                      {hourOptions.map(h => <MenuItem key={h} value={String(h)}>{String(h).padStart(2, '0')}:00</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>End Time</InputLabel>
                    <Select value={availabilityEndTime} label="End Time" onChange={(e) => setAvailabilityEndTime(e.target.value)}>
                      {hourOptions.map(h => <MenuItem key={h} value={String(h)}>{String(h).padStart(2, '0')}:00</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={checkingAvailability ? <CircularProgress size={20} /> : <SearchIcon />}
                    onClick={checkAvailability}
                    disabled={checkingAvailability}
                    sx={{ height: '56px' }}
                  >
                    Check
                  </Button>
                </Grid>
              </Grid>
            </Card>

            {availableTables.length > 0 && (
              <Box mb={4}>
                <Typography variant="h6" fontWeight="600" mb={2} color="success.main">
                  ✅ Available Tables ({availableTables.length})
                </Typography>
                <Grid container spacing={2}>
                  {availableTables.map((table) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={table.id}>
                      <Card sx={{ border: '2px solid', borderColor: 'success.main', bgcolor: 'success.lighter' }}>
                        <CardContent>
                          <Box display="flex" alignItems="center" gap={2} mb={2}>
                            <Avatar sx={{ bgcolor: 'success.main' }}><TableBar /></Avatar>
                            <Box>
                              <Typography variant="h6" fontWeight="700">Table {table.table_number}</Typography>
                              <Chip label="Available" color="success" size="small" />
                            </Box>
                          </Box>
                          <Divider sx={{ my: 1 }} />
                          <Box display="flex" alignItems="center" gap={1}>
                            <People fontSize="small" />
                            <Typography variant="body2">Capacity: {getTableCapacityDisplay(table)}</Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={1} mt={1}>
                            <LocalOffer fontSize="small" />
                            <Typography variant="body2">
                              {table.category?.name || table.category?.code || 'Uncategorised'} • {formatCategoryPricing(table.category, { style: 'short' })}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {availabilityDate && availabilityStartTime && availabilityEndTime && (
              <Box>
                <Typography variant="h6" fontWeight="600" mb={2} color="error.main">
                  ❌ Unavailable Tables ({getBookedTables().length})
                </Typography>
                <Grid container spacing={2}>
                  {getBookedTables().map((table) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={table.id}>
                      <Card sx={{ border: '2px solid', borderColor: 'error.main', bgcolor: 'error.lighter', opacity: 0.7 }}>
                        <CardContent>
                          <Box display="flex" alignItems="center" gap={2} mb={2}>
                            <Avatar sx={{ bgcolor: 'error.main' }}><TableBar /></Avatar>
                            <Box>
                              <Typography variant="h6" fontWeight="700">Table {table.table_number}</Typography>
                              <Chip label="Booked" color="error" size="small" />
                            </Box>
                          </Box>
                          <Divider sx={{ my: 1 }} />
                          <Box display="flex" alignItems="center" gap={1}>
                            <People fontSize="small" />
                            <Typography variant="body2">Capacity: {getTableCapacityDisplay(table)}</Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={1} mt={1}>
                            <LocalOffer fontSize="small" />
                            <Typography variant="body2">
                              {table.category?.name || table.category?.code || 'Uncategorised'} • {formatCategoryPricing(table.category, { style: 'short' })}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </>
        )}

        {isManager && activeTab === 2 && (
          <>
            <Card sx={{ mb: 3, p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
                <Box>
                  <Typography variant="h6" fontWeight="600" display="flex" alignItems="center" gap={1}>
                    <Category fontSize="small" /> Table Categories
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage base and additional hourly rates for each table type.
                  </Typography>
                </Box>
                <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenCategoryDialog()}>
                  Add Table Category
                </Button>
              </Box>

              <TableContainer component={Paper} sx={{ mt: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width="10%">Code</TableCell>
                      <TableCell width="35%">Details</TableCell>
                      <TableCell width="25%">Pricing</TableCell>
                      <TableCell width="15%">Status</TableCell>
                      <TableCell align="right" width="15%">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {roomCategories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="text.secondary">
                            No table categories found. Click “Add Table Category” to create one.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      roomCategories.map(category => {
                        const updatedAt = category.updated_at
                          ? new Date(category.updated_at).toLocaleString()
                          : '—';

                        return (
                          <TableRow key={category.id} hover>
                            <TableCell>
                              <Typography fontWeight="600">{category.code || '-'}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography fontWeight="600">{category.name || '-'}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {category.description || 'No description'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Updated: {updatedAt}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{formatCategoryPricing(category)}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                Base: {formatAmount(category.base_price)} · +{formatAmount(category.extra_hour_price)}/hr
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={category.is_active ? 'Active' : 'Inactive'}
                                color={category.is_active ? 'success' : 'default'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={() => handleOpenCategoryDialog(category)}>
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton size="small" color="error" onClick={() => handleDeleteCategory(category)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </>
        )}

        {isManager && activeTab === 3 && (
          <>
            <Card sx={{ mb: 3, p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
                <Box>
                  <Typography variant="h6" fontWeight="600">Tables</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Create, update, or remove tables available for reservations.
                  </Typography>
                </Box>
                <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenTableDialog()}>
                  Add Table
                </Button>
              </Box>

              <TableContainer component={Paper} sx={{ mt: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width="20%">Table</TableCell>
                      <TableCell width="30%">Category</TableCell>
                      <TableCell width="15%">Capacity</TableCell>
                      <TableCell width="20%">Status</TableCell>
                      <TableCell align="right" width="15%">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tables.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="text.secondary">
                            No tables found. Click “Add Table” to create one.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      tables.map(table => (
                        <TableRow key={table.id} hover>
                          <TableCell>
                            <Typography fontWeight="600">{table.table_number || '-'}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {table.description || 'No description'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography fontWeight="600">
                              {table.category?.name || table.category?.code || 'Unassigned'}
                            </Typography>
                            {table.category && (
                              <Typography variant="caption" color="text.secondary">
                                {formatCategoryPricing(table.category, { style: 'short' })}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography>{getTableCapacityDisplay(table)}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={(table.status || 'unknown').replace(/_/g, ' ')}
                              color={getTableStatusColor(table.status)}
                              size="small"
                              sx={{ textTransform: 'capitalize' }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => handleOpenTableDialog(table)}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" color="error" onClick={() => handleDeleteTable(table)}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </>
        )}

        {/* Create Dialog */}
        <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Create New Booking</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {activeRoomCategories.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Room category pricing
                  </Typography>
                  <Grid container spacing={1}>
                    {activeRoomCategories.map(category => (
                      <Grid item key={category.id}>
                        <Chip
                          label={`${category.name || category.code} • ${formatCategoryPricing(category, { style: 'compact' })}`}
                          color={selectedTable?.category?.id === category.id ? 'primary' : 'default'}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              <Autocomplete
                options={users}
                getOptionLabel={(option) => `${option.full_name || 'No name'} (${option.email})`}
                value={users.find(u => u.id === createForm.user_id) || null}
                onChange={(e, newValue) => {
                  setCreateForm(prev => ({
                    ...prev,
                    user_id: newValue?.id || null,
                    ...(appliedPromotion ? { promotion_code: '', promotion_id: null } : {})
                  }));

                  if (appliedPromotion) {
                    setAppliedPromotion(null);
                    setPromotionError('');
                    showSnackbar('Promotion cleared. Re-apply for the selected customer.', 'info');
                  }
                }}
                renderInput={(params) => <TextField {...params} label="Customer *" />}
              />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Date"
                    value={createForm.booking_date}
                    onChange={(e) => setCreateForm({ ...createForm, booking_date: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Table</InputLabel>
                    <Select value={createForm.table_id} label="Table" onChange={(e) => setCreateForm({ ...createForm, table_id: e.target.value })}>
                      {tables.map(t => (
                        <MenuItem key={t.id} value={t.id}>
                          Table {t.table_number} • {t.category?.name || t.category?.code || 'Room'} (Cap: {getTableCapacityDisplay(t)})
                          {t.category
                            ? ` • ${formatCategoryPricing(t.category, { style: 'short' })}`
                            : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Start Time</InputLabel>
                    <Select
                      value={createForm.start_time}
                      label="Start Time"
                      onChange={(e) => setCreateForm({ ...createForm, start_time: e.target.value })}
                    >
                      {hourOptions.map((hour) => {
                        const value = String(hour);
                        const disabled = isCreateStartDisabled(value);
                        const label = `${String(hour).padStart(2, '0')}:00${disabled ? ' • ไม่ว่าง' : ''}`;

                        return (
                          <MenuItem key={hour} value={value} disabled={disabled}>
                            {label}
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
                    <InputLabel>End Time</InputLabel>
                    <Select
                      value={createForm.end_time}
                      label="End Time"
                      onChange={(e) => setCreateForm({ ...createForm, end_time: e.target.value })}
                    >
                      {hourOptions.map((hour) => {
                        const value = String(hour);
                        const disabled = isCreateEndDisabled(value);
                        const label = `${String(hour).padStart(2, '0')}:00${disabled ? ' • ไม่ว่าง' : ''}`;

                        return (
                          <MenuItem key={hour} value={value} disabled={disabled}>
                            {label}
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <TextField
                fullWidth
                multiline
                rows={2}
                label="Special Requests"
                value={createForm.special_requests}
                onChange={(e) => setCreateForm({ ...createForm, special_requests: e.target.value })}
              />

              <Divider />

              <Box>
                <Typography variant="subtitle2" fontWeight="600" mb={1}>
                  Payment Type *
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Card 
                      sx={{ 
                        border: '2px solid',
                        borderColor: createForm.payment_type === 'walk_in' ? 'primary.main' : 'grey.300',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        '&:hover': { borderColor: 'primary.main' }
                      }}
                      onClick={() => setCreateForm({ ...createForm, payment_type: 'walk_in' })}
                    >
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={2} mb={1}>
                          <Avatar sx={{ bgcolor: createForm.payment_type === 'walk_in' ? 'primary.main' : 'grey.400' }}>
                            <AttachMoney />
                          </Avatar>
                          <Box>
                            <Typography variant="h6" fontWeight="700">Walk-in</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Pay full amount now
                            </Typography>
                          </Box>
                        </Box>
                        <Alert severity="info" sx={{ mt: 1 }}>
                          Customer plays now and pays 100%
                        </Alert>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Card 
                      sx={{ 
                        border: '2px solid',
                        borderColor: createForm.payment_type === 'advance' ? 'primary.main' : 'grey.300',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        '&:hover': { borderColor: 'primary.main' }
                      }}
                      onClick={() => setCreateForm({ ...createForm, payment_type: 'advance' })}
                    >
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={2} mb={1}>
                          <Avatar sx={{ bgcolor: createForm.payment_type === 'advance' ? 'primary.main' : 'grey.400' }}>
                            <CalendarToday />
                          </Avatar>
                          <Box>
                            <Typography variant="h6" fontWeight="700">Advance Booking</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Pay 10% deposit now
                            </Typography>
                          </Box>
                        </Box>
                        <Alert severity="warning" sx={{ mt: 1 }}>
                          Pay 10% now, 90% upon arrival
                        </Alert>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle2" fontWeight="600" mb={1}>Promotion Code</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={canManage ? 6 : 8}>
                      <TextField
                      fullWidth
                      label="Code"
                        value={createForm.promotion_code}
                        onChange={(e) => {
                          setCreateForm({ ...createForm, promotion_code: e.target.value.toUpperCase() });
                          setPromotionError('');
                        }}
                        error={!!promotionError}
                        helperText={promotionError}
                        InputProps={{
                          startAdornment: <InputAdornment position="start"><LocalOffer /></InputAdornment>
                        }}
                        disabled={!!appliedPromotion}
                      />
                    </Grid>
                    <Grid item xs={12} md={canManage ? 3 : 4}>
                      {appliedPromotion ? (
                        <Button fullWidth variant="outlined" color="error" onClick={handleRemovePromotion} sx={{ height: '56px' }}>
                          Remove
                        </Button>
                      ) : (
                        <Button
                          fullWidth
                          variant="outlined"
                          onClick={() => handleValidatePromotion()}
                          disabled={validatingPromotion || !createForm.promotion_code.trim()}
                          sx={{ height: '56px' }}
                        >
                          {validatingPromotion ? <CircularProgress size={24} /> : 'Apply'}
                        </Button>
                      )}
                    </Grid>
                    {canManage && (
                      <Grid item xs={12} md={3}>
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<Add />}
                          onClick={handleOpenPromotionDialog}
                          sx={{ height: '56px' }}
                        >
                          New Code
                        </Button>
                      </Grid>
                    )}
                  </Grid>
                {appliedPromotion && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" component="div">
                      <strong>{appliedPromotion.name}</strong>
                      {appliedPromotion.description ? ` – ${appliedPromotion.description}` : ''}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {appliedPromotion.remaining_uses !== null
                        ? `${appliedPromotion.remaining_uses} use${appliedPromotion.remaining_uses === 1 ? '' : 's'} remaining overall.`
                        : 'Unlimited remaining uses.'}{' '}
                      Each customer can redeem once.
                    </Typography>
                  </Alert>
                )}
              </Box>

              <Divider />

              <Box sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight="600" mb={2}>Payment Summary</Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}><Typography variant="body2" color="text.secondary">Duration:</Typography></Grid>
                  <Grid item xs={6}><Typography variant="body2" align="right">{getDurationHoursLabel(createForm.start_time, createForm.end_time)}</Typography></Grid>

                  <Grid item xs={6}><Typography variant="body2" color="text.secondary">Room Size:</Typography></Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" align="right">
                      {selectedTable?.category?.name || selectedTable?.category?.code || '-'}
                    </Typography>
                  </Grid>

                  <Grid item xs={6}><Typography variant="body2" color="text.secondary">Room pricing:</Typography></Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" align="right">
                      {selectedTable?.category ? formatCategoryPricing(selectedTable.category) : '-'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

                  <Grid item xs={6}><Typography variant="body2" fontWeight="600">Subtotal:</Typography></Grid>
                  <Grid item xs={6}><Typography variant="body2" align="right" fontWeight="600">{formatAmount(createForm.total_amount)}</Typography></Grid>

                  {createForm.discount_amount > 0 && (
                    <>
                      <Grid item xs={6}><Typography variant="body2" color="success.main">Discount:</Typography></Grid>
                      <Grid item xs={6}><Typography variant="body2" align="right" color="success.main">-{formatAmount(createForm.discount_amount)}</Typography></Grid>
                    </>
                  )}

                  <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

                  <Grid item xs={6}><Typography variant="h6" fontWeight="700">Total:</Typography></Grid>
                  <Grid item xs={6}><Typography variant="h6" align="right" fontWeight="700">{formatAmount(createForm.final_amount)}</Typography></Grid>

                  {createForm.payment_type === 'advance' && (
                    <>
                      <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>
                      <Grid item xs={6}><Typography variant="body2" color="primary" fontWeight="600">💰 Deposit (10%):</Typography></Grid>
                      <Grid item xs={6}><Typography variant="body2" align="right" color="primary" fontWeight="600">{formatAmount(createForm.deposit_amount)}</Typography></Grid>

                      <Grid item xs={6}><Typography variant="body2" color="text.secondary">Remaining (90%):</Typography></Grid>
                      <Grid item xs={6}><Typography variant="body2" align="right" color="text.secondary">{formatAmount(createForm.remaining_amount)}</Typography></Grid>
                    </>
                  )}

                  {createForm.payment_type === 'walk_in' && (
                    <>
                      <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>
                      <Grid item xs={6}><Typography variant="body2" color="success.main" fontWeight="600">💳 Pay Now:</Typography></Grid>
                      <Grid item xs={6}><Typography variant="body2" align="right" color="success.main" fontWeight="600">{formatAmount(createForm.deposit_amount)}</Typography></Grid>
                    </>
                  )}
                </Grid>
              </Box>

            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCreateBooking}>Create Booking</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={categoryDialogOpen} onClose={handleCloseCategoryDialog} maxWidth="sm" fullWidth>
          <DialogTitle>{editingCategory ? 'Edit Table Category' : 'Add Table Category'}</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Code"
                value={categoryForm.code}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  setCategoryForm(prev => ({ ...prev, code: value }));
                  setCategoryFormErrors(prev => ({ ...prev, code: undefined, submit: undefined }));
                }}
                error={Boolean(categoryFormErrors.code)}
                helperText={categoryFormErrors.code}
                inputProps={{ maxLength: 8 }}
              />

              <TextField
                label="Name"
                value={categoryForm.name}
                onChange={(e) => {
                  setCategoryForm(prev => ({ ...prev, name: e.target.value }));
                  setCategoryFormErrors(prev => ({ ...prev, name: undefined, submit: undefined }));
                }}
                error={Boolean(categoryFormErrors.name)}
                helperText={categoryFormErrors.name}
              />

              <TextField
                label="Description"
                value={categoryForm.description}
                onChange={(e) => {
                  setCategoryForm(prev => ({ ...prev, description: e.target.value }));
                  setCategoryFormErrors(prev => ({ ...prev, submit: undefined }));
                }}
                multiline
                minRows={2}
              />

              <TextField
                label="Base Price (First Hour)"
                type="number"
                value={categoryForm.base_price}
                onChange={(e) => {
                  setCategoryForm(prev => ({ ...prev, base_price: e.target.value }));
                  setCategoryFormErrors(prev => ({ ...prev, base_price: undefined, submit: undefined }));
                }}
                error={Boolean(categoryFormErrors.base_price)}
                helperText={categoryFormErrors.base_price}
                inputProps={{ min: 0, step: 10 }}
              />

              <TextField
                label="Additional Hour Price"
                type="number"
                value={categoryForm.extra_hour_price}
                onChange={(e) => {
                  setCategoryForm(prev => ({ ...prev, extra_hour_price: e.target.value }));
                  setCategoryFormErrors(prev => ({ ...prev, extra_hour_price: undefined, submit: undefined }));
                }}
                helperText={categoryFormErrors.extra_hour_price || 'Leave blank to match the base price'}
                error={Boolean(categoryFormErrors.extra_hour_price)}
                inputProps={{ min: 0, step: 10 }}
              />

              <FormControlLabel
                control={(
                  <Switch
                    checked={Boolean(categoryForm.is_active)}
                    onChange={(e) => {
                      setCategoryForm(prev => ({ ...prev, is_active: e.target.checked }));
                      setCategoryFormErrors(prev => ({ ...prev, submit: undefined }));
                    }}
                  />
                )}
                label="Active"
              />

              {categoryFormErrors.submit && (
                <Alert severity="error">{categoryFormErrors.submit}</Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCategoryDialog} disabled={savingCategory}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmitCategory} disabled={savingCategory}>
              {savingCategory ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={tableDialogOpen} onClose={handleCloseTableDialog} maxWidth="sm" fullWidth>
          <DialogTitle>{editingTable ? 'Edit Table' : 'Add Table'}</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Table Number"
                value={tableForm.table_number}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  setTableForm(prev => ({ ...prev, table_number: value }));
                  setTableFormErrors(prev => ({ ...prev, table_number: undefined, submit: undefined }));
                }}
                error={Boolean(tableFormErrors.table_number)}
                helperText={tableFormErrors.table_number}
              />

              <FormControl fullWidth>
                <InputLabel>Table Category</InputLabel>
                <Select
                  label="Table Category"
                  value={tableForm.category_id}
                  onChange={(e) => {
                    setTableForm(prev => ({ ...prev, category_id: e.target.value }));
                    setTableFormErrors(prev => ({ ...prev, submit: undefined }));
                  }}
                >
                  <MenuItem value="">Unassigned</MenuItem>
                  {roomCategories.map(category => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name || category.code}
                      {category.is_active === false ? ' (inactive)' : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Capacity"
                type="number"
                value={tableForm.capacity}
                onChange={(e) => {
                  setTableForm(prev => ({ ...prev, capacity: e.target.value }));
                  setTableFormErrors(prev => ({ ...prev, capacity: undefined, submit: undefined }));
                }}
                helperText={tableFormErrors.capacity || 'Leave blank to use the category default'}
                error={Boolean(tableFormErrors.capacity)}
                inputProps={{ min: 1, step: 1 }}
              />

              <FormControl fullWidth error={Boolean(tableFormErrors.status)}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={tableForm.status}
                  onChange={(e) => {
                    setTableForm(prev => ({ ...prev, status: e.target.value }));
                    setTableFormErrors(prev => ({ ...prev, status: undefined, submit: undefined }));
                  }}
                >
                  {tableStatusOptions.map(status => (
                    <MenuItem key={status} value={status}>
                      {status.replace(/_/g, ' ')}
                    </MenuItem>
                  ))}
                </Select>
                {tableFormErrors.status && (
                  <Typography variant="caption" color="error">{tableFormErrors.status}</Typography>
                )}
              </FormControl>

              <TextField
                label="Description"
                value={tableForm.description}
                onChange={(e) => {
                  setTableForm(prev => ({ ...prev, description: e.target.value }));
                  setTableFormErrors(prev => ({ ...prev, submit: undefined }));
                }}
                multiline
                minRows={2}
              />

              {tableFormErrors.submit && (
                <Alert severity="error">{tableFormErrors.submit}</Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseTableDialog} disabled={savingTable}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmitTable} disabled={savingTable}>
              {savingTable ? 'Saving...' : editingTable ? 'Update Table' : 'Create Table'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={openDetailDialog} onClose={() => setOpenDetailDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Booking Details</DialogTitle>
          <DialogContent>
            {selectedBooking && (
              <Box sx={{ pt: 2 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">Customer</Typography>
                    <Typography variant="body1" fontWeight="600">{selectedBooking.user?.full_name || 'No name'}</Typography>
                    <Typography variant="body2" color="text.secondary">{selectedBooking.user?.email}</Typography>
                    <Typography variant="body2" color="text.secondary">{selectedBooking.user?.phone || '-'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">Table</Typography>
                    <Typography variant="body1" fontWeight="600">Table {selectedBooking.table?.table_number}</Typography>
                    <Typography variant="body2" color="text.secondary">Capacity: {getTableCapacityDisplay(selectedBooking.table)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Room: {selectedBooking.table?.category?.name || selectedBooking.table?.category?.code || '-'}
                      {selectedBooking.table?.category
                        ? ` • ${formatCategoryPricing(selectedBooking.table.category, { style: 'short' })}`
                        : ''}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">Date & Time</Typography>
                    <Typography variant="body1" fontWeight="600">{formatDate(selectedBooking.booking_date)}</Typography>
                    <Typography variant="body2" color="text.secondary">{formatTime(selectedBooking.start_time)} - {formatTime(selectedBooking.end_time)}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                    <Chip icon={getStatusIcon(selectedBooking.status)} label={selectedBooking.status} color={getStatusColor(selectedBooking.status)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">Payment</Typography>
                    <Chip label={selectedBooking.payment_status?.replace('_', ' ') || 'pending'} color={getPaymentStatusColor(selectedBooking.payment_status)} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Type: {selectedBooking.payment_type === 'walk_in' ? 'Walk-in' : 'Advance'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="text.secondary">Amount</Typography>
                    <Typography variant="h6" color="primary" fontWeight="700">{formatAmount(selectedBooking.total_amount)}</Typography>
                    {selectedBooking.payment_type === 'advance' && (
                      <>
                        <Typography variant="caption" color="text.secondary">
                          Deposit: {formatAmount(selectedBooking.deposit_amount)}
                        </Typography>
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          Remaining: {formatAmount(selectedBooking.remaining_amount)}
                        </Typography>
                      </>
                    )}
                  </Grid>
                  {selectedBooking.special_requests && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary">Special Requests</Typography>
                      <Typography variant="body2">{selectedBooking.special_requests}</Typography>
                    </Grid>
                  )}
                  {selectedBooking.rejected_reason && (
                    <Grid item xs={12}>
                      <Alert severity="error"><strong>Rejected:</strong> {selectedBooking.rejected_reason}</Alert>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDetailDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>
     {/* Promotion Dialog */}
        <Dialog open={openPromotionDialog} onClose={handleClosePromotionDialog} fullWidth maxWidth="sm">
          <DialogTitle>Create Promotion Code</DialogTitle>
          <DialogContent dividers>
            <Box display="flex" flexDirection="column" gap={2} mt={1}>
              {promotionFormErrors.submit && (
                <Alert severity="error">{promotionFormErrors.submit}</Alert>
              )}

              <TextField
                label="Promotion Code"
                value={promotionForm.code}
                onChange={handlePromotionFormChange('code')}
                inputProps={{ maxLength: 8 }}
                error={!!promotionFormErrors.code}
                helperText={promotionFormErrors.code || 'Up to 8 uppercase characters.'}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Generate code">
                        <span>
                          <IconButton onClick={handleGeneratePromotionCode} disabled={creatingPromotion} edge="end">
                            <Refresh />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </InputAdornment>
                  )
                }}
              />

              <FormControl fullWidth>
                <InputLabel id="promotion-discount-type-label">Discount Type</InputLabel>
                <Select
                  labelId="promotion-discount-type-label"
                  value={promotionForm.discount_type}
                  label="Discount Type"
                  onChange={handlePromotionFormChange('discount_type')}
                  disabled={creatingPromotion}
                >
                  <MenuItem value="percentage">Percentage (%)</MenuItem>
                  <MenuItem value="fixed_amount">Fixed Amount</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label={promotionForm.discount_type === 'percentage' ? 'Discount Value (%)' : 'Discount Value (THB)'}
                type="number"
                value={promotionForm.discount_value}
                onChange={handlePromotionFormChange('discount_value')}
                error={!!promotionFormErrors.discount_value}
                helperText={promotionFormErrors.discount_value || (promotionForm.discount_type === 'percentage' ? 'Enter a value between 1 and 100.' : 'Enter a positive amount.')}
                inputProps={{ min: 0, step: 0.01 }}
                disabled={creatingPromotion}
              />

              <TextField
                label="Usage Limit"
                type="number"
                value={promotionForm.max_uses}
                onChange={handlePromotionFormChange('max_uses')}
                error={!!promotionFormErrors.max_uses}
                helperText={promotionFormErrors.max_uses || 'Total number of times the code can be redeemed.'}
                inputProps={{ min: 1, step: 1 }}
                disabled={creatingPromotion}
              />

              <TextField
                label="Description (optional)"
                multiline
                minRows={3}
                value={promotionForm.description}
                onChange={handlePromotionFormChange('description')}
                disabled={creatingPromotion}
              />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Start Date"
                    type="date"
                    value={promotionForm.start_date}
                    onChange={handlePromotionFormChange('start_date')}
                    InputLabelProps={{ shrink: true }}
                    disabled={creatingPromotion}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="End Date"
                    type="date"
                    value={promotionForm.end_date}
                    onChange={handlePromotionFormChange('end_date')}
                    InputLabelProps={{ shrink: true }}
                    error={!!promotionFormErrors.end_date}
                    helperText={promotionFormErrors.end_date}
                    disabled={creatingPromotion}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClosePromotionDialog} disabled={creatingPromotion}>Cancel</Button>
            <Button variant="contained" onClick={handleCreatePromotion} disabled={creatingPromotion}>
              {creatingPromotion ? <CircularProgress size={24} /> : 'Save Promotion'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={openRejectDialog} onClose={() => setOpenRejectDialog(false)}>
          <DialogTitle>Reject Booking</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenRejectDialog(false)}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleRejectConfirm} disabled={!rejectReason.trim()}>
              Reject
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
};

export default Reservation;
