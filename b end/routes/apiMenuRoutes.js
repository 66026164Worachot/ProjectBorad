// routes/apiMenuRoutes.js - Complete Stock Management
import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { nanoid } from 'nanoid';
import { supabase } from '../services/supabase.js';
import { normalizeTableCapacity } from '../services/tableCapacity.js';
import {
  getAllCategories,
  getActiveCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleMenuItemAvailability,
  getMenuStats
} from '../services/menuService.js';

const r = Router();

const requireStaffOrManager = (req, res, next) => {
  if (!['staff', 'manager'].includes(req.user.role)) {
    return res.status(403).json({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Staff or Manager access required' }
    });
  }
  next();
};

// ====================================
// 📁 CATEGORY ROUTES (ไม่เปลี่ยนแปลง)
// ====================================

r.get('/categories', async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const categories = activeOnly === 'true' 
      ? await getActiveCategories() 
      : await getAllCategories();
    return res.json({ ok: true, data: categories });
  } catch (error) {
    console.error('GET_CATEGORIES_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch categories' }
    });
  }
});

r.get('/categories/:id', async (req, res) => {
  try {
    const category = await getCategoryById(req.params.id);
    if (!category) {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Category not found' }
      });
    }
    return res.json({ ok: true, data: category });
  } catch (error) {
    console.error('GET_CATEGORY_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch category' }
    });
  }
});

r.post('/categories', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const { name, description, display_order = 0, is_active = true } = req.body;
    if (!name) {
      return res.status(400).json({
        ok: false,
        error: { code: 'MISSING_NAME', message: 'Category name is required' }
      });
    }
    const category = await createCategory({
      name,
      description,
      display_order,
      is_active
    });
    return res.status(201).json({
      ok: true,
      data: category,
      message: 'Category created successfully'
    });
  } catch (error) {
    console.error('CREATE_CATEGORY_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'CREATE_FAILED', message: 'Failed to create category' }
    });
  }
});

r.put('/categories/:id', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const { name, description, display_order, is_active } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (display_order !== undefined) updates.display_order = display_order;
    if (is_active !== undefined) updates.is_active = is_active;

    const category = await updateCategory(req.params.id, updates);
    return res.json({
      ok: true,
      data: category,
      message: 'Category updated successfully'
    });
  } catch (error) {
    console.error('UPDATE_CATEGORY_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'UPDATE_FAILED', message: 'Failed to update category' }
    });
  }
});

r.delete('/categories/:id', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    await deleteCategory(req.params.id);
    return res.json({
      ok: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('DELETE_CATEGORY_ERROR:', error);
    if (error.code === 'HAS_MENU_ITEMS') {
      return res.status(400).json({
        ok: false,
        error: { code: 'HAS_MENU_ITEMS', message: error.message }
      });
    }
    return res.status(500).json({
      ok: false,
      error: { code: 'DELETE_FAILED', message: 'Failed to delete category' }
    });
  }
});

// ====================================
// 🍽️ MENU ITEM ROUTES (ไม่เปลี่ยนแปลง)
// ====================================

r.get('/items', async (req, res) => {
  try {
    const { 
      categoryId, 
      search, 
      isAvailable, 
      page = 1, 
      limit = 20 
    } = req.query;

    const result = await getAllMenuItems({
      categoryId,
      search,
      isAvailable: isAvailable === 'true' ? true : isAvailable === 'false' ? false : undefined,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    console.error('GET_MENU_ITEMS_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch menu items' }
    });
  }
});

r.get('/items/:id', async (req, res) => {
  try {
    const item = await getMenuItemById(req.params.id);
    if (!item) {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Menu item not found' }
      });
    }
    return res.json({ ok: true, data: item });
  } catch (error) {
    console.error('GET_MENU_ITEM_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch menu item' }
    });
  }
});

r.post('/items', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const {
      category_id,
      name,
      description,
      price,
      image_url,
      is_available = true,
      preparation_time,
      tags,
      display_order = 0,
      stock_quantity = 0,
      low_stock_threshold = 5
    } = req.body;

    if (!category_id || !name || price === undefined) {
      return res.status(400).json({
        ok: false,
        error: { 
          code: 'MISSING_FIELDS', 
          message: 'Category, name, and price are required' 
        }
      });
    }

    if (price < 0) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_PRICE', message: 'Price must be non-negative' }
      });
    }

    const item = await createMenuItem({
      category_id,
      name,
      description,
      price,
      image_url,
      is_available,
      preparation_time,
      tags,
      display_order,
      stock_quantity,
      low_stock_threshold
    });

    return res.status(201).json({
      ok: true,
      data: item,
      message: 'Menu item created successfully'
    });
  } catch (error) {
    console.error('CREATE_MENU_ITEM_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'CREATE_FAILED', message: 'Failed to create menu item' }
    });
  }
});

r.put('/items/:id', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const {
      category_id,
      name,
      description,
      price,
      image_url,
      is_available,
      preparation_time,
      tags,
      display_order,
      stock_quantity,
      low_stock_threshold
    } = req.body;

    const updates = {};
    if (category_id !== undefined) updates.category_id = category_id;
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) {
      if (price < 0) {
        return res.status(400).json({
          ok: false,
          error: { code: 'INVALID_PRICE', message: 'Price must be non-negative' }
        });
      }
      updates.price = price;
    }
    if (image_url !== undefined) updates.image_url = image_url;
    if (is_available !== undefined) updates.is_available = is_available;
    if (preparation_time !== undefined) updates.preparation_time = preparation_time;
    if (tags !== undefined) updates.tags = tags;
    if (display_order !== undefined) updates.display_order = display_order;
    if (stock_quantity !== undefined) updates.stock_quantity = stock_quantity;
    if (low_stock_threshold !== undefined) updates.low_stock_threshold = low_stock_threshold;

    const item = await updateMenuItem(req.params.id, updates);

    return res.json({
      ok: true,
      data: item,
      message: 'Menu item updated successfully'
    });
  } catch (error) {
    console.error('UPDATE_MENU_ITEM_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'UPDATE_FAILED', message: 'Failed to update menu item' }
    });
  }
});

r.delete('/items/:id', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    await deleteMenuItem(req.params.id);
    return res.json({
      ok: true,
      message: 'Menu item deleted successfully'
    });
  } catch (error) {
    console.error('DELETE_MENU_ITEM_ERROR:', error);
    if (error.code === 'HAS_ORDERS') {
      return res.status(400).json({
        ok: false,
        error: { code: 'HAS_ORDERS', message: error.message }
      });
    }
    return res.status(500).json({
      ok: false,
      error: { code: 'DELETE_FAILED', message: 'Failed to delete menu item' }
    });
  }
});

r.patch('/items/:id/toggle', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const item = await toggleMenuItemAvailability(req.params.id);
    return res.json({
      ok: true,
      data: item,
      message: `Menu item is now ${item.is_available ? 'available' : 'unavailable'}`
    });
  } catch (error) {
    console.error('TOGGLE_MENU_ITEM_ERROR:', error);
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: error.message }
      });
    }
    return res.status(500).json({
      ok: false,
      error: { code: 'TOGGLE_FAILED', message: 'Failed to toggle menu item' }
    });
  }
});

r.get('/stats', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const stats = await getMenuStats();
    return res.json({ ok: true, data: stats });
  } catch (error) {
    console.error('GET_MENU_STATS_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'STATS_FAILED', message: 'Failed to fetch menu stats' }
    });
  }
});

// ====================================
// 🛒 CREATE FOOD ORDER WITH STOCK VALIDATION
// ====================================

r.post('/create-order', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const {
      booking_id,
      user_id,
      table_id,
      items, // [{ menu_item_id, quantity }]
      special_instructions
    } = req.body;

    console.log('📦 Creating order with items:', JSON.stringify(items, null, 2));

    // Validation
    if (!booking_id || !user_id || !table_id || !items || items.length === 0) {
      return res.status(400).json({
        ok: false,
        error: { 
          code: 'MISSING_FIELDS', 
          message: 'booking_id, user_id, table_id, and items are required' 
        }
      });
    }

    // 1. Generate order number
    const orderNumber = `FO-${Date.now()}-${nanoid(6)}`;

    // 2. ดึงข้อมูลเมนูจาก database พร้อม stock_quantity
    const menuItemIds = items.map(item => item.menu_item_id);
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('id, name, price, is_available, stock_quantity')
      .in('id', menuItemIds);

    if (menuError) {
      console.error('❌ Error fetching menu items:', menuError);
      throw menuError;
    }

    console.log('📋 Menu items from DB:', JSON.stringify(menuItems, null, 2));

    // 3. ⭐ ตรวจสอบว่าเมนูทั้งหมดพร้อมขาย (Staff/Manager สามารถสั่งได้แม้ unavailable)
    // const unavailableItems = menuItems.filter(m => !m.is_available);
    // if (unavailableItems.length > 0) {
    //   return res.status(400).json({
    //     ok: false,
    //     error: { 
    //       code: 'ITEMS_UNAVAILABLE', 
    //       message: `Some items are not available: ${unavailableItems.map(m => m.name).join(', ')}` 
    //     }
    //   });
    // }

    // 4. ⭐⭐⭐ ตรวจสอบ STOCK QUANTITY (CRITICAL!)
    const stockErrors = [];
    for (const item of items) {
      const menuItem = menuItems.find(m => m.id === item.menu_item_id);
      
      if (!menuItem) {
        stockErrors.push(`Menu item ${item.menu_item_id} not found`);
        continue;
      }
      
      // ตรวจสอบว่า stock เพียงพอหรือไม่
      if (menuItem.stock_quantity < item.quantity) {
        stockErrors.push(
          `❌ ${menuItem.name}: Requested ${item.quantity}, only ${menuItem.stock_quantity} available in stock`
        );
      }
    }

    // ถ้ามี stock ไม่พอ → ส่ง error กลับทันที
    if (stockErrors.length > 0) {
      console.error('🚫 Stock validation failed:', stockErrors);
      return res.status(400).json({
        ok: false,
        error: { 
          code: 'INSUFFICIENT_STOCK', 
          message: stockErrors.join('; ')
        }
      });
    }

    console.log('✅ Stock validation passed');

    // 5. คำนวณราคารวม
    let totalAmount = 0;
    const orderItems = items.map(item => {
      const menuItem = menuItems.find(m => m.id === item.menu_item_id);
      const unitPrice = menuItem.price;
      const subtotal = unitPrice * item.quantity;
      totalAmount += subtotal;

      return {
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: subtotal,
        notes: item.notes || null
      };
    });

    console.log('💰 Total amount:', totalAmount);

    // 6. สร้าง food order
    const { data: order, error: orderError } = await supabase
      .from('food_orders')
      .insert({
        booking_id,
        order_number: orderNumber,
        user_id,
        table_id,
        status: 'confirmed',
        total_amount: totalAmount,
        special_instructions,
        confirmed_by: req.user.sub,
        confirmed_at: new Date().toISOString()
      })
      .select(`
        *,
        user:users!food_orders_user_id_fkey(id, email, full_name, phone),
        table:tables!food_orders_table_id_fkey(
          id,
          table_number,
          description,
          category:room_categories!tables_category_id_fkey(*)
        )
      `)
      .single();

    if (orderError) {
      console.error('❌ Error creating order:', orderError);
      throw orderError;
    }

    console.log('✅ Order created:', order.id);

    const normalizedOrder = {
      ...order,
      table: normalizeTableCapacity(order.table)
    };

    // 7. สร้าง order items
    const itemsWithOrderId = orderItems.map(item => ({
      ...item,
      food_order_id: order.id
    }));

    const { data: createdItems, error: itemsError } = await supabase
      .from('food_order_items')
      .insert(itemsWithOrderId)
      .select(`
        *,
        menu_item:menu_items(id, name, description, image_url, price)
      `);

    if (itemsError) {
      console.error('❌ Error creating order items:', itemsError);
      throw itemsError;
    }

    console.log('✅ Order items created:', createdItems.length);

    // 8. ⭐⭐⭐ ลด STOCK QUANTITY (CRITICAL!)
    const stockUpdateErrors = [];
    
    for (const item of items) {
      const menuItem = menuItems.find(m => m.id === item.menu_item_id);
      const newStock = menuItem.stock_quantity - item.quantity;

      console.log(`📉 Updating stock for ${menuItem.name}: ${menuItem.stock_quantity} → ${newStock}`);

      const { error: stockError } = await supabase
        .from('menu_items')
        .update({ 
          stock_quantity: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.menu_item_id);

      if (stockError) {
        console.error(`❌ Failed to update stock for item ${item.menu_item_id}:`, stockError);
        stockUpdateErrors.push(`${menuItem.name}: ${stockError.message}`);
      } else {
        console.log(`✅ Stock updated for ${menuItem.name}`);
      }
    }

    if (stockUpdateErrors.length > 0) {
      console.warn('⚠️ Some stock updates failed:', stockUpdateErrors);
    }

    // 9. สร้าง payment record (status: pending)
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        booking_id,
        payment_type: 'full_payment',
        amount: totalAmount,
        payment_method: 'bank_transfer',
        payment_status: 'pending',
        transaction_ref: `FOOD-${orderNumber}`
      });

    if (paymentError) {
      console.warn('⚠️ Failed to create payment record:', paymentError);
    } else {
      console.log('✅ Payment record created');
    }

    // 10. Return order with items
    console.log('🎉 Order creation completed successfully');
    
    return res.status(201).json({
      ok: true,
      data: {
        ...normalizedOrder,
        items: createdItems
      },
      message: 'Food order created successfully. Stock updated. Payment is pending.'
    });

  } catch (error) {
    console.error('💥 CREATE_FOOD_ORDER_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { 
        code: 'CREATE_FAILED', 
        message: error.message || 'Failed to create food order' 
      }
    });
  }
});

// ====================================
// 📊 GET FOOD ORDERS
// ====================================

r.get('/orders', authenticateToken, async (req, res) => {
  try {
    const { status, userId, search, page = 1, limit = 20 } = req.query;

    let query = supabase
      .from('food_orders')
      .select(`
        *,
        user:users!food_orders_user_id_fkey(id, email, full_name, phone),
        table:tables!food_orders_table_id_fkey(
          id,
          table_number,
          description,
          category:room_categories!tables_category_id_fkey(*)
        ),
        booking:bookings!food_orders_booking_id_fkey(id, booking_date, start_time, end_time)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (userId) query = query.eq('user_id', userId);
    if (search) {
      query = query.or(`order_number.ilike.%${search}%,special_instructions.ilike.%${search}%`);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    const orders = (data || []).map(order => ({
      ...order,
      table: normalizeTableCapacity(order.table)
    }));

    return res.json({
      ok: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    console.error('GET_FOOD_ORDERS_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch food orders' }
    });
  }
});

// ====================================
// 📋 GET SINGLE ORDER
// ====================================

r.get('/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { data: order, error } = await supabase
      .from('food_orders')
      .select(`
        *,
        user:users!food_orders_user_id_fkey(id, email, full_name, phone),
        table:tables!food_orders_table_id_fkey(
          id,
          table_number,
          description,
          category:room_categories!tables_category_id_fkey(*)
        ),
        booking:bookings!food_orders_booking_id_fkey(id, booking_date, start_time, end_time),
        items:food_order_items(
          *,
          menu_item:menu_items(id, name, description, image_url, price)
        )
      `)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;

    if (!order) {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Order not found' }
      });
    }

    const normalizedOrder = {
      ...order,
      table: normalizeTableCapacity(order.table)
    };

    return res.json({ ok: true, data: normalizedOrder });
  } catch (error) {
    console.error('GET_ORDER_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch order' }
    });
  }
});



export default r;