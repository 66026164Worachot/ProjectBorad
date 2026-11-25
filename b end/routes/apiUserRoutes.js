// routes/apiUserRoutes.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';
import {
  getAllUsers,
  findUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserStats
} from '../services/db.js'; // ⚠️ เปลี่ยนจาก userService.js เป็น db.js

const r = Router();

/**
 * Middleware: ตรวจสอบว่าเป็น staff หรือ manager เท่านั้น
 */
const requireStaffOrManager = (req, res, next) => {
  if (!['staff', 'manager'].includes(req.user.role)) {
    return res.status(403).json({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Staff or Manager access required' }
    });
  }
  next();
};

/**
 * POST /api/users - สร้างผู้ใช้ใหม่
 * Access: staff (เฉพาะ user role), manager (ทุก role)
 */
r.post('/', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const { email, password, full_name, phone, role = 'user' } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: { code: 'MISSING_FIELDS', message: 'Email and password are required' }
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        ok: false,
        error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters' }
      });
    }

    // staff สร้างได้เฉพาะ user role
    if (req.user.role === 'staff' && role !== 'user') {
      return res.status(403).json({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Staff can only create regular users' }
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await createUser(
      email.toLowerCase(),
      passwordHash,
      role,
      full_name,
      phone
    );

    return res.status(201).json({
      ok: true,
      data: newUser,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('CREATE_USER_ERROR:', error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        ok: false,
        error: { code: 'EMAIL_EXISTS', message: 'Email already exists' }
      });
    }
    return res.status(500).json({
      ok: false,
      error: { code: 'CREATE_FAILED', message: 'Failed to create user' }
    });
  }
});

/**
 * GET /api/users - ดึงรายชื่อผู้ใช้ทั้งหมด
 * Access: staff (เฉพาะ users), manager (ทุกคน)
 */
r.get('/', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const { role, search, page = 1, limit = 10 } = req.query;
    const currentUserRole = req.user.role;

    // staff ดูได้เฉพาะ users
    let allowedRoles = ['user'];
    if (currentUserRole === 'manager') {
      allowedRoles = role ? [role] : ['user', 'staff', 'manager'];
    }

    const result = await getAllUsers({
      roles: allowedRoles,
      search,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    console.error('GET_USERS_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch users' }
    });
  }
});

/**
 * GET /api/users/stats - สถิติผู้ใช้
 * Access: staff, manager
 */
r.get('/stats', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const stats = await getUserStats();
    return res.json({ ok: true, data: stats });
  } catch (error) {
    console.error('GET_STATS_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'STATS_FAILED', message: 'Failed to fetch stats' }
    });
  }
});

/**
 * GET /api/users/:id - ดูข้อมูลผู้ใช้คนหนึ่ง
 * Access: staff (เฉพาะ users), manager (ทุกคน)
 */
r.get('/:id', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        ok: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    // staff ดูได้เฉพาะ users
    if (req.user.role === 'staff' && user.role !== 'user') {
      return res.status(403).json({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Cannot view staff or manager accounts' }
      });
    }

    return res.json({ ok: true, data: user });
  } catch (error) {
    console.error('GET_USER_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch user' }
    });
  }
});

/**
 * PUT /api/users/:id - แก้ไขข้อมูลผู้ใช้
 * Access: staff (เฉพาะ users), manager (ทุกคน)
 */
r.put('/:id', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone, email, role, password } = req.body;

    // ตรวจสอบว่าผู้ใช้มีอยู่จริง
    const existingUser = await findUserById(id);
    if (!existingUser) {
      return res.status(404).json({
        ok: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    // staff แก้ไขได้เฉพาะ users
    if (req.user.role === 'staff') {
      if (existingUser.role !== 'user') {
        return res.status(403).json({
          ok: false,
          error: { code: 'FORBIDDEN', message: 'Cannot edit staff or manager accounts' }
        });
      }
      // staff ไม่สามารถเปลี่ยน role ได้
      if (role && role !== 'user') {
        return res.status(403).json({
          ok: false,
          error: { code: 'FORBIDDEN', message: 'Cannot change user role' }
        });
      }
    }

    // ป้องกันไม่ให้แก้ไขตัวเอง (ควรใช้หน้า Setting แทน)
    if (id === req.user.sub) {
      return res.status(400).json({
        ok: false,
        error: { code: 'CANNOT_EDIT_SELF', message: 'Use Settings page to edit your own profile' }
      });
    }

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email.toLowerCase();
    if (role !== undefined && req.user.role === 'manager') {
      updates.role = role; // เฉพาะ manager เปลี่ยน role ได้
    }
    if (password) {
      updates.password_hash = await bcrypt.hash(password, 10);
    }

    const updatedUser = await updateUser(id, updates);

    return res.json({
      ok: true,
      data: updatedUser,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('UPDATE_USER_ERROR:', error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        ok: false,
        error: { code: 'EMAIL_EXISTS', message: 'Email already in use' }
      });
    }
    return res.status(500).json({
      ok: false,
      error: { code: 'UPDATE_FAILED', message: 'Failed to update user' }
    });
  }
});

/**
 * DELETE /api/users/:id - ลบผู้ใช้
 * Access: staff (เฉพาะ users), manager (ทุกคน)
 */
r.delete('/:id', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const { id } = req.params;

    // ตรวจสอบว่าผู้ใช้มีอยู่จริง
    const existingUser = await findUserById(id);
    if (!existingUser) {
      return res.status(404).json({
        ok: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    // staff ลบได้เฉพาะ users
    if (req.user.role === 'staff' && existingUser.role !== 'user') {
      return res.status(403).json({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Cannot delete staff or manager accounts' }
      });
    }

    // ป้องกันไม่ให้ลบตัวเอง
    if (id === req.user.sub) {
      return res.status(400).json({
        ok: false,
        error: { code: 'CANNOT_DELETE_SELF', message: 'Cannot delete your own account' }
      });
    }

    await deleteUser(id);

    return res.json({
      ok: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('DELETE_USER_ERROR:', error);
    
    // จัดการ error แบบ custom
    if (error.code === 'HAS_RELATIONS') {
      return res.status(400).json({
        ok: false,
        error: { 
          code: 'HAS_RELATIONS', 
          message: error.message 
        }
      });
    }
    
    // Foreign key constraint violation
    if (error.code === '23503') {
      return res.status(400).json({
        ok: false,
        error: { 
          code: 'FOREIGN_KEY_VIOLATION', 
          message: 'Cannot delete user with existing related data. Please contact administrator.' 
        }
      });
    }
    
    return res.status(500).json({
      ok: false,
      error: { code: 'DELETE_FAILED', message: 'Failed to delete user' }
    });
  }
});

export default r;