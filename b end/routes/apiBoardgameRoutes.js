import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';
import {
  createBoardgame,
  deleteBoardgame,
  getBoardgames,
  updateBoardgame,
} from '../services/boardgameService.js';

const router = Router();
const ALLOWED_DIFFICULTY = new Set(['easy', 'medium', 'hard']);
const ALLOWED_STATUS = new Set(['available', 'unavailable', 'maintenance']);

function parseNullableInteger(value, fieldName, { allowNull = true } = {}) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return allowNull ? null : undefined;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    const error = new Error(`${fieldName} must be a positive number`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

router.get('/', async (req, res) => {
  try {
    const { search = '', isTrending, page = '1', limit = '20' } = req.query;

    const result = await getBoardgames({
      search,
      page: Number.parseInt(page, 10) || 1,
      limit: Number.parseInt(limit, 10) || 20,
      isTrending:
        typeof isTrending === 'string'
          ? isTrending.toLowerCase() === 'true'
          : undefined,
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    console.error('GET_BOARDGAMES_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch board games' },
    });
  }
});

router.post('/', authenticateToken, requireRole('manager'), async (req, res) => {
  try {
    const {
      name,
      description,
      minPlayers,
      maxPlayers,
      playtimeMinutes,
      complexity,
      imageUrl,
      category,
      status = 'available',
      availableQuantity,
      isTrending = false,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        ok: false,
        error: { code: 'MISSING_NAME', message: 'Board game name is required' },
      });
    }

    const payload = {
      name: name.trim(),
      description: description?.trim() || null,
      minPlayers: parseNullableInteger(minPlayers, 'Minimum players'),
      maxPlayers: parseNullableInteger(maxPlayers, 'Maximum players'),
      playtimeMinutes: parseNullableInteger(playtimeMinutes, 'Playtime'),
      complexity: complexity?.trim()?.toLowerCase() || null,
      category: category?.trim() || null,
      status: status?.trim()?.toLowerCase() || 'available',
      availableQuantity: parseNullableInteger(availableQuantity, 'Available quantity', {
        allowNull: false,
      }),
      imageUrl: imageUrl?.trim() || null,
      isTrending: Boolean(isTrending),
    };

    if (payload.complexity && !ALLOWED_DIFFICULTY.has(payload.complexity)) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_DIFFICULTY',
          message: 'Difficulty level must be one of easy, medium, or hard',
        },
      });
    }

    if (payload.status && !ALLOWED_STATUS.has(payload.status)) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Status must be one of available, unavailable, or maintenance',
        },
      });
    }

    if (
      payload.minPlayers !== null &&
      payload.maxPlayers !== null &&
      payload.minPlayers > payload.maxPlayers
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_RANGE',
          message: 'Minimum players cannot be greater than maximum players',
        },
      });
    }

    if (payload.availableQuantity === undefined) {
      delete payload.availableQuantity;
    }

    const boardgame = await createBoardgame(payload);

    return res.status(201).json({
      ok: true,
      data: boardgame,
      message: 'Board game created successfully',
    });
  } catch (error) {
    console.error('CREATE_BOARDGAME_ERROR:', error);
    if (error.status === 400) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_INPUT', message: error.message },
      });
    }
    return res.status(500).json({
      ok: false,
      error: { code: 'CREATE_FAILED', message: 'Failed to create board game' },
    });
  }
});

router.patch('/:id', authenticateToken, requireRole('manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      minPlayers,
      maxPlayers,
      playtimeMinutes,
      complexity,
      imageUrl,
      category,
      status,
      availableQuantity,
      isTrending,
    } = req.body;

    const updates = {};

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({
          ok: false,
          error: { code: 'INVALID_NAME', message: 'Board game name cannot be empty' },
        });
      }
      updates.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = description?.trim() || null;
    }

    const parsedMinPlayers = parseNullableInteger(minPlayers, 'Minimum players');
    if (parsedMinPlayers !== undefined) {
      updates.minPlayers = parsedMinPlayers;
    }

    const parsedMaxPlayers = parseNullableInteger(maxPlayers, 'Maximum players');
    if (parsedMaxPlayers !== undefined) {
      updates.maxPlayers = parsedMaxPlayers;
    }

    const parsedPlaytime = parseNullableInteger(playtimeMinutes, 'Playtime');
    if (parsedPlaytime !== undefined) {
      updates.playtimeMinutes = parsedPlaytime;
    }

    if (complexity !== undefined) {
      const normalized = complexity?.trim()?.toLowerCase() || null;
      if (normalized && !ALLOWED_DIFFICULTY.has(normalized)) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'INVALID_DIFFICULTY',
            message: 'Difficulty level must be one of easy, medium, or hard',
          },
        });
      }
      updates.complexity = normalized;
    }

    if (imageUrl !== undefined) {
      updates.imageUrl = imageUrl?.trim() || null;
    }

    if (category !== undefined) {
      updates.category = category?.trim() || null;
    }

    if (status !== undefined) {
      const normalizedStatus = status?.trim()?.toLowerCase() || null;
      if (normalizedStatus && !ALLOWED_STATUS.has(normalizedStatus)) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Status must be one of available, unavailable, or maintenance',
          },
        });
      }
      updates.status = normalizedStatus;
    }

    const parsedAvailable = parseNullableInteger(availableQuantity, 'Available quantity', {
      allowNull: false,
    });
    if (parsedAvailable !== undefined) {
      updates.availableQuantity = parsedAvailable;
    }

    if (isTrending !== undefined) {
      updates.isTrending = Boolean(isTrending);
    }

    if (
      updates.minPlayers !== undefined &&
      updates.maxPlayers !== undefined &&
      updates.minPlayers !== null &&
      updates.maxPlayers !== null &&
      updates.minPlayers > updates.maxPlayers
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_RANGE',
          message: 'Minimum players cannot be greater than maximum players',
        },
      });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        ok: false,
        error: { code: 'NO_UPDATES', message: 'No updates provided' },
      });
    }

    const updated = await updateBoardgame(id, updates);

    if (!updated) {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Board game not found' },
      });
    }

    return res.json({
      ok: true,
      data: updated,
      message: 'Board game updated successfully',
    });
  } catch (error) {
    console.error('UPDATE_BOARDGAME_ERROR:', error);
    if (error.status === 400) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_INPUT', message: error.message },
      });
    }
    return res.status(500).json({
      ok: false,
      error: { code: 'UPDATE_FAILED', message: 'Failed to update board game' },
    });
  }
});

router.delete('/:id', authenticateToken, requireRole('manager'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        ok: false,
        error: { code: 'MISSING_ID', message: 'Board game id is required' },
      });
    }

    await deleteBoardgame(id);

    return res.json({ ok: true, message: 'Board game deleted successfully' });
  } catch (error) {
    console.error('DELETE_BOARDGAME_ERROR:', error);
    if (error.status === 404) {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Board game not found' },
      });
    }

    return res.status(500).json({
      ok: false,
      error: { code: 'DELETE_FAILED', message: 'Failed to delete board game' },
    });
  }
});

export default router;
