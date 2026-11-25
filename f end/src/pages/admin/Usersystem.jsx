import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, IconButton, Chip, Avatar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Dialog, DialogTitle, DialogContent, DialogActions,
  MenuItem, Select, FormControl, InputLabel, Alert, Snackbar,
  TablePagination, CircularProgress, Breadcrumbs, Link, Tooltip,
  InputAdornment, Card, CardContent, Grid
} from '@mui/material';
import {
  Add, Edit, Delete, Search as SearchIcon, Refresh,
  PersonAdd, Home, ChevronRight, AdminPanelSettings,
  People, Work, SupervisorAccount
} from '@mui/icons-material';
import { userAPI } from '../../services/userAPI';
import { auth } from '../../utils/auth';

const Usersystem = () => {
  // State management
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  
  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'user'
  });
  
  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Get current user role
  const currentUser = auth.getUserInfo();
  const isManager = currentUser?.role === 'manager';
  const isStaff = currentUser?.role === 'staff';

  // Fetch data
  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [page, rowsPerPage, roleFilter, searchQuery]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await userAPI.getAll({
        role: roleFilter === 'all' ? undefined : roleFilter,
        search: searchQuery,
        page: page + 1,
        limit: rowsPerPage
      });
      
      if (response.data.ok) {
        setUsers(response.data.data.users);
        setTotalUsers(response.data.data.pagination.total);
      }
    } catch (error) {
      showSnackbar('Failed to fetch users', 'error');
      console.error('Fetch users error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await userAPI.getStats();
      if (response.data.ok) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Fetch stats error:', error);
    }
  };

  const handleOpenDialog = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        password: '',
        full_name: user.full_name || '',
        phone: user.phone || '',
        role: user.role
      });
    } else {
      setEditingUser(null);
      setFormData({ email: '', password: '', full_name: '', phone: '', role: 'user' });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUser(null);
    setFormData({ email: '', password: '', full_name: '', phone: '', role: 'user' });
  };

  const handleSaveUser = async () => {
    try {
      if (editingUser) {
        // Update existing user
        const updateData = {
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone,
          ...(isManager && { role: formData.role }),
          ...(formData.password && { password: formData.password })
        };
        
        await userAPI.update(editingUser.id, updateData);
        showSnackbar('User updated successfully', 'success');
      } else {
        // Note: Creating new users should go through /api/auth/register
        // This is just a placeholder - you may want to create a separate endpoint
        showSnackbar('User creation not implemented yet. Use register endpoint.', 'warning');
      }
      
      handleCloseDialog();
      fetchUsers();
      fetchStats();
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to save user';
      showSnackbar(message, 'error');
    }
  };

  const handleDeleteClick = (user) => {
    setSelectedUser(user);
    setOpenDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await userAPI.delete(selectedUser.id);
      showSnackbar('User deleted successfully', 'success');
      setOpenDeleteDialog(false);
      fetchUsers();
      fetchStats();
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to delete user';
      showSnackbar(message, 'error');
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'manager': return 'error';
      case 'staff': return 'warning';
      default: return 'primary';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'manager': return <SupervisorAccount />;
      case 'staff': return <Work />;
      default: return <People />;
    }
  };

  // Check if current user can edit/delete target user
  const canEdit = (targetUser) => {
    if (isManager) return true;
    if (isStaff && targetUser.role === 'user') return true;
    return false;
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 4, md: 6 }, minHeight: '100vh' }}>
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        
        {/* Breadcrumb */}
        <Box display="flex" alignItems="center" mb={3}>
          <Home size={20} color="#60a5fa" />
          <Breadcrumbs
            separator={<ChevronRight size={16} color="#94a3b8" />}
            sx={{ ml: 1, color: '#cbd5e1' }}
          >
            <Link underline="hover" color="#000000" href="/admin/dashboard">Home</Link>
            <Link underline="hover" color="#000000" href="#">Management</Link>
            <Typography color="#1882ec">User System</Typography>
          </Breadcrumbs>
        </Box>

        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h4" fontWeight="700" gutterBottom>
              Account Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage accounts and permissions
            </Typography>
          </Box>
          {/* <Box>
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={() => handleOpenDialog()}
          >
            Add User
          </Button>
          </Box> */}
        </Box>
        
        {/* Stats Cards */}
        {stats && (
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="body2" color="text.secondary">Total Users</Typography>
                      <Typography variant="h4" fontWeight="700">{stats.total}</Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: '#3b82f6' }}>
                      <People />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="body2" color="text.secondary">Regular Users</Typography>
                      <Typography variant="h4" fontWeight="700">{stats.byRole.user}</Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: '#10b981' }}>
                      <People />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="body2" color="text.secondary">Staff</Typography>
                      <Typography variant="h4" fontWeight="700">{stats.byRole.staff}</Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: '#f59e0b' }}>
                      <Work />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="body2" color="text.secondary">Managers</Typography>
                      <Typography variant="h4" fontWeight="700">{stats.byRole.manager}</Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: '#ef4444' }}>
                      <SupervisorAccount />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Search & Filter Bar */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search by email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Role Filter</InputLabel>
                <Select
                  value={roleFilter}
                  label="Role Filter"
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <MenuItem value="all">All Roles</MenuItem>
                  <MenuItem value="user">Users Only</MenuItem>
                  {isManager && <MenuItem value="staff">Staff Only</MenuItem>}
                  {isManager && <MenuItem value="manager">Managers Only</MenuItem>}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Refresh />}
                onClick={fetchUsers}
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Users Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">No users found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar sx={{ bgcolor: '#6366f1' }}>
                          {(user.full_name || user.email)[0].toUpperCase()}
                        </Avatar>
                        <Typography fontWeight="500">
                          {user.full_name || 'No name'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        icon={getRoleIcon(user.role)}
                        label={user.role}
                        color={getRoleBadgeColor(user.role)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString('en-GB')}
                    </TableCell>
                    <TableCell align="right">
                      {canEdit(user) && (
                        <>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleOpenDialog(user)}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteClick(user)}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {/* Pagination */}
          <TablePagination
            component="div"
            count={totalUsers}
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

        {/* Edit Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingUser ? 'Edit User' : 'Add New User'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <TextField
                fullWidth
                label="Full Name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
              <TextField
                fullWidth
                label="Phone"
                type='number'
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 10 }}
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                placeholder={editingUser ? 'Leave blank to keep current' : 'Enter password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              {isManager && (
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={formData.role}
                    label="Role"
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <MenuItem value="user">User</MenuItem>
                    <MenuItem value="staff">Staff</MenuItem>
                    <MenuItem value="manager">Manager</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveUser}>
              {editingUser ? 'Save Changes' : 'Create User'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete user <strong>{selectedUser?.email}</strong>?
              This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDeleteConfirm}>
              Delete
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

export default Usersystem;