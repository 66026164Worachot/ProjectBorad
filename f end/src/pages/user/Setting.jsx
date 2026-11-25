import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Avatar,
  Grid,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Alert,
  Snackbar,
  InputAdornment,
  IconButton,
  CircularProgress,
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper, // Added
  Container as MuiContainer, // Added
  Stack, // Added
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import {
  Home,
  ChevronRight,
  User, // Added
  Lock, // Added
  LogOut, // Added
  ShieldAlert, // Added
} from "lucide-react";
import { motion } from "framer-motion"; // Added
import { settingsAPI } from "../../services/settingsAPI";
import { auth } from "../../utils/auth";

// ### STYLING ###

const MotionPaper = motion(Paper);

// Animation variants from FoodMenu.jsx
const gridContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const gridItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// Themed styles from FoodMenu.jsx
const themedInputStyles = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 2,
    bgcolor: "#f8fafc", // Light gray background
    "&:hover fieldset": { borderColor: "#f5576c" },
    "&.Mui-focused fieldset": {
      borderColor: "#f5576c",
      borderWidth: "2px",
    },
  },
  "& .MuiInputLabel-root.Mui-focused": {
    color: "#f5576c", // Label color on focus
  },
};

const themedButtonStyles = {
  mt: 3,
  textTransform: "none",
  borderRadius: 2,
  fontWeight: 600,
  background: "linear-gradient(135deg, #f093fb 0%, #ff6a00 100%)",
  boxShadow: "0 4px 15px rgba(245,87,108,0.3)",
  "&:hover": {
    background: "linear-gradient(135deg, #e082ea 0%, #ff6b00 100%)",
    boxShadow: "0 6px 20px rgba(245,87,108,0.4)",
  },
  minWidth: 160,
};

// ### COMPONENTS ###

const PasswordField = ({ label, value, onChange, error, helperText, show, onToggle, disabled = false, sx = {} }) => (
  <TextField
    fullWidth
    label={label}
    type={show ? "text" : "password"}
    value={value}
    onChange={onChange}
    error={error}
    helperText={helperText}
    variant="outlined"
    disabled={disabled}
    InputProps={{
      endAdornment: (
        <InputAdornment position="end">
          <IconButton onClick={onToggle} edge="end" disabled={disabled}>
            {show ? <VisibilityOff /> : <Visibility />}
          </IconButton>
        </InputAdornment>
      ),
    }}
    sx={{ ...themedInputStyles, ...sx }}
  />
);

const TextInput = ({ label, value, onChange, error, helperText, disabled = false, ...props }) => (
  <TextField
    fullWidth
    label={label}
    value={value}
    onChange={onChange}
    error={error}
    helperText={helperText}
    variant="outlined"
    disabled={disabled}
    sx={themedInputStyles}
    {...props}
  />
);

// ### HELPER FUNCTIONS ###

const getStoredTimezone = () => {
  if (typeof window === "undefined") return "Bangkok Time";
  try {
    return localStorage.getItem("user_timezone") || "Bangkok Time";
  } catch (error) {
    return "Bangkok Time";
  }
};

const splitFullName = (fullName = "") => {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
};

const buildFullName = (firstName = "", lastName = "") =>
  `${String(firstName).trim()} ${String(lastName).trim()}`.replace(/\s+/g, " ").trim();

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
const validatePassword = (password) => String(password).length >= 8;

// ### MAIN COMPONENT ###

const Setting = () => {
  const defaultTimezone = useMemo(() => getStoredTimezone(), []);

  // ... (All state declarations remain the same) ...
  const [personalInfo, setPersonalInfo] = useState(() => ({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    avatar: "",
    timezone: defaultTimezone,
  }));
  const [initialPersonal, setInitialPersonal] = useState(null);

  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [sessionPassword, setSessionPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false, session: false, delete: false });
  const [loading, setLoading] = useState({ personal: false, password: false, session: false, delete: false });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [errors, setErrors] = useState({});
  const [initializing, setInitializing] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // ... (All handler functions remain the same) ...
  const handleCloseSnackbar = () => setSnackbar((prev) => ({ ...prev, open: false }));
  const showSnackbar = (message, severity = "success") => setSnackbar({ open: true, message, severity });

  const togglePasswordVisibility = (field) => {
    setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const avatarSrc = useMemo(() => {
    if (personalInfo.avatar) return personalInfo.avatar;
    const fallbackName = buildFullName(personalInfo.firstName, personalInfo.lastName) || personalInfo.email || "User";
    const encoded = encodeURIComponent(fallbackName);
    // Changed background color to match theme
    return `https://ui-avatars.com/api/?background=f5576c&color=fff&name=${encoded}`;
  }, [personalInfo.avatar, personalInfo.email, personalInfo.firstName, personalInfo.lastName]);

  // ... (loadProfile, isPersonalDirty, updateField, handleAvatarChange all remain the same) ...
  const loadProfile = useCallback(async () => {
    setInitializing(true);
    setFetchError("");
    try {
      const response = await settingsAPI.getProfile();
      const user = response.data?.data?.user;
      if (!user) {
        throw new Error("Profile not found");
      }

      const { firstName, lastName } = splitFullName(user.full_name);

      setPersonalInfo((prev) => {
        const updated = {
          ...prev,
          firstName,
          lastName,
          email: user.email || "",
          phone: user.phone || "",
        };
        setInitialPersonal({
          firstName: updated.firstName,
          lastName: updated.lastName,
          email: updated.email,
          phone: updated.phone,
          timezone: updated.timezone,
        });
        return updated;
      });
    } catch (error) {
      console.error("LOAD_PROFILE_ERROR", error);
      const message = error.response?.data?.error?.message || "Failed to load profile";
      setFetchError(message);
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const isPersonalDirty = useMemo(() => {
    if (!initialPersonal) return (
      personalInfo.firstName.trim() !== "" ||
      personalInfo.lastName.trim() !== "" ||
      personalInfo.email.trim() !== "" ||
      personalInfo.phone.trim() !== "" ||
      personalInfo.timezone !== defaultTimezone
    );
    return (
      personalInfo.firstName !== initialPersonal.firstName ||
      personalInfo.lastName !== initialPersonal.lastName ||
      personalInfo.email !== initialPersonal.email ||
      (personalInfo.phone || "") !== (initialPersonal.phone || "") ||
      personalInfo.timezone !== initialPersonal.timezone
    );
  }, [defaultTimezone, initialPersonal, personalInfo.email, personalInfo.firstName, personalInfo.lastName, personalInfo.phone, personalInfo.timezone]);

  const updateField = (section, field, value) => {
    if (section === "personal") {
      setPersonalInfo((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: "" }));
      return;
    }
    if (section === "password") {
      setPasswords((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1048576) {
      showSnackbar("File size must be less than 1MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setPersonalInfo((prev) => ({ ...prev, avatar: result }));
        showSnackbar("Avatar updated successfully", "success");
      }
    };
    reader.readAsDataURL(file);
  };

  // ... (handlePersonalInfoSave, handlePasswordChange, handleSessionLogout, handleDeleteAccount all remain the same) ...
  const handlePersonalInfoSave = async () => {
    const newErrors = {};
    const trimmedFirst = personalInfo.firstName.trim();
    const trimmedLast = personalInfo.lastName.trim();

    if (!trimmedFirst) newErrors.firstName = "First name is required";
    if (!trimmedLast) newErrors.lastName = "Last name is required";
    if (!validateEmail(personalInfo.email)) newErrors.email = "Invalid email address";
    if (personalInfo.phone && personalInfo.phone.trim().length < 6) newErrors.phone = "Phone number is too short";

    if (Object.keys(newErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return;
    }

    const payload = {
      fullName: buildFullName(trimmedFirst, trimmedLast),
      email: personalInfo.email.trim(),
      phone: personalInfo.phone.trim() || null,
    };

    setLoading((prev) => ({ ...prev, personal: true }));
    try {
      const response = await settingsAPI.updateProfile(payload);
      const updatedUser = response.data?.data?.user;
      if (updatedUser) {
        const { firstName, lastName } = splitFullName(updatedUser.full_name);
        setPersonalInfo((prev) => ({
          ...prev,
          firstName,
          lastName,
          email: updatedUser.email || "",
          phone: updatedUser.phone || "",
        }));
        setInitialPersonal({
          firstName,
          lastName,
          email: updatedUser.email || "",
          phone: updatedUser.phone || "",
          timezone: personalInfo.timezone,
        });
      } else {
        setInitialPersonal({
          firstName: trimmedFirst,
          lastName: trimmedLast,
          email: personalInfo.email.trim(),
          phone: personalInfo.phone.trim(),
          timezone: personalInfo.timezone,
        });
      }

      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("user_timezone", personalInfo.timezone);
        }
      } catch (error) {
        // ignore storage errors
      }

      showSnackbar(response.data?.message || "Personal information updated successfully", "success");
    } catch (error) {
      console.error("UPDATE_PROFILE_ERROR", error);
      const apiError = error.response?.data?.error;
      const details = apiError?.details || {};
      const apiErrors = {};
      if (details.fullName) {
        apiErrors.firstName = details.fullName;
        apiErrors.lastName = details.fullName;
      }
      if (details.email) {
        apiErrors.email = details.email;
      }
      if (details.phone) {
        apiErrors.phone = details.phone;
      }
      if (Object.keys(apiErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...apiErrors }));
      }
      showSnackbar(apiError?.message || "Failed to update profile", "error");
    } finally {
      setLoading((prev) => ({ ...prev, personal: false }));
    }
  };

  const handlePasswordChange = async () => {
    const newErrors = {};
    if (!passwords.current) newErrors.current = "Current password is required";
    if (!validatePassword(passwords.new)) newErrors.new = "Password must be at least 8 characters";
    if (passwords.new !== passwords.confirm) newErrors.confirm = "Passwords do not match";

    if (Object.keys(newErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return;
    }

    setLoading((prev) => ({ ...prev, password: true }));
    try {
      await settingsAPI.changePassword({ currentPassword: passwords.current, newPassword: passwords.new });
      setPasswords({ current: "", new: "", confirm: "" });
      showSnackbar("Password changed successfully", "success");
    } catch (error) {
      console.error("CHANGE_PASSWORD_ERROR", error);
      const apiError = error.response?.data?.error;
      if (apiError?.code === "INVALID_CURRENT_PASSWORD") {
        setErrors((prev) => ({ ...prev, current: "Current password is incorrect" }));
      } else if (apiError?.code === "WEAK_PASSWORD") {
        setErrors((prev) => ({ ...prev, new: "New password must be at least 8 characters" }));
      } else {
        showSnackbar(apiError?.message || "Failed to change password", "error");
      }
    } finally {
      setLoading((prev) => ({ ...prev, password: false }));
    }
  };

  const handleSessionLogout = async () => {
    if (!sessionPassword) {
      setErrors((prev) => ({ ...prev, session: "Password is required" }));
      return;
    }

    setLoading((prev) => ({ ...prev, session: true }));
    try {
      const currentRefreshToken =
        typeof window !== "undefined" ? localStorage.getItem("refresh_token") || undefined : undefined;
      await settingsAPI.logoutOtherSessions({ password: sessionPassword, currentRefreshToken });
      setSessionPassword("");
      showSnackbar("Logged out of other sessions", "success");
    } catch (error) {
      console.error("LOGOUT_OTHERS_ERROR", error);
      const apiError = error.response?.data?.error;
      if (apiError?.code === "INVALID_PASSWORD") {
        setErrors((prev) => ({ ...prev, session: "Password is incorrect" }));
      } else {
        showSnackbar(apiError?.message || "Failed to log out other sessions", "error");
      }
    } finally {
      setLoading((prev) => ({ ...prev, session: false }));
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setErrors((prev) => ({ ...prev, delete: "Password is required" }));
      return;
    }

    setLoading((prev) => ({ ...prev, delete: true }));
    try {
      await settingsAPI.deleteAccount({ password: deletePassword });
      showSnackbar("Account deleted successfully", "success");
      auth.clearTokens();
      setDeleteDialogOpen(false);
      setDeletePassword("");
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }, 800);
    } catch (error) {
      console.error("DELETE_ACCOUNT_ERROR", error);
      const apiError = error.response?.data?.error;
      if (apiError?.code === "INVALID_PASSWORD") {
        setErrors((prev) => ({ ...prev, delete: "Password is incorrect" }));
      } else {
        showSnackbar(apiError?.message || "Failed to delete account", "error");
      }
    } finally {
      setLoading((prev) => ({ ...prev, delete: false }));
    }
  };

  if (initializing) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ff6a000f", // Themed background
        }}
      >
        {/* Themed progress bar */}
        <CircularProgress size={48} sx={{ color: "#f5576c" }} />
      </Box>
    );
  }

  return (
    // Main container from FoodMenu.jsx
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
      <MuiContainer maxWidth="md" sx={{ position: "relative", zIndex: 1 }}>

        {/* === NEWLY ADDED HEADING === */}
        {/* <Typography
          variant="h3"
          fontWeight="700"
          color="#0f172a"
          sx={{
            mb: 3,
            mt: { xs: 1, sm: 2 },
          }}
        >
          Account Settings
        </Typography> */}
        {/* === END OF NEWLY ADDED HEADING === */}

        {/* Animation container */}
        <motion.div
          variants={gridContainerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Breadcrumbs Card */}
          {/* <MotionPaper
            elevation={3}
            sx={{
              p: 2,
              mb: 4,
              borderRadius: 3,
              background: "white",
              display: "flex",
              alignItems: "center",
            }}
            variants={gridItemVariants}
          >
            <Home size={20} color="#f5576c" /> 
            <Breadcrumbs
              separator={<ChevronRight size={16} color="#94a3b8" />}
              aria-label="breadcrumb"
              sx={{ ml: 1.5 }}
            >
              <Link underline="hover" color="#475569" href="Home">
                Home
              </Link>
              <Link underline="hover" color="#475569" href="#">
                Pages
              </Link>
              <Typography color="#0f172a" fontWeight={600}>
                Account Settings
              </Typography>
            </Breadcrumbs>
          </MotionPaper> */}

          {/* Personal Information Card */}
          <MotionPaper
            elevation={8}
            sx={{
              p: { xs: 3, sm: 4, md: 5 },
              borderRadius: { xs: 3, sm: 4 },
              mb: 4,
              background: "white",
            }}
            variants={gridItemVariants}
          >
            <Grid container alignItems="center" spacing={4} mb={4}>
              <Grid item xs={12} md={8}>
                <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
                  <User size={26} color="#f5576c" />
                  <Typography variant="h4" fontWeight="700" color="#0f172a">
                    Account Settings
                  </Typography>
                </Stack>
                <Typography variant="body2" color="#475569">
                  Update your personal details
                </Typography>
              </Grid>
              <Grid item xs={12} md={4} textAlign={{ xs: "center", md: "right" }}>
                <Box display="inline-block" textAlign="center">
                  <Avatar
                    src={avatarSrc}
                    alt="avatar"
                    sx={{
                      width: 96,
                      height: 96,
                      mx: "auto",
                      mb: 2,
                      border: "4px solid #f1f5f9", // Light border
                    }}
                  />
                  {/* ... (Avatar change button remains commented) ... */}
                </Box>
              </Grid>
            </Grid>

            {fetchError && (
              <Alert
                severity="error" // Standard light-theme error
                sx={{ mb: 3, borderRadius: 2 }}
                action={
                  <Button color="inherit" size="small" onClick={() => loadProfile()}>
                    Retry
                  </Button>
                }
              >
                {fetchError}
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextInput
                  label="First name"
                  value={personalInfo.firstName}
                  onChange={(e) => updateField("personal", "firstName", e.target.value)}
                  error={!!errors.firstName}
                  helperText={errors.firstName}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextInput
                  label="Last name"
                  value={personalInfo.lastName}
                  onChange={(e) => updateField("personal", "lastName", e.target.value)}
                  error={!!errors.lastName}
                  helperText={errors.lastName}
                />
              </Grid>
              <Grid item xs={12}>
                <TextInput
                  label="Email address"
                  type="email"
                  value={personalInfo.email}
                  onChange={(e) => updateField("personal", "email", e.target.value)}
                  error={!!errors.email}
                  helperText={errors.email}
                />
              </Grid>
              <Grid item xs={12}>
                <TextInput
                  label="Phone number"
                  value={personalInfo.phone}
                  onChange={(e) => updateField("personal", "phone", e.target.value)}
                  error={!!errors.phone}
                  helperText={errors.phone || "Add a number we can use for reservations"}
                />
              </Grid>
              {/* ... (Timezone Select remains commented) ... */}
            </Grid>

            <Button
              variant="contained"
              onClick={handlePersonalInfoSave}
              disabled={loading.personal || !isPersonalDirty}
              sx={themedButtonStyles} // Themed button
            >
              {loading.personal ? <CircularProgress size={24} color="inherit" /> : "Save Changes"}
            </Button>
          </MotionPaper>

          {/* Change Password Card */}
          <MotionPaper
            elevation={8}
            sx={{
              p: { xs: 3, sm: 4, md: 5 },
              borderRadius: { xs: 3, sm: 4 },
              mb: 4,
              background: "white",
            }}
            variants={gridItemVariants}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
              <Lock size={22} color="#f5576c" />
              <Typography variant="h6" fontWeight="700" color="#0f172a">
                Change Password
              </Typography>
            </Stack>
            <Typography variant="body2" color="#475569" mb={3}>
              Update your password. Use at least 8 characters.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <PasswordField
                  label="Current password"
                  value={passwords.current}
                  onChange={(e) => updateField("password", "current", e.target.value)}
                  error={!!errors.current}
                  helperText={errors.current}
                  show={showPassword.current}
                  onToggle={() => togglePasswordVisibility("current")}
                  disabled={loading.password}
                />
              </Grid>
              <Grid item xs={12}>
                <PasswordField
                  label="New password"
                  value={passwords.new}
                  onChange={(e) => updateField("password", "new", e.target.value)}
                  error={!!errors.new}
                  helperText={errors.new}
                  show={showPassword.new}
                  onToggle={() => togglePasswordVisibility("new")}
                  disabled={loading.password}
                />
              </Grid>
              <Grid item xs={12}>
                <PasswordField
                  label="Confirm password"
                  value={passwords.confirm}
                  onChange={(e) => updateField("password", "confirm", e.target.value)}
                  error={!!errors.confirm}
                  helperText={errors.confirm}
                  show={showPassword.confirm}
                  onToggle={() => togglePasswordVisibility("confirm")}
                  disabled={loading.password}
                />
              </Grid>
            </Grid>
            <Button
              variant="contained"
              onClick={handlePasswordChange}
              disabled={loading.password}
              sx={themedButtonStyles} // Themed button
            >
              {loading.password ? <CircularProgress size={24} color="inherit" /> : "Update Password"}
            </Button>
          </MotionPaper>

          {/* Log Out Other Sessions Card */}
          <MotionPaper
            elevation={8}
            sx={{
              p: { xs: 3, sm: 4, md: 5 },
              borderRadius: { xs: 3, sm: 4 },
              mb: 4,
              background: "white",
            }}
            variants={gridItemVariants}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
              <LogOut size={22} color="#f5576c" />
              <Typography variant="h6" fontWeight="700" color="#0f172a">
                Log Out Other Sessions
              </Typography>
            </Stack>
            <Typography variant="body2" color="#475569" mb={3}>
              Sign out of all devices except this one. Enter your password to confirm.
            </Typography>
            <PasswordField
              label="Your password"
              value={sessionPassword}
              onChange={(e) => {
                setSessionPassword(e.target.value);
                setErrors((prev) => ({ ...prev, session: "" }));
              }}
              error={!!errors.session}
              helperText={errors.session}
              show={showPassword.session}
              onToggle={() => togglePasswordVisibility("session")}
              disabled={loading.session}
            />
            <Button
              variant="contained"
              onClick={handleSessionLogout}
              disabled={loading.session}
              sx={{ ...themedButtonStyles, minWidth: 200 }} // Themed button
            >
              {loading.session ? <CircularProgress size={24} color="inherit" /> : "Log Out Other Sessions"}
            </Button>
          </MotionPaper>

          {/* Danger Zone Card */}
          <MotionPaper
            elevation={8}
            sx={{
              p: { xs: 3, sm: 4, md: 5 },
              borderRadius: { xs: 3, sm: 4 },
              mb: 4,
              background: "white",
              border: "2px solid #dc2626", // Red border for emphasis
            }}
            variants={gridItemVariants}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
              <ShieldAlert size={22} color="#dc2626" />
              <Typography variant="h6" fontWeight="700" color="#dc2626">
                Danger Zone
              </Typography>
            </Stack>
            <Typography variant="body2" color="#475569" mb={3}>
              Once you delete your account, there is no going back. All data will be permanently deleted.
            </Typography>
            <Alert
              severity="warning"
              sx={{
                mb: 3,
                borderRadius: 2,
                bgcolor: "#fee2e2", // Light red background
                color: "#991b1b",
                "& .MuiAlert-icon": { color: "#dc2626" },
              }}
            >
              This action cannot be undone. Please be certain.
            </Alert>
            <Button
              variant="contained"
              color="error"
              sx={{ textTransform: "none", bgcolor: "#dc2626", "&:hover": { bgcolor: "#b91c1c" } }}
              onClick={() => {
                setDeleteDialogOpen(true);
                setErrors((prev) => ({ ...prev, delete: "" }));
              }}
            >
              Delete My Account
            </Button>
          </MotionPaper>
        </motion.div>
      </MuiContainer>

      {/* Snackbar remains the same */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Dialog now uses default light theme */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          if (!loading.delete) {
            setDeleteDialogOpen(false);
            setDeletePassword("");
          }
        }}
        PaperProps={{
          sx: {
            borderRadius: 3,
            minWidth: { xs: 320, sm: 420 },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 1, color: "#0f172a" }}>
          Delete account
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: "#475569" }} mb={2}>
            Enter your password to confirm you want to delete this account. You will be signed out immediately.
          </Typography>
          <PasswordField
            label="Password"
            value={deletePassword}
            onChange={(e) => {
              setDeletePassword(e.target.value);
              setErrors((prev) => ({ ...prev, delete: "" }));
            }}
            error={!!errors.delete}
            helperText={errors.delete}
            show={showPassword.delete}
            onToggle={() => togglePasswordVisibility("delete")}
            disabled={loading.delete}
            // Use standard input style in dialog
            sx={{
              "& .MuiOutlinedInput-root": {
                "&:hover fieldset": { borderColor: "#f5576c" },
                "&.Mui-focused fieldset": {
                  borderColor: "#f5576c",
                  borderWidth: "2px",
                },
              },
              "& .MuiInputLabel-root.Mui-focused": {
                color: "#f5576c",
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              if (!loading.delete) {
                setDeleteDialogOpen(false);
                setDeletePassword("");
              }
            }}
            sx={{ color: "#475569", textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteAccount}
            disabled={loading.delete}
            sx={{ textTransform: "none" }}
          >
            {loading.delete ? <CircularProgress size={24} color="inherit" /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Setting;