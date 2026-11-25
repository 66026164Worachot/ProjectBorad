import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  InputAdornment,
  Switch,
  FormControlLabel,
  Breadcrumbs,
  Link,
  CircularProgress,
  Tooltip,
  Badge,
  Stack,
  Avatar,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
} from "@mui/material";
import {
  Add,
  Edit,
  Delete,
  Search as SearchIcon,
  Refresh,
  Restaurant,
  Category as CategoryIcon,
  Home,
  ChevronRight,
  AttachMoney,
  Timer,
  Image as ImageIcon,
  LocalOffer,
  ShoppingCart,
  Print,
  Close,
  Remove,
  Warning,
} from "@mui/icons-material";
import { menuAPI } from "../../services/menuAPI";
import { auth } from "../../utils/auth";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const FoodMenu = () => {
  const navigate = useNavigate();
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");

  // Dialog states
  const [openItemDialog, setOpenItemDialog] = useState(false);
  const [openCategoryDialog, setOpenCategoryDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);

  // Form states
  const [itemForm, setItemForm] = useState({
    category_id: "",
    name: "",
    description: "",
    price: "",
    image_url: "",
    is_available: true,
    preparation_time: "",
    tags: [],
    display_order: 0,
    stock_quantity: 0,
    low_stock_threshold: 5,
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    display_order: 0,
    is_active: true,
  });

  // Food Order States
  const [customers, setCustomers] = useState([]);
  const [tables, setTables] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [openOrderDialog, setOpenOrderDialog] = useState(false);
  const [openReceiptDialog, setOpenReceiptDialog] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);

  // Snackbar
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // Current user
  const currentUser = auth.getUserInfo();
  const canEdit = ["staff", "manager"].includes(currentUser?.role);

  // Fetch data
  useEffect(() => {
    fetchCategories();
    fetchCustomersAndTables();
    if (canEdit) fetchStats();
  }, []);

  useEffect(() => {
    fetchMenuItems();
  }, [selectedCategory, searchQuery, availabilityFilter]);

  const fetchCategories = async () => {
    try {
      const response = await menuAPI.getCategories();
      if (response.data.ok) {
        setCategories(response.data.data);
      }
    } catch (error) {
      showSnackbar("Failed to fetch categories", "error");
    }
  };

  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      const response = await menuAPI.getMenuItems({
        categoryId: selectedCategory,
        search: searchQuery,
        isAvailable:
          availabilityFilter === "all"
            ? undefined
            : availabilityFilter === "available",
        limit: 100,
      });

      if (response.data.ok) {
        setMenuItems(response.data.data.items);
      }
    } catch (error) {
      showSnackbar("Failed to fetch menu items", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await menuAPI.getStats();
      if (response.data.ok) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const fetchCustomersAndTables = async () => {
    try {
      const [usersRes, tablesRes, bookingsRes] = await Promise.all([
        api.get("/api/users", { params: { role: "user", limit: 100 } }),
        api.get("/api/reservations/tables"),
        api.get("/api/reservations", {
          params: { status: "checked_in", limit: 100 },
        }),
      ]);

      if (usersRes.data.ok) setCustomers(usersRes.data.data.users);
      if (tablesRes.data.ok) setTables(tablesRes.data.data);
      if (bookingsRes.data.ok) setBookings(bookingsRes.data.data.bookings);
    } catch (error) {
      console.error("Failed to fetch customers/tables:", error);
    }
  };

  const handleOpenItemDialog = (item = null) => {
    if (item) {
      setEditingItem(item);
      setItemForm({
        category_id: item.category_id,
        name: item.name,
        description: item.description || "",
        price: item.price,
        image_url: item.image_url || "",
        is_available: item.is_available,
        preparation_time: item.preparation_time || "",
        tags: item.tags || [],
        display_order: item.display_order || 0,
        stock_quantity: item.stock_quantity || 0,
        low_stock_threshold: item.low_stock_threshold || 5,
      });
    } else {
      setEditingItem(null);
      setItemForm({
        category_id: categories[0]?.id || "",
        name: "",
        description: "",
        price: "",
        image_url: "",
        is_available: true,
        preparation_time: "",
        tags: [],
        display_order: 0,
        stock_quantity: 0,
        low_stock_threshold: 5,
      });
    }
    setOpenItemDialog(true);
  };

  const handleSaveItem = async () => {
    try {
      if (!itemForm.name || !itemForm.category_id || !itemForm.price) {
        showSnackbar("Name, category, and price are required", "error");
        return;
      }

      if (parseFloat(itemForm.price) < 0) {
        showSnackbar("Price must be non-negative", "error");
        return;
      }

      if (editingItem) {
        await menuAPI.updateMenuItem(editingItem.id, itemForm);
        showSnackbar("Menu item updated successfully", "success");
      } else {
        await menuAPI.createMenuItem(itemForm);
        showSnackbar("Menu item created successfully", "success");
      }

      setOpenItemDialog(false);
      fetchMenuItems();
      if (canEdit) fetchStats();
    } catch (error) {
      const message =
        error.response?.data?.error?.message || "Failed to save menu item";
      showSnackbar(message, "error");
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm("Are you sure you want to delete this menu item?"))
      return;

    try {
      await menuAPI.deleteMenuItem(id);
      showSnackbar("Menu item deleted successfully", "success");
      fetchMenuItems();
      if (canEdit) fetchStats();
    } catch (error) {
      const message =
        error.response?.data?.error?.message || "Failed to delete menu item";
      showSnackbar(message, "error");
    }
  };

  const handleToggleAvailability = async (id) => {
    try {
      await menuAPI.toggleMenuItem(id);
      showSnackbar("Availability toggled successfully", "success");
      fetchMenuItems();
      if (canEdit) fetchStats();
    } catch (error) {
      showSnackbar("Failed to toggle availability", "error");
    }
  };

  const handleOpenCategoryDialog = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm(category);
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: "",
        description: "",
        display_order: 0,
        is_active: true,
      });
    }
    setOpenCategoryDialog(true);
  };

  const handleSaveCategory = async () => {
    try {
      if (!categoryForm.name) {
        showSnackbar("Category name is required", "error");
        return;
      }

      if (editingCategory) {
        await menuAPI.updateCategory(editingCategory.id, categoryForm);
        showSnackbar("Category updated successfully", "success");
      } else {
        await menuAPI.createCategory(categoryForm);
        showSnackbar("Category created successfully", "success");
      }

      setOpenCategoryDialog(false);
      fetchCategories();
      if (canEdit) fetchStats();
    } catch (error) {
      showSnackbar("Failed to save category", "error");
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm("Are you sure you want to delete this category?"))
      return;

    try {
      await menuAPI.deleteCategory(id);
      showSnackbar("Category deleted successfully", "success");
      fetchCategories();
      if (canEdit) fetchStats();
    } catch (error) {
      const message =
        error.response?.data?.error?.message || "Failed to delete category";
      showSnackbar(message, "error");
    }
  };

  // ⭐⭐⭐ STOCK VALIDATION FUNCTIONS
  
  /**
   * ดึง stock ที่เหลือจริงๆ หลังหัก quantity ที่อยู่ใน cart แล้ว
   */
  const getAvailableStock = (item) => {
    const cartItem = cart.find((c) => c.menu_item_id === item.id);
    const quantityInCart = cartItem ? cartItem.quantity : 0;
    return item.stock_quantity - quantityInCart;
  };

  /**
   * เพิ่มสินค้าเข้า Cart (พร้อม Stock Validation)
   */
  const addToCart = (item) => {
    // ตรวจสอบ stock
    if (item.stock_quantity <= 0) {
      showSnackbar("Out of stock", "error");
      return;
    }

    const existing = cart.find((c) => c.menu_item_id === item.id);
    const currentQtyInCart = existing ? existing.quantity : 0;

    // ⭐ ตรวจสอบว่าเพิ่มแล้วไม่เกิน stock
    if (currentQtyInCart + 1 > item.stock_quantity) {
      showSnackbar(
        `Cannot add more! Only ${item.stock_quantity} items available in stock`,
        "warning"
      );
      return;
    }

    if (existing) {
      setCart(
        cart.map((c) =>
          c.menu_item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        )
      );
    } else {
      setCart([
        ...cart,
        {
          menu_item_id: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          image_url: item.image_url,
          stock_quantity: item.stock_quantity,
        },
      ]);
    }
    showSnackbar(`${item.name} added to cart`, "success");
  };

  /**
   * อัพเดท quantity ใน Cart (พร้อม Stock Validation)
   */
  const updateQuantity = (menuItemId, delta) => {
    const cartItem = cart.find((c) => c.menu_item_id === menuItemId);
    if (!cartItem) return;

    const newQty = cartItem.quantity + delta;

    // ⭐ ป้องกันเพิ่มเกิน stock
    if (newQty > cartItem.stock_quantity) {
      showSnackbar(
        `Cannot exceed stock limit! Only ${cartItem.stock_quantity} items available`,
        "warning"
      );
      return;
    }

    // ⭐ ถ้าลดจนเหลือ 0 → ลบออกจาก cart
    if (newQty <= 0) {
      setCart(cart.filter((c) => c.menu_item_id !== menuItemId));
      return;
    }

    // อัพเดท quantity
    setCart(
      cart.map((c) =>
        c.menu_item_id === menuItemId ? { ...c, quantity: newQty } : c
      )
    );
  };

  const removeFromCart = (menuItemId) => {
    setCart(cart.filter((c) => c.menu_item_id !== menuItemId));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleOpenOrderDialog = () => {
    if (cart.length === 0) {
      showSnackbar("Please add items to cart first", "warning");
      return;
    }
    setOpenOrderDialog(true);
  };

const handleCreateOrder = async () => {
  try {
    // Validate required fields
    if (!selectedBooking) {
      showSnackbar("Please select a booking", "error");
      return;
    }

    if (cart.length === 0) {
      showSnackbar("Cart is empty", "error");
      return;
    }

    // Prepare order data
    const orderData = {
      booking_id: selectedBooking.id,
      user_id: selectedBooking.user_id,
      table_id: selectedBooking.table_id,
      items: cart.map(item => ({
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.price
      })),
      special_instructions: specialInstructions
    };

    // Send request to correct endpoint
    const response = await api.post("/api/menu/create-order", orderData);

    if (response.data.ok) {
      setCreatedOrder(response.data.data);
      setOpenOrderDialog(false);
      setOpenReceiptDialog(true);
      setCart([]);
      showSnackbar("Order created successfully!", "success");
    }

  } catch (error) {
    console.error("Create order error:", error);
    showSnackbar(
      error.response?.data?.error?.message || "Failed to create order", 
      "error"
    );
  }
};

  const handlePrintReceipt = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Order Receipt - ${createdOrder?.order_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .info { margin-bottom: 20px; }
            .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 12px 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .total { font-size: 1.3em; font-weight: bold; text-align: right; margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; }
            .footer { text-align: center; margin-top: 30px; border-top: 2px solid #000; padding-top: 10px; }
            .status { display: inline-block; padding: 5px 15px; background: #fef3c7; color: #92400e; border-radius: 5px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🍽️ Restaurant Order Receipt</h1>
            <p style="font-size: 1.2em;">Order #${createdOrder?.order_number}</p>
          </div>
          <div class="info">
            <div class="info-row"><strong>Customer:</strong> <span>${
              createdOrder?.user?.email
            }</span></div>
            <div class="info-row"><strong>Table:</strong> <span>Table ${
              createdOrder?.table?.table_number
            }</span></div>
            <div class="info-row"><strong>Date:</strong> <span>${new Date().toLocaleString()}</span></div>
          </div>
          <table>
            <thead><tr><th>Item</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Subtotal</th></tr></thead>
            <tbody>
              ${createdOrder?.items
                ?.map(
                  (item) => `
                <tr>
                  <td>${item.menu_item?.name}</td>
                  <td style="text-align:center;">${item.quantity}</td>
                  <td style="text-align:right;">฿${item.unit_price.toFixed(2)}</td>
                  <td style="text-align:right;">฿${item.subtotal.toFixed(2)}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          <div class="total">Total: ฿${createdOrder?.total_amount.toFixed(2)}</div>
          <div class="footer">
            <p><strong>Payment Status:</strong> <span class="status">PENDING</span></p>
            <p>Thank you! Please proceed to payment verification.</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 4, md: 6 }, minHeight: "100vh" }}>
      <Box sx={{ maxWidth: 1400, mx: "auto" }}>
        {/* Breadcrumb */}
        <Box display="flex" alignItems="center" mb={3}>
          <Home size={20} color="#60a5fa" />
          <Breadcrumbs
            separator={<ChevronRight size={16} color="#94a3b8" />}
            sx={{ ml: 1 }}
          >
            <Link underline="hover" color="#000" href="/admin/dashboard">
              Home
            </Link>
            <Typography color="#1882ec">Food Menu</Typography>
          </Breadcrumbs>
        </Box>

        {/* Header */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={4}
          flexWrap="wrap"
          gap={2}
        >
          <Box>
            <Typography variant="h4" fontWeight="700" gutterBottom>
              Food Menu Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage menu items and create food orders
            </Typography>
          </Box>

          <Stack direction="row" spacing={2} flexWrap="wrap">
            {canEdit && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<CategoryIcon />}
                  onClick={() => handleOpenCategoryDialog()}
                >
                  Add Category
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={() => handleOpenItemDialog()}
                >
                  Add Menu Item
                </Button>
              </>
            )}
            <Badge badgeContent={cart.length} color="error">
              <Button
                variant="contained"
                startIcon={<ShoppingCart />}
                onClick={handleOpenOrderDialog}
                disabled={cart.length === 0}
              >
                Cart (฿{calculateTotal().toFixed(2)})
              </Button>
            </Badge>
          </Stack>
        </Box>

        {/* Stats Cards */}
        {stats && canEdit && (
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Items
                  </Typography>
                  <Typography variant="h4" fontWeight="700">
                    {stats.totalItems}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Available
                  </Typography>
                  <Typography
                    variant="h4"
                    fontWeight="700"
                    color="success.main"
                  >
                    {stats.availableItems}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Unavailable
                  </Typography>
                  <Typography variant="h4" fontWeight="700" color="error.main">
                    {stats.unavailableItems}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Categories
                  </Typography>
                  <Typography variant="h4" fontWeight="700">
                    {stats.totalCategories}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          sx={{ mb: 3 }}
        >
          <Tab label="Menu Items" />
          {canEdit && <Tab label="Categories" />}
        </Tabs>

        {/* Tab 1: Menu Items */}
        {activeTab === 0 && (
          <>
            {/* Search & Filters */}
            <Card sx={{ mb: 3, p: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    placeholder="Search menu items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={selectedCategory}
                      label="Category"
                      onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                      <MenuItem value="all">All Categories</MenuItem>
                      {categories.map((cat) => (
                        <MenuItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Availability</InputLabel>
                    <Select
                      value={availabilityFilter}
                      label="Availability"
                      onChange={(e) => setAvailabilityFilter(e.target.value)}
                    >
                      <MenuItem value="all">All Items</MenuItem>
                      <MenuItem value="available">Available Only</MenuItem>
                      <MenuItem value="unavailable">Unavailable Only</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={fetchMenuItems}
                  >
                    Refresh
                  </Button>
                </Grid>
              </Grid>
            </Card>

            {/* Menu Items Grid */}
            {loading ? (
              <Box display="flex" justifyContent="center" py={8}>
                <CircularProgress />
              </Box>
            ) : menuItems.length === 0 ? (
              <Card sx={{ p: 8, textAlign: "center" }}>
                <Restaurant
                  sx={{ fontSize: 64, color: "text.secondary", mb: 2 }}
                />
                <Typography variant="h6" color="text.secondary">
                  No menu items found
                </Typography>
              </Card>
            ) : (
              <Grid container spacing={3}>
                {menuItems.map((item) => {
                  const availableStock = getAvailableStock(item);
                  const isInCart = cart.some((c) => c.menu_item_id === item.id);
                  
                  return (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
                      <Card
                        sx={{
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          position: "relative",
                          opacity: item.is_available ? 1 : 0.6,
                          transition: "all 0.3s",
                          "&:hover": {
                            transform: "translateY(-4px)",
                            boxShadow: 3,
                          },
                        }}
                      >
                        <CardMedia
                          component="img"
                          height="200"
                          image={
                            item.image_url ||
                            "https://via.placeholder.com/300x200?text=No+Image"
                          }
                          alt={item.name}
                          sx={{ objectFit: "cover" }}
                        />

                        {/* Availability Badge */}
                        <Chip
                          label={item.is_available ? "Available" : "Unavailable"}
                          color={item.is_available ? "success" : "error"}
                          size="small"
                          sx={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            fontWeight: 600,
                          }}
                        />

                        {/* Stock Warning Badges */}
                        {item.stock_quantity === 0 ? (
                          <Chip
                            label="OUT OF STOCK"
                            color="error"
                            size="small"
                            sx={{
                              position: "absolute",
                              top: 8,
                              left: 8,
                              fontWeight: 600,
                            }}
                          />
                        ) : availableStock < 5 && availableStock > 0 ? (
                          <Chip
                            label={`⚠️ Only ${availableStock} left`}
                            color="warning"
                            size="small"
                            sx={{
                              position: "absolute",
                              top: 8,
                              left: 8,
                              fontWeight: 600,
                              animation: "pulse 2s infinite",
                            }}
                          />
                        ) : null}

                        {/* In Cart Indicator */}
                        {isInCart && (
                          <Chip
                            label="✓ In Cart"
                            color="primary"
                            size="small"
                            sx={{
                              position: "absolute",
                              top: 45,
                              right: 8,
                              fontWeight: 600,
                            }}
                          />
                        )}

                        <CardContent sx={{ flexGrow: 1 }}>
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="start"
                            mb={1}
                          >
                            <Typography variant="h6" fontWeight="600">
                              {item.name}
                            </Typography>
                          </Box>
                          <Chip
                            label={item.category?.name || "No category"}
                            size="small"
                            sx={{ mb: 1 }}
                          />
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 2, minHeight: 40 }}
                          >
                            {item.description || "No description"}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <AttachMoney fontSize="small" color="primary" />
                            <Typography
                              variant="h6"
                              color="primary.main"
                              fontWeight="700"
                            >
                              {item.price}
                            </Typography>
                          </Box>

                          {/* ⭐ Stock Display with Available Count */}
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <Typography variant="body2" color="text.secondary">
                              Stock:
                            </Typography>
                            <Chip
                              label={`${item.stock_quantity} total`}
                              size="small"
                              color={
                                item.stock_quantity === 0
                                  ? "error"
                                  : item.stock_quantity < 5
                                  ? "warning"
                                  : "success"
                              }
                              sx={{ fontWeight: 600 }}
                            />
                            {isInCart && (
                              <Chip
                                label={`${availableStock} available`}
                                size="small"
                                variant="outlined"
                                color="info"
                                sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                              />
                            )}
                          </Box>

                          {item.preparation_time && (
                            <Box display="flex" alignItems="center" gap={1}>
                              <Timer fontSize="small" color="action" />
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {item.preparation_time} mins
                              </Typography>
                            </Box>
                          )}
                        </CardContent>

                        <CardActions
                          sx={{ justifyContent: "space-between", px: 2, pb: 2 }}
                        >
                          {canEdit ? (
                            <Box display="flex" gap={1} width="100%">
                              <Tooltip title="Toggle availability">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    handleToggleAvailability(item.id)
                                  }
                                >
                                  <LocalOffer fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleOpenItemDialog(item)}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteItem(item.id)}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Box flexGrow={1} />
                              <Tooltip 
                                title={
                                  item.stock_quantity === 0 
                                    ? "Out of stock" 
                                    : availableStock === 0 
                                    ? "All items in cart" 
                                    : "Add to cart"
                                }
                              >
                                <span>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    startIcon={<Add />}
                                    onClick={() => addToCart(item)}
                                    disabled={availableStock === 0}
                                  >
                                    Cart
                                  </Button>
                                </span>
                              </Tooltip>
                            </Box>
                          ) : (
                            <Tooltip 
                              title={
                                !item.is_available 
                                  ? "Item unavailable" 
                                  : item.stock_quantity === 0 
                                  ? "Out of stock" 
                                  : availableStock === 0 
                                  ? "All items in cart" 
                                  : "Add to cart"
                              }
                            >
                              <span style={{ width: '100%' }}>
                                <Button
                                  fullWidth
                                  variant="contained"
                                  startIcon={<Add />}
                                  onClick={() => addToCart(item)}
                                  disabled={
                                    !item.is_available || 
                                    item.stock_quantity === 0 || 
                                    availableStock === 0
                                  }
                                >
                                  Add to Cart
                                </Button>
                              </span>
                            </Tooltip>
                          )}
                        </CardActions>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </>
        )}

        {/* Tab 2: Categories */}
        {activeTab === 1 && canEdit && (
          <Grid container spacing={3}>
            {categories.map((category) => (
              <Grid item xs={12} sm={6} md={4} key={category.id}>
                <Card>
                  <CardContent>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="start"
                      mb={2}
                    >
                      <Typography variant="h6" fontWeight="600">
                        {category.name}
                      </Typography>
                      <Chip
                        label={category.is_active ? "Active" : "Inactive"}
                        color={category.is_active ? "success" : "default"}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {category.description || "No description"}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleOpenCategoryDialog(category)}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteCategory(category.id)}
                    >
                      <Delete />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Menu Item Dialog */}
        <Dialog
          open={openItemDialog}
          onClose={() => setOpenItemDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {editingItem ? "Edit Menu Item" : "Add Menu Item"}
          </DialogTitle>
          <DialogContent>
            <Box
              sx={{ pt: 2, display: "flex", flexDirection: "column", gap: 2 }}
            >
              <FormControl fullWidth required>
                <InputLabel>Category</InputLabel>
                <Select
                  value={itemForm.category_id}
                  label="Category"
                  onChange={(e) =>
                    setItemForm({ ...itemForm, category_id: e.target.value })
                  }
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                required
                label="Name"
                value={itemForm.name}
                onChange={(e) =>
                  setItemForm({ ...itemForm, name: e.target.value })
                }
              />

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={itemForm.description}
                onChange={(e) =>
                  setItemForm({ ...itemForm, description: e.target.value })
                }
              />

              <TextField
                fullWidth
                required
                type="number"
                label="Price"
                value={itemForm.price}
                onChange={(e) =>
                  setItemForm({ ...itemForm, price: e.target.value })
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start"></InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Image URL"
                value={itemForm.image_url}
                onChange={(e) =>
                  setItemForm({ ...itemForm, image_url: e.target.value })
                }
                placeholder="https://example.com/image.jpg"
              />

              <TextField
                fullWidth
                type="number"
                label="Preparation Time (minutes)"
                value={itemForm.preparation_time}
                onChange={(e) =>
                  setItemForm({ ...itemForm, preparation_time: e.target.value })
                }
              />

              <TextField
                fullWidth
                required
                type="number"
                label="Stock Quantity"
                value={itemForm.stock_quantity}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    stock_quantity: parseInt(e.target.value) || 0,
                  })
                }
                helperText="Current quantity in stock"
                InputProps={{
                  inputProps: { min: 0 },
                }}
              />

              <TextField
                fullWidth
                type="number"
                label="Low Stock Threshold"
                value={itemForm.low_stock_threshold}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    low_stock_threshold: parseInt(e.target.value) || 5,
                  })
                }
                helperText="Alert when stock falls below this number (default: 5)"
                InputProps={{
                  inputProps: { min: 1 },
                }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={itemForm.is_available}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        is_available: e.target.checked,
                      })
                    }
                  />
                }
                label="Available for ordering"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenItemDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveItem}>
              {editingItem ? "Save Changes" : "Create Item"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Category Dialog */}
        <Dialog
          open={openCategoryDialog}
          onClose={() => setOpenCategoryDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {editingCategory ? "Edit Category" : "Add Category"}
          </DialogTitle>
          <DialogContent>
            <Box
              sx={{ pt: 2, display: "flex", flexDirection: "column", gap: 2 }}
            >
              <TextField
                fullWidth
                required
                label="Name"
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, name: e.target.value })
                }
              />
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Description"
                value={categoryForm.description}
                onChange={(e) =>
                  setCategoryForm({
                    ...categoryForm,
                    description: e.target.value,
                  })
                }
              />
              <TextField
                fullWidth
                type="number"
                label="Display Order"
                value={categoryForm.display_order}
                onChange={(e) =>
                  setCategoryForm({
                    ...categoryForm,
                    display_order: parseInt(e.target.value),
                  })
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={categoryForm.is_active}
                    onChange={(e) =>
                      setCategoryForm({
                        ...categoryForm,
                        is_active: e.target.checked,
                      })
                    }
                  />
                }
                label="Active"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenCategoryDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveCategory}>
              {editingCategory ? "Save Changes" : "Create Category"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Order Dialog */}
        <Dialog
          open={openOrderDialog}
          onClose={() => setOpenOrderDialog(false)}
          maxWidth="md"
          fullWidth
        >
  <DialogTitle>
    <Box display="flex" justifyContent="space-between" alignItems="center">
      <Typography variant="h6" fontWeight="700">
        🛒 Create Food Order
      </Typography>
      <IconButton onClick={() => setOpenOrderDialog(false)} size="small">
        <Close />
      </IconButton>
    </Box>
  </DialogTitle>

          <DialogContent dividers>
            <Stack spacing={3}>
              {/* Customer Selection */}
              {/* <Box>
                <Typography variant="subtitle2" fontWeight="600" mb={1}>
                  1. Select Customer *
                </Typography>
                <Autocomplete
                  options={customers}
                  getOptionLabel={(option) =>
                    `${option.full_name || option.email} (${option.email})`
                  }
                  value={selectedCustomer}
                  onChange={(e, newValue) => setSelectedCustomer(newValue)}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="Search customer..." />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.id}>
                      <Avatar sx={{ mr: 2, bgcolor: "#3b82f6" }}>
                        {option.full_name?.[0] || option.email[0]}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="600">
                          {option.full_name || "No name"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.email}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                />
              </Box> */}

              {/* Table Selection */}
              {/* <Box>
                <Typography variant="subtitle2" fontWeight="600" mb={1}>
                  2. Select Table *
                </Typography>
                <Autocomplete
                  options={tables}
                  getOptionLabel={(option) =>
                    `Table ${option.table_number} (Capacity: ${
                      option.capacity ??
                      option.category?.default_capacity ??
                      option.category?.capacity ??
                      '-'
                    })`
                  }
                  value={selectedTable}
                  onChange={(e, newValue) => setSelectedTable(newValue)}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="Select table..." />
                  )}
                />
              </Box> */}

              {/* Booking Selection */}
              <Box>
                <Typography variant="subtitle2" fontWeight="600" mb={1}>
                  3. Select Booking *
                </Typography>
                <Autocomplete
                  options={bookings}
                  getOptionLabel={(option) =>
                    `${option.booking_date} - Table ${option.table?.table_number} • ${option.table?.category?.name || option.table?.category?.code || 'Room'}`
                  }
                  value={selectedBooking}
                  onChange={(e, newValue) => setSelectedBooking(newValue)}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="Select booking..." />
                  )}
                />
              </Box>

              {/* Special Instructions */}
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Special Instructions (Optional)"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Any special requests..."
              />

              <Divider />

              {/* Cart Items */}
              <Box>
                <Typography variant="subtitle1" fontWeight="600" gutterBottom>
                  4. Order Items ({cart.length})
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ bgcolor: "#f8fafc" }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>
                          Quantity
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          Price
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          Subtotal
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>
                          Action
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cart.map((item) => (
                        <TableRow key={item.menu_item_id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight="600">
                              {item.name}
                            </Typography>
                            {/* ⭐ แสดง Stock Warning */}
                            <Typography variant="caption" color="text.secondary">
                              Stock: {item.stock_quantity}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Box
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              gap={1}
                            >
                              <Tooltip title="Decrease quantity">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    updateQuantity(item.menu_item_id, -1)
                                  }
                                  sx={{ bgcolor: "#f1f5f9" }}
                                >
                                  <Remove fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Typography
                                fontWeight="600"
                                sx={{ minWidth: 30, textAlign: "center" }}
                              >
                                {item.quantity}
                              </Typography>
                              <Tooltip 
                                title={
                                  item.quantity >= item.stock_quantity
                                    ? `Max stock:${item.stock_quantity}`
                                    : "Increase quantity"
                                }
                              >
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      updateQuantity(item.menu_item_id, 1)
                                    }
                                    sx={{ bgcolor: "#f1f5f9" }}
                                    disabled={item.quantity >= item.stock_quantity}
                                  >
                                    <Add fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Box>
                            {/* ⭐ แสดง Warning ถ้าใกล้ถึง Max */}
                            {item.quantity >= item.stock_quantity && (
                              <Typography 
                                variant="caption" 
                                color="warning.main"
                                sx={{ display: 'block', mt: 0.5 }}
                              >
                                Max reached
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            ฿{item.price.toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            ฿{(item.price * item.quantity).toFixed(2)}
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="Remove from cart">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => removeFromCart(item.menu_item_id)}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mt={2}
                  p={2}
                  bgcolor="#f8fafc"
                  borderRadius={2}
                >
                  <Typography variant="h6" fontWeight="700">
                    Total Amount:
                  </Typography>
                  <Typography variant="h4" fontWeight="700" color="primary">
                    ฿{calculateTotal().toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </Stack>
          </DialogContent>

<DialogActions sx={{ p: 2.5 }}>
  <Button onClick={() => setOpenOrderDialog(false)}>Cancel</Button>
  <Button
    variant="contained"
    onClick={handleCreateOrder}
    disabled={!selectedBooking || cart.length === 0}
    sx={{ px: 3 }}
  >
    Create Order & Generate Payment
  </Button>
</DialogActions>
        </Dialog>

        {/* Receipt Dialog */}
        <Dialog
          open={openReceiptDialog}
          onClose={() => setOpenReceiptDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="h6" fontWeight="700">
                ✅ Order Created Successfully!
              </Typography>
              <IconButton
                onClick={() => setOpenReceiptDialog(false)}
                size="small"
              >
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>

          <DialogContent dividers>
            <Box textAlign="center" py={3}>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  bgcolor: "success.light",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mx: "auto",
                  mb: 2,
                }}
              >
                <Restaurant sx={{ fontSize: 40, color: "success.dark" }} />
              </Box>

              <Typography variant="h6" fontWeight="600" gutterBottom>
                Order #{createdOrder?.order_number}
              </Typography>

              <Chip
                label="Payment Pending"
                color="warning"
                sx={{ mb: 3, fontWeight: 600 }}
              />

              <Alert severity="info" sx={{ textAlign: "left", mb: 3 }}>
                <Typography variant="body2" gutterBottom fontWeight="600">
                  📋 Next Steps:
                </Typography>
                <Typography variant="body2" component="div">
                  1. Print the receipt for the customer
                  <br />
                  2. Customer pays via bank transfer
                  <br />
                  3. Customer shows payment proof
                  <br />
                  4. Go to <strong>Slip Management</strong> page
                  <br />
                  5. Verify the payment slip
                </Typography>
              </Alert>

              <Box p={3} bgcolor="#f8fafc" borderRadius={2}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Order Total Amount
                </Typography>
                <Typography variant="h3" fontWeight="700" color="primary">
                  ฿{createdOrder?.total_amount?.toFixed(2) || "0.00"}
                </Typography>
              </Box>
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 2.5, gap: 1 }}>
            <Button onClick={() => setOpenReceiptDialog(false)}>Close</Button>
            <Button
              variant="outlined"
              startIcon={<Print />}
              onClick={handlePrintReceipt}
            >
              Print Receipt
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                setOpenReceiptDialog(false);
                navigate("/admin/slip");
              }}
            >
              Go to Slip Management →
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            severity={snackbar.severity}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>

        {/* CSS Animations */}
        <style>{`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.7;
            }
          }
        `}</style>
      </Box>
    </Box>
  );
};

export default FoodMenu;