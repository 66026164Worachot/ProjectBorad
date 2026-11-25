import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Avatar,
  Grid,
  Alert,
  Snackbar,
  InputAdornment,
  IconButton,
  CircularProgress,
  Breadcrumbs,
  Link,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { Home, ChevronRight } from "lucide-react";
import { settingsAPI } from "../../services/settingsAPI";
import { auth } from "../../utils/auth";

const styles = {
  container: {
    color: "white",
    minHeight: "100vh",
    p: { xs: 2, sm: 4, md: 6 },
  },
  card: {
    bgcolor: "#1e293b",
    borderRadius: 3,
    p: { xs: 3, sm: 5 },
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
  },
  input: {
    input: { color: "white" },
    "& .MuiOutlinedInput-root": {
      "& fieldset": { borderColor: "#334155" },
      "&:hover fieldset": { borderColor: "#60a5fa" },
      "&.Mui-error fieldset": { borderColor: "#ef4444" },
    },
  },
  button: {
    mt: 3,
    bgcolor: "#6366f1",
    "&:hover": { bgcolor: "#4f46e5" },
    textTransform: "none",
    minWidth: 160,
  },
};

const PasswordField = ({ label, value, onChange, error, helperText, show, onToggle, disabled = false }) => (
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
    InputLabelProps={{ style: { color: "#9ca3af" } }}
    InputProps={{
      endAdornment: (
        <InputAdornment position="end">
          <IconButton onClick={onToggle} edge="end" sx={{ color: "#9ca3af" }} disabled={disabled}>
            {show ? <VisibilityOff /> : <Visibility />}
          </IconButton>
        </InputAdornment>
      ),
    }}
    sx={styles.input}
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
    InputLabelProps={{ style: { color: "#9ca3af" } }}
    sx={styles.input}
    {...props}
  />
);

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const initialsFromName = (name = "", email = "") => {
  const trimmed = name.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "U";
  }
  return email ? email.charAt(0).toUpperCase() : "U";
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());

const Setting = () => {
  const [profile, setProfile] = useState({ fullName: "", email: "", phone: "" });
  const [profileMeta, setProfileMeta] = useState({ role: "", createdAt: "", updatedAt: "", id: "" });
  const [initialProfile, setInitialProfile] = useState(null);

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

  const handleCloseSnackbar = () => setSnackbar((prev) => ({ ...prev, open: false }));
  const showSnackbar = (message, severity = "success") => setSnackbar({ open: true, message, severity });

  const togglePasswordVisibility = (field) => {
    setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const loadProfile = useCallback(async () => {
    setInitializing(true);
    setFetchError("");
    try {
      const response = await settingsAPI.getProfile();
      const user = response.data?.data?.user;
      if (!user) {
        throw new Error("Profile not found");
      }

      const normalized = {
        fullName: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
      };

      setProfile(normalized);
      setInitialProfile(normalized);
      setProfileMeta({
        role: user.role || "",
        createdAt: user.created_at || "",
        updatedAt: user.updated_at || "",
        id: user.id || "",
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
    if (!initialProfile) return false;
    return (
      profile.fullName !== initialProfile.fullName ||
      profile.email !== initialProfile.email ||
      (profile.phone || "") !== (initialProfile.phone || "")
    );
  }, [initialProfile, profile.email, profile.fullName, profile.phone]);

  const updateProfileField = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handlePersonalInfoSave = async () => {
    const newErrors = {};
    if (!profile.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!validateEmail(profile.email)) newErrors.email = "Invalid email address";
    if (profile.phone && profile.phone.trim().length < 6) newErrors.phone = "Phone number is too short";

    if (Object.keys(newErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return;
    }

    setLoading((prev) => ({ ...prev, personal: true }));
    try {
      const payload = {
        fullName: profile.fullName.trim(),
        email: profile.email.trim(),
        phone: profile.phone ? profile.phone.trim() : null,
      };

      const response = await settingsAPI.updateProfile(payload);
      const user = response.data?.data?.user;
      const normalized = {
        fullName: user?.full_name || payload.fullName,
        email: user?.email || payload.email,
        phone: user?.phone || payload.phone || "",
      };

      setProfile(normalized);
      setInitialProfile(normalized);
      setProfileMeta((prev) => ({ ...prev, updatedAt: user?.updated_at || prev.updatedAt }));
      showSnackbar(response.data?.message || "Profile updated successfully", "success");
    } catch (error) {
      console.error("UPDATE_PROFILE_ERROR", error);
      const apiError = error.response?.data?.error;
      if (apiError?.details) {
        setErrors((prev) => ({ ...prev, ...apiError.details }));
      }
      if (apiError?.code === "EMAIL_EXISTS") {
        setErrors((prev) => ({ ...prev, email: "Email is already in use" }));
      }
      showSnackbar(apiError?.message || "Failed to update profile", "error");
    } finally {
      setLoading((prev) => ({ ...prev, personal: false }));
    }
  };

  const handlePasswordChange = async () => {
    const newErrors = {};
    if (!passwords.current) newErrors.current = "Current password is required";
    if (!passwords.new || passwords.new.length < 8) newErrors.new = "Password must be at least 8 characters";
    if (passwords.new !== passwords.confirm) newErrors.confirm = "Passwords do not match";

    if (Object.keys(newErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return;
    }

    setLoading((prev) => ({ ...prev, password: true }));
    try {
      await settingsAPI.changePassword({ currentPassword: passwords.current, newPassword: passwords.new });
      setPasswords({ current: "", new: "", confirm: "" });
      showSnackbar("Password updated successfully", "success");
    } catch (error) {
      console.error("CHANGE_PASSWORD_ERROR", error);
      const apiError = error.response?.data?.error;
      if (apiError?.code === "INVALID_CURRENT_PASSWORD") {
        setErrors((prev) => ({ ...prev, current: "Current password is incorrect" }));
      } else if (apiError?.code === "WEAK_PASSWORD") {
        setErrors((prev) => ({ ...prev, new: "New password is too weak" }));
      }
      showSnackbar(apiError?.message || "Failed to change password", "error");
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
      await settingsAPI.logoutOtherSessions({
        password: sessionPassword,
        currentRefreshToken: auth.getRefreshToken(),
      });
      setSessionPassword("");
      setErrors((prev) => ({ ...prev, session: "" }));
      showSnackbar("Logged out of other sessions", "success");
    } catch (error) {
      console.error("LOGOUT_OTHER_SESSIONS_ERROR", error);
      const apiError = error.response?.data?.error;
      if (apiError?.code === "INVALID_PASSWORD") {
        setErrors((prev) => ({ ...prev, session: "Password is incorrect" }));
      } else if (apiError?.code === "INVALID_REFRESH") {
        showSnackbar("Refresh token was invalid. You may need to sign in again.", "warning");
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
      setDeleteDialogOpen(false);
      setDeletePassword("");
      setErrors((prev) => ({ ...prev, delete: "" }));
      showSnackbar("Account deleted successfully", "success");
      auth.clearTokens();
      setTimeout(() => {
        window.location.href = "/login";
      }, 1200);
    } catch (error) {
      console.error("DELETE_ACCOUNT_ERROR", error);
      const apiError = error.response?.data?.error;
      if (apiError?.code === "INVALID_PASSWORD") {
        setErrors((prev) => ({ ...prev, delete: "Password is incorrect" }));
      } else if (apiError?.code === "HAS_RELATIONS" || apiError?.code === "FOREIGN_KEY_VIOLATION") {
        setErrors((prev) => ({ ...prev, delete: apiError.message }));
      }
      showSnackbar(apiError?.message || "Failed to delete account", "error");
    } finally {
      setLoading((prev) => ({ ...prev, delete: false }));
    }
  };

  if (initializing && !initialProfile) {
    return (
      <Box sx={{ ...styles.container, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress color="inherit" />
      </Box>
    );
  }

  return (
    <Box sx={styles.container}>
      <Box sx={{ maxWidth: 1300, mx: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        <Box display="flex" alignItems="center" mb={1}>
          <Home size={20} color="#60a5fa" />
          <Breadcrumbs
            separator={<ChevronRight size={16} color="#94a3b8" />}
            aria-label="breadcrumb"
            sx={{ ml: 1, color: "#cbd5e1" }}
          >
            <Link underline="hover" color="#000000ff" href="Home">
              Home
            </Link>
            <Link underline="hover" color="#000000ff" href="#">
              Pages
            </Link>
            <Typography color="#1882ecff">Account Settings</Typography>
          </Breadcrumbs>
        </Box>

        {fetchError && (
          <Alert
            severity="error"
            sx={{ bgcolor: "#7f1d1d", color: "#fecaca", "& .MuiAlert-icon": { color: "#fecaca" } }}
            action={
              <Button color="inherit" size="small" onClick={loadProfile}>
                Retry
              </Button>
            }
          >
            {fetchError}
          </Alert>
        )}

        <Box sx={styles.card}>
          <Grid container alignItems="center" spacing={4} mb={4}>
            <Grid item xs={12} md={7}>
              <Typography variant="h6" fontWeight="600" mb={1}>
                Personal Information
              </Typography>
              <Typography variant="body2" color="gray">
                Update your account details so colleagues see accurate contact information.
              </Typography>
            </Grid>
            <Grid item xs={12} md={5} textAlign={{ xs: "center", md: "right" }}>
              <Box display="inline-flex" flexDirection="column" alignItems="center" gap={1}>
                <Avatar
                  sx={{
                    width: 96,
                    height: 96,
                    fontSize: 32,
                    bgcolor: "#334155",
                    border: "4px solid #1e293b",
                  }}
                >
                  {initialsFromName(profile.fullName, profile.email)}
                </Avatar>
                <Typography variant="body2" color="gray">
                  Role: {profileMeta.role ? profileMeta.role.toUpperCase() : "—"}
                </Typography>
                <Typography variant="caption" color="gray">
                  Last updated: {formatDateTime(profileMeta.updatedAt)}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextInput
                label="Full name"
                value={profile.fullName}
                onChange={(e) => updateProfileField("fullName", e.target.value)}
                error={Boolean(errors.fullName)}
                helperText={errors.fullName}
                disabled={loading.personal}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextInput
                label="Email address"
                type="email"
                value={profile.email}
                onChange={(e) => updateProfileField("email", e.target.value)}
                error={Boolean(errors.email)}
                helperText={errors.email}
                disabled={loading.personal}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextInput
                label="Phone number"
                value={profile.phone}
                onChange={(e) => updateProfileField("phone", e.target.value)}
                error={Boolean(errors.phone)}
                helperText={errors.phone}
                disabled={loading.personal}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3, borderColor: "#334155" }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="gray">
                Member since
              </Typography>
              <Typography variant="body2">{formatDateTime(profileMeta.createdAt)}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="gray">
                User ID
              </Typography>
              <Typography variant="body2">{profileMeta.id || "—"}</Typography>
            </Grid>
          </Grid>

          <Button
            variant="contained"
            onClick={handlePersonalInfoSave}
            disabled={loading.personal || !isPersonalDirty}
            sx={styles.button}
          >
            {loading.personal ? <CircularProgress size={24} color="inherit" /> : "Save changes"}
          </Button>
        </Box>

        <Box sx={styles.card}>
          <Typography variant="h6" fontWeight="600" mb={1}>
            Change Password
          </Typography>
          <Typography variant="body2" color="gray" mb={3}>
            Use a long, random password to keep your account secure.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <PasswordField
                label="Current password"
                value={passwords.current}
                onChange={(e) => {
                  setPasswords((prev) => ({ ...prev, current: e.target.value }));
                  setErrors((prev) => ({ ...prev, current: "" }));
                }}
                error={Boolean(errors.current)}
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
                onChange={(e) => {
                  setPasswords((prev) => ({ ...prev, new: e.target.value }));
                  setErrors((prev) => ({ ...prev, new: "" }));
                }}
                error={Boolean(errors.new)}
                helperText={errors.new || "Minimum 8 characters"}
                show={showPassword.new}
                onToggle={() => togglePasswordVisibility("new")}
                disabled={loading.password}
              />
            </Grid>
            <Grid item xs={12}>
              <PasswordField
                label="Confirm password"
                value={passwords.confirm}
                onChange={(e) => {
                  setPasswords((prev) => ({ ...prev, confirm: e.target.value }));
                  setErrors((prev) => ({ ...prev, confirm: "" }));
                }}
                error={Boolean(errors.confirm)}
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
            sx={styles.button}
          >
            {loading.password ? <CircularProgress size={24} color="inherit" /> : "Update password"}
          </Button>
        </Box>

        <Box sx={styles.card}>
          <Typography variant="h6" fontWeight="600" mb={1}>
            Log Out Other Sessions
          </Typography>
          <Typography variant="body2" color="gray" mb={3}>
            Enter your password to revoke refresh tokens on every other device.
          </Typography>
          <PasswordField
            label="Your password"
            value={sessionPassword}
            onChange={(e) => {
              setSessionPassword(e.target.value);
              setErrors((prev) => ({ ...prev, session: "" }));
            }}
            error={Boolean(errors.session)}
            helperText={errors.session}
            show={showPassword.session}
            onToggle={() => togglePasswordVisibility("session")}
            disabled={loading.session}
          />
          <Button
            variant="contained"
            onClick={handleSessionLogout}
            disabled={loading.session}
            sx={{ ...styles.button, minWidth: 220 }}
          >
            {loading.session ? <CircularProgress size={24} color="inherit" /> : "Log out other sessions"}
          </Button>
        </Box>

        {/* <Box sx={{ ...styles.card, border: "1px solid #7f1d1d" }}>
          <Typography variant="h6" fontWeight="600" color="#ef4444" mb={1}>
            Danger Zone
          </Typography>
          <Typography variant="body2" color="gray" mb={3}>
            Once you delete your account, all associated data will be permanently removed and you will lose access immediately.
          </Typography>
          <Alert severity="warning" sx={{ mb: 3, bgcolor: "#78350f", color: "#fbbf24", "& .MuiAlert-icon": { color: "#fbbf24" } }}>
            This action cannot be undone. Make sure you have exported any required reports before continuing.
          </Alert>
          <Button
            variant="contained"
            color="error"
            sx={{ textTransform: "none", bgcolor: "#dc2626", "&:hover": { bgcolor: "#b91c1c" } }}
            onClick={() => {
              setDeleteDialogOpen(true);
              setDeletePassword("");
              setErrors((prev) => ({ ...prev, delete: "" }));
            }}
          >
            Delete My Account
          </Button>
        </Box> */}
      </Box>

      {/* <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          if (!loading.delete) {
            setDeleteDialogOpen(false);
            setDeletePassword("");
            setErrors((prev) => ({ ...prev, delete: "" }));
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Confirm account deletion</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Please confirm your password to permanently delete this account. This will remove all reservations, slips, and audit
            history linked to you.
          </Typography>
          <PasswordField
            label="Password"
            value={deletePassword}
            onChange={(e) => {
              setDeletePassword(e.target.value);
              setErrors((prev) => ({ ...prev, delete: "" }));
            }}
            error={Boolean(errors.delete)}
            helperText={errors.delete}
            show={showPassword.delete}
            onToggle={() => togglePasswordVisibility("delete")}
            disabled={loading.delete}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setDeletePassword("");
              setErrors((prev) => ({ ...prev, delete: "" }));
            }}
            disabled={loading.delete}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteAccount}
            disabled={loading.delete}
          >
            {loading.delete ? <CircularProgress size={24} color="inherit" /> : "Delete account"}
          </Button>
        </DialogActions>
      </Dialog> */}
    </Box>
  );
};

export default Setting;
