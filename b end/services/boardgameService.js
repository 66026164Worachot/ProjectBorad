import { supabase } from './supabase.js';

const TABLE = 'games';

const FIELD_MAP = {
  minPlayers: 'min_players',
  maxPlayers: 'max_players',
  playtimeMinutes: 'duration_minutes',
  imageUrl: 'image_url',
  isTrending: 'is_trending',
  complexity: 'difficulty_level',
  category: 'category',
  status: 'status',
  availableQuantity: 'available_quantity',
};

function mapToDatabaseFields(payload) {
  const mapped = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    const dbField = FIELD_MAP[key] || key;
    mapped[dbField] = value;
  }
  return mapped;
}

function normalizeSupabaseError(error) {
  if (!error) return error;

  if (error.code === '42P01') {
    const err = new Error(
      'Table "games" ไม่พบในฐานข้อมูล กรุณาสร้างตารางหรืออัปเดตสิทธิ์การเข้าถึง'
    );
    err.status = 500;
    err.code = 'TABLE_NOT_FOUND';
    return err;
  }

  if (error.code === '42703' && error.message?.includes('is_trending')) {
    const err = new Error(
      'ไม่พบคอลัมน์ is_trending ในตาราง games กรุณาเพิ่มคอลัมน์ BOOLEAN ชื่อ is_trending (DEFAULT false)'
    );
    err.status = 400;
    err.code = 'MISSING_TRENDING_COLUMN';
    return err;
  }

  if (error.code === '23502' && error.message?.includes('available_quantity')) {
    const err = new Error('ต้องระบุจำนวนชุดที่พร้อมให้ยืม (available_quantity) เป็นตัวเลขไม่ติดลบ');
    err.status = 400;
    err.code = 'INVALID_AVAILABLE_QUANTITY';
    return err;
  }

  if (error.code === '23514' && error.message?.includes('status')) {
    const err = new Error('สถานะของเกมต้องเป็น available, unavailable หรือ maintenance เท่านั้น');
    err.status = 400;
    err.code = 'INVALID_STATUS';
    return err;
  }

  return error;
}

export async function getBoardgames({ search = '', isTrending, page = 1, limit = 20 } = {}) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search) {
    const sanitized = search.replace(/%/g, '').replace(/'/g, "''");
    query = query.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
  }

  if (typeof isTrending === 'boolean') {
    query = query.eq('is_trending', isTrending);
  }

  const { data, error, count } = await query;

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return {
    items: data || [],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit) || 0,
    },
  };
}

export async function createBoardgame(payload) {
  const dataPayload = mapToDatabaseFields(payload);

  const { data, error } = await supabase
    .from(TABLE)
    .insert(dataPayload)
    .select('*')
    .single();

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return data;
}

export async function updateBoardgame(id, updates) {
  if (!id) {
    throw new Error('Missing boardgame id');
  }

  const payload = mapToDatabaseFields(updates);

  const { data, error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return data || null;
}

export async function deleteBoardgame(id) {
  if (!id) {
    const err = new Error('Missing boardgame id');
    err.status = 400;
    throw err;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw normalizeSupabaseError(error);
  }

  if (!data) {
    const err = new Error('Board game not found');
    err.status = 404;
    throw err;
  }

  return true;
}
