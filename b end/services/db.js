// services/db.js
import { randomUUID } from 'crypto';
import { supabase } from './supabase.js';

// ====================================
// ♻️ PASSWORD RESET FALLBACK STORE (เมื่อยังไม่มีตารางใน Supabase)
// ====================================

const passwordResetMemoryStore = new Map();
let useMemoryPasswordResetStore = false;

const MISSING_PASSWORD_RESET_TABLE_CODES = new Set(['PGRST205', '42P01']);

function isMissingPasswordResetTableError(error) {
  if (!error) return false;
  if (MISSING_PASSWORD_RESET_TABLE_CODES.has(error.code)) return true;
  const message = String(error.message || '').toLowerCase();
  return message.includes('password_reset_requests');
}

function enablePasswordResetMemoryFallback(error) {
  if (!useMemoryPasswordResetStore) {
    useMemoryPasswordResetStore = true;
    console.warn('[password-reset] ใช้งานตาราง password_reset_requests ไม่ได้ จะใช้ in-memory fallback แทน');
    if (error) {
      console.warn('[password-reset] Supabase error:', error);
    }
  }
}

function pruneExpiredPasswordResetTokens() {
  const now = Date.now();
  for (const [key, record] of passwordResetMemoryStore.entries()) {
    if (!record) continue;
    if (record.consumed_at) continue;
    if (new Date(record.expires_at).getTime() <= now) {
      passwordResetMemoryStore.delete(key);
    }
  }
}

function memoryStoreClearByUser(userId) {
  passwordResetMemoryStore.delete(String(userId));
}

function memoryStoreCreate(userId, codeHash, expiresAt) {
  pruneExpiredPasswordResetTokens();
  const token = {
    id: randomUUID(),
    user_id: userId,
    code_hash: codeHash,
    expires_at: new Date(expiresAt).toISOString(),
    attempts: 0,
    consumed_at: null
  };
  passwordResetMemoryStore.set(String(userId), token);
  return { ...token };
}

function memoryStoreFindActive(userId) {
  pruneExpiredPasswordResetTokens();
  const token = passwordResetMemoryStore.get(String(userId));
  if (!token) return null;
  if (token.consumed_at) return null;
  if (new Date(token.expires_at).getTime() <= Date.now()) {
    passwordResetMemoryStore.delete(String(userId));
    return null;
  }
  return { ...token };
}

function memoryStoreFindByTokenId(tokenId) {
  for (const [key, record] of passwordResetMemoryStore.entries()) {
    if (record?.id === tokenId) {
      return { key, record };
    }
  }
  return null;
}

function memoryStoreIncrementAttempts(tokenId, currentAttempts = 0) {
  const entry = memoryStoreFindByTokenId(tokenId);
  const next = (currentAttempts || 0) + 1;
  if (!entry) return next;
  entry.record.attempts = next;
  passwordResetMemoryStore.set(entry.key, entry.record);
  return next;
}

function memoryStoreConsume(tokenId) {
  const entry = memoryStoreFindByTokenId(tokenId);
  if (!entry) return;
  entry.record.consumed_at = new Date().toISOString();
  passwordResetMemoryStore.set(entry.key, entry.record);
}

function memoryStoreDelete(tokenId) {
  const entry = memoryStoreFindByTokenId(tokenId);
  if (!entry) return;
  passwordResetMemoryStore.delete(entry.key);
}

// ====================================
// 🔐 AUTH FUNCTIONS (สำหรับ Login/Register)
// ====================================

/**
 * ค้นหาผู้ใช้จาก email (สำหรับ login)
 */
export async function findUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, password_hash, role, full_name, phone')
    .eq('email', String(email || '').toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * ค้นหาผู้ใช้จาก ID (สำหรับ protected routes)
 */
export async function findUserById(id) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, role, full_name, phone, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * ค้นหาผู้ใช้พร้อมรหัสผ่าน (สำหรับตั้งค่า/ยืนยันตัวตน)
 */
export async function findUserAuthById(id) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, role, full_name, phone, password_hash, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * สร้างผู้ใช้ใหม่ (ใช้ได้ทั้ง register และ user management)
 */
export async function createUser(email, passwordHash, role = 'user', fullName = null, phone = null) {
  console.log('DEBUG createUser input:', { email, role, fullName, phone });

  const { data, error } = await supabase
    .from('users')
    .insert({
      email: String(email).toLowerCase(),
      password_hash: passwordHash,
      role,
      full_name: fullName,
      phone
    })
    .select('id, email, role, full_name, phone, created_at')
    .single();

  if (error) {
    console.error('DEBUG createUser error:', error);
    throw error;
  }

  console.log('DEBUG createUser success:', data);
  return data;
}

// ====================================
// 👥 USER MANAGEMENT FUNCTIONS
// ====================================

/**
 * ดึงรายชื่อผู้ใช้ทั้งหมด (พร้อม pagination + search)
 */
export async function getAllUsers({ roles = ['user'], search = '', page = 1, limit = 10 }) {
  try {
    let query = supabase
      .from('users')
      .select('id, email, role, full_name, phone, created_at, updated_at', { count: 'exact' })
      .in('role', roles)
      .order('created_at', { ascending: false });

    // ✅ Search by email, name, OR phone
    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      users: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };
  } catch (error) {
    console.error('GET_ALL_USERS_ERROR:', error);
    throw error;
  }
}

/**
 * อัพเดทข้อมูลผู้ใช้
 */
export async function updateUser(id, updates) {
  try {
    console.log('DEBUG updateUser:', { id, updates });

    const { data, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, email, role, full_name, phone, updated_at')
      .single();

    if (error) throw error;

    console.log('DEBUG updateUser success:', data);
    return data;
  } catch (error) {
    console.error('UPDATE_USER_ERROR:', error);
    throw error;
  }
}

/**
 * อัพเดทข้อมูลส่วนตัวของผู้ใช้ (หน้า Setting)
 */
export async function updateUserProfile(id, { email, full_name, phone }) {
  const payload = {};
  if (email !== undefined) payload.email = email;
  if (full_name !== undefined) payload.full_name = full_name;
  if (phone !== undefined) payload.phone = phone;

  if (Object.keys(payload).length === 0) {
    return findUserById(id);
  }

  return updateUser(id, payload);
}

/**
 * เปลี่ยนรหัสผ่านผู้ใช้
 */
export async function updateUserPassword(id, passwordHash) {
  const { error } = await supabase
    .from('users')
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
  return true;
}

/**
 * ตรวจสอบว่า user มีข้อมูลที่เกี่ยวข้องหรือไม่
 */
export async function checkUserRelations(id) {
  try {
    // ตรวจสอบ bookings
    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id')
      .eq('user_id', id)
      .limit(1);

    if (bookingError) throw bookingError;

    // ตรวจสอบ food_orders
    const { data: orders, error: orderError } = await supabase
      .from('food_orders')
      .select('id')
      .eq('user_id', id)
      .limit(1);

    if (orderError) throw orderError;

    return {
      hasBookings: bookings && bookings.length > 0,
      hasOrders: orders && orders.length > 0,
      canDelete: !bookings?.length && !orders?.length
    };
  } catch (error) {
    console.error('CHECK_USER_RELATIONS_ERROR:', error);
    throw error;
  }
}

/**
 * ลบผู้ใช้ (พร้อม cascade delete ข้อมูลที่เกี่ยวข้อง)
 */
export async function deleteUser(id) {
  try {
    console.log('DEBUG deleteUser:', id);

    // ตรวจสอบ relations ก่อน
    const relations = await checkUserRelations(id);
    
    if (!relations.canDelete) {
      const reasons = [];
      if (relations.hasBookings) reasons.push('bookings');
      if (relations.hasOrders) reasons.push('orders');
      
      throw {
        code: 'HAS_RELATIONS',
        message: `Cannot delete user with existing ${reasons.join(' and ')}. Please delete or reassign them first.`
      };
    }

    // ลบ refresh tokens
    const { error: tokenError } = await supabase
      .from('refresh_tokens')
      .delete()
      .eq('user_id', id);
    
    if (tokenError) {
      console.warn('Delete refresh tokens warning:', tokenError);
    }

    // อัพเดท payments ที่ verified_by เป็นผู้ใช้นี้
    await supabase
      .from('payments')
      .update({ verified_by: null })
      .eq('verified_by', id);

    // อัพเดท bookings ที่ approved_by หรือ checked_in_by เป็นผู้ใช้นี้
    await supabase
      .from('bookings')
      .update({ 
        approved_by: null, 
        checked_in_by: null 
      })
      .or(`approved_by.eq.${id},checked_in_by.eq.${id}`);

    // อัพเดท food_orders ที่ confirmed_by หรือ served_by เป็นผู้ใช้นี้
    await supabase
      .from('food_orders')
      .update({ 
        confirmed_by: null, 
        served_by: null 
      })
      .or(`confirmed_by.eq.${id},served_by.eq.${id}`);

    // ลบผู้ใช้
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('DELETE_USER_ERROR:', error);
      throw error;
    }

    console.log('DEBUG deleteUser success');
    return true;
  } catch (error) {
    console.error('DELETE_USER_ERROR:', error);
    throw error;
  }
}

/**
 * ลบ refresh tokens ทั้งหมดของผู้ใช้ (ยกเว้น jti ที่ระบุ)
 */
export async function revokeRefreshTokensForUser(userId, exceptJti = null) {
  let query = supabase.from('refresh_tokens').delete().eq('user_id', userId);
  if (exceptJti) {
    query = query.neq('jti', exceptJti);
  }

  const { error } = await query;
  if (error) throw error;
}

/**
 * สถิติผู้ใช้
 */
export async function getUserStats() {
  try {
    // นับจำนวนผู้ใช้แต่ละ role
    const { data: users, error } = await supabase
      .from('users')
      .select('role, created_at');

    if (error) throw error;

    const stats = {
      total: users.length,
      byRole: {
        user: users.filter(u => u.role === 'user').length,
        staff: users.filter(u => u.role === 'staff').length,
        manager: users.filter(u => u.role === 'manager').length
      }
    };

    // ผู้ใช้ใหม่ใน 30 วัน
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: newUsers, error: newError } = await supabase
      .from('users')
      .select('id')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (!newError) {
      stats.newUsersLast30Days = newUsers ? newUsers.length : 0;
    }

    return stats;
  } catch (error) {
    console.error('GET_USER_STATS_ERROR:', error);
    throw error;
  }
}

// ====================================
// 🔑 REFRESH TOKEN FUNCTIONS
// ====================================

/**
 * เก็บ refresh token
 */
export async function storeRefreshToken(jti, userId, expiresAt) {
  const { error } = await supabase
    .from('refresh_tokens')
    .insert({ jti, user_id: userId, expires_at: new Date(expiresAt).toISOString() });
  if (error) throw error;
}

/**
 * ดึง refresh token
 */
export async function getRefreshToken(jti) {
  const { data, error } = await supabase
    .from('refresh_tokens')
    .select('jti, user_id, expires_at')
    .eq('jti', jti)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * ยกเลิก refresh token
 */
export async function revokeRefreshToken(jti) {
  const { error } = await supabase
    .from('refresh_tokens')
    .delete()
    .eq('jti', jti);
  if (error) throw error;
}

// ====================================
// 🔄 PASSWORD RESET FUNCTIONS
// ====================================

export async function clearPasswordResetTokensForUser(userId) {
  if (useMemoryPasswordResetStore) {
    memoryStoreClearByUser(userId);
    return;
  }

  try {
    const { error } = await supabase
      .from('password_reset_requests')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error) {
    if (isMissingPasswordResetTableError(error)) {
      enablePasswordResetMemoryFallback(error);
      memoryStoreClearByUser(userId);
      return;
    }
    throw error;
  }
}

export async function createPasswordResetToken(userId, codeHash, expiresAt) {
  if (useMemoryPasswordResetStore) {
    return memoryStoreCreate(userId, codeHash, expiresAt);
  }

  try {
    const { data, error } = await supabase
      .from('password_reset_requests')
      .insert({
        user_id: userId,
        code_hash: codeHash,
        expires_at: new Date(expiresAt).toISOString(),
        attempts: 0,
      })
      .select('id, user_id, code_hash, expires_at, attempts, consumed_at')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    if (isMissingPasswordResetTableError(error)) {
      enablePasswordResetMemoryFallback(error);
      return memoryStoreCreate(userId, codeHash, expiresAt);
    }
    throw error;
  }
}

export async function findActivePasswordResetToken(userId) {
  if (useMemoryPasswordResetStore) {
    return memoryStoreFindActive(userId);
  }

  try {
    const { data, error } = await supabase
      .from('password_reset_requests')
      .select('id, user_id, code_hash, expires_at, attempts, consumed_at')
      .eq('user_id', userId)
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  } catch (error) {
    if (isMissingPasswordResetTableError(error)) {
      enablePasswordResetMemoryFallback(error);
      return memoryStoreFindActive(userId);
    }
    throw error;
  }
}

export async function incrementPasswordResetAttempts(tokenId, currentAttempts = 0) {
  if (useMemoryPasswordResetStore) {
    return memoryStoreIncrementAttempts(tokenId, currentAttempts);
  }

  const next = (currentAttempts || 0) + 1;

  try {
    const { data, error } = await supabase
      .from('password_reset_requests')
      .update({ attempts: next })
      .eq('id', tokenId)
      .select('attempts')
      .single();

    if (error) throw error;
    return data?.attempts ?? next;
  } catch (error) {
    if (isMissingPasswordResetTableError(error)) {
      enablePasswordResetMemoryFallback(error);
      return memoryStoreIncrementAttempts(tokenId, currentAttempts);
    }
    throw error;
  }
}

export async function consumePasswordResetToken(tokenId) {
  if (useMemoryPasswordResetStore) {
    memoryStoreConsume(tokenId);
    return;
  }

  try {
    const { error } = await supabase
      .from('password_reset_requests')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', tokenId);

    if (error) throw error;
  } catch (error) {
    if (isMissingPasswordResetTableError(error)) {
      enablePasswordResetMemoryFallback(error);
      memoryStoreConsume(tokenId);
      return;
    }
    throw error;
  }
}

export async function deletePasswordResetToken(tokenId) {
  if (useMemoryPasswordResetStore) {
    memoryStoreDelete(tokenId);
    return;
  }

  try {
    const { error } = await supabase
      .from('password_reset_requests')
      .delete()
      .eq('id', tokenId);

    if (error) throw error;
  } catch (error) {
    if (isMissingPasswordResetTableError(error)) {
      enablePasswordResetMemoryFallback(error);
      memoryStoreDelete(tokenId);
      return;
    }
    throw error;
  }
}
