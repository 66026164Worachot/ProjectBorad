// services/db.js - User Management Functions
import { supabase } from './supabase.js';

/**
 * ค้นหาผู้ใช้จาก email
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
 * ค้นหาผู้ใช้จาก ID
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
 * สร้างผู้ใช้ใหม่
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
  return data;
}

/**
 * อัพเดทข้อมูลผู้ใช้
 */
export async function updateUser(id, updates) {
  const { data, error } = await supabase
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, email, role, full_name, phone, updated_at')
    .single();

  if (error) throw error;
  return data;
}

/**
 * ลบผู้ใช้
 */
export async function deleteUser(id) {
  // ลบ refresh tokens ก่อน
  await supabase.from('refresh_tokens').delete().eq('user_id', id);

  // ลบผู้ใช้
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) throw error;
  return true;
}

/**
 * ดึงรายชื่อผู้ใช้ทั้งหมด (pagination)
 */
export async function getAllUsers({ roles = ['user'], search = '', page = 1, limit = 10 }) {
  let query = supabase
    .from('users')
    .select('id, email, role, full_name, phone, created_at, updated_at', { count: 'exact' })
    .in('role', roles)
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  }

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
}

/**
 * สถิติผู้ใช้
 */
export async function getUserStats() {
  const { data: users, error } = await supabase.from('users').select('role');
  if (error) throw error;

  const stats = {
    total: users.length,
    byRole: {
      user: users.filter(u => u.role === 'user').length,
      staff: users.filter(u => u.role === 'staff').length,
      manager: users.filter(u => u.role === 'manager').length
    }
  };

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: newUsers } = await supabase
    .from('users')
    .select('id')
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (newUsers) {
    stats.newUsersLast30Days = newUsers.length;
  }

  return stats;
}

/** Refresh Token Functions */
export async function storeRefreshToken(jti, userId, expiresAt) {
  const { error } = await supabase
    .from('refresh_tokens')
    .insert({ jti, user_id: userId, expires_at: new Date(expiresAt).toISOString() });
  if (error) throw error;
}

export async function getRefreshToken(jti) {
  const { data, error } = await supabase
    .from('refresh_tokens')
    .select('jti, user_id, expires_at')
    .eq('jti', jti)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function revokeRefreshToken(jti) {
  const { error } = await supabase
    .from('refresh_tokens')
    .delete()
    .eq('jti', jti);
  if (error) throw error;
}