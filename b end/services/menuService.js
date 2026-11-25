// services/menuService.js - เพิ่ม Stock Support
import { supabase } from './supabase.js';

// ====================================
// 📁 MENU CATEGORIES
// ====================================

export async function getAllCategories() {
  const { data, error } = await supabase
    .from('menu_categories')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getActiveCategories() {
  const { data, error } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getCategoryById(id) {
  const { data, error } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createCategory(categoryData) {
  const { data, error } = await supabase
    .from('menu_categories')
    .insert(categoryData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCategory(id, updates) {
  const { data, error } = await supabase
    .from('menu_categories')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCategory(id) {
  const { data: items } = await supabase
    .from('menu_items')
    .select('id')
    .eq('category_id', id)
    .limit(1);

  if (items && items.length > 0) {
    throw {
      code: 'HAS_MENU_ITEMS',
      message: 'Cannot delete category with existing menu items'
    };
  }

  const { error } = await supabase
    .from('menu_categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// ====================================
// 🍽️ MENU ITEMS
// ====================================

export async function getAllMenuItems({ categoryId, search, isAvailable, page = 1, limit = 20 }) {
  let query = supabase
    .from('menu_items')
    .select(`
      *,
      category:menu_categories(id, name, description)
    `, { count: 'exact' })
    .order('display_order', { ascending: true });

  if (categoryId && categoryId !== 'all') {
    query = query.eq('category_id', categoryId);
  }

  if (isAvailable !== undefined) {
    query = query.eq('is_available', isAvailable);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    items: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit)
    }
  };
}

export async function getMenuItemById(id) {
  const { data, error } = await supabase
    .from('menu_items')
    .select(`
      *,
      category:menu_categories(id, name, description)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createMenuItem(itemData) {
  console.log('Creating menu item with data:', itemData); // Debug log
  
  const { data, error } = await supabase
    .from('menu_items')
    .insert({
      category_id: itemData.category_id,
      name: itemData.name,
      description: itemData.description,
      price: itemData.price,
      image_url: itemData.image_url,
      is_available: itemData.is_available,
      preparation_time: itemData.preparation_time,
      tags: itemData.tags,
      display_order: itemData.display_order,
      stock_quantity: itemData.stock_quantity || 0, // ⚠️ เพิ่ม stock
      low_stock_threshold: itemData.low_stock_threshold || 5 // ⚠️ เพิ่ม threshold
    })
    .select(`
      *,
      category:menu_categories(id, name, description)
    `)
    .single();

  if (error) {
    console.error('Create menu item error:', error);
    throw error;
  }

  console.log('Created menu item:', data); // Debug log
  return data;
}

export async function updateMenuItem(id, updates) {
  console.log('Updating menu item:', id, 'with data:', updates); // Debug log
  
  // ⚠️ สร้าง object ที่จะอัพเดท
  const updateData = {
    updated_at: new Date().toISOString()
  };

  // เพิ่มเฉพาะฟิลด์ที่มีค่า
  if (updates.category_id !== undefined) updateData.category_id = updates.category_id;
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.price !== undefined) updateData.price = updates.price;
  if (updates.image_url !== undefined) updateData.image_url = updates.image_url;
  if (updates.is_available !== undefined) updateData.is_available = updates.is_available;
  if (updates.preparation_time !== undefined) updateData.preparation_time = updates.preparation_time;
  if (updates.tags !== undefined) updateData.tags = updates.tags;
  if (updates.display_order !== undefined) updateData.display_order = updates.display_order;
  
  // ⚠️ เพิ่ม stock fields
  if (updates.stock_quantity !== undefined) updateData.stock_quantity = updates.stock_quantity;
  if (updates.low_stock_threshold !== undefined) updateData.low_stock_threshold = updates.low_stock_threshold;

  console.log('Final update data:', updateData); // Debug log

  const { data, error } = await supabase
    .from('menu_items')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      category:menu_categories(id, name, description)
    `)
    .single();

  if (error) {
    console.error('Update menu item error:', error);
    throw error;
  }

  console.log('Updated menu item result:', data); // Debug log
  return data;
}

export async function deleteMenuItem(id) {
  const { data: orderItems } = await supabase
    .from('food_order_items')
    .select('id')
    .eq('menu_item_id', id)
    .limit(1);

  if (orderItems && orderItems.length > 0) {
    throw {
      code: 'HAS_ORDERS',
      message: 'Cannot delete menu item with existing orders. Consider marking it as unavailable instead.'
    };
  }

  const { error } = await supabase
    .from('menu_items')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

export async function toggleMenuItemAvailability(id) {
  const item = await getMenuItemById(id);
  if (!item) throw { code: 'NOT_FOUND', message: 'Menu item not found' };

  const { data, error } = await supabase
    .from('menu_items')
    .update({ is_available: !item.is_available, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getMenuStats() {
  const { data: items, error } = await supabase
    .from('menu_items')
    .select('is_available, category_id, stock_quantity');

  if (error) throw error;

  const { data: categories, error: catError } = await supabase
    .from('menu_categories')
    .select('is_active');

  if (catError) throw catError;

  // ⚠️ เพิ่ม Low Stock Stats
  const lowStockItems = items.filter(i => i.stock_quantity < 5 && i.stock_quantity > 0);
  const outOfStockItems = items.filter(i => i.stock_quantity === 0);

  return {
    totalItems: items.length,
    availableItems: items.filter(i => i.is_available).length,
    unavailableItems: items.filter(i => !i.is_available).length,
    totalCategories: categories.length,
    activeCategories: categories.filter(c => c.is_active).length,
    lowStockItems: lowStockItems.length, // ⚠️ จำนวนสินค้าใกล้หมด
    outOfStockItems: outOfStockItems.length // ⚠️ จำนวนสินค้าหมด
  };
}