import { query, withTransaction } from "../database/db.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { DEFAULT_MEMBER_ID } from "../constants.js";
import { getPositionBetween } from "../utils/position.js";

// POST /api/v1/boards/:boardId/lists
const createList = asyncHandler(async (req, res) => {
    const { boardId } = req.params;
    const { title } = req.body;

    if (!title?.trim()) {
        throw new ApiError(400, "List title is required");
    }

    // Verify board exists
    const boardResult = await query(
        `SELECT id FROM boards WHERE id = $1 AND is_archived = FALSE`,
        [boardId],
    );
    if (!boardResult.rows[0]) {
        throw new ApiError(404, "Board not found");
    }

    // Get current max position to place new list at the end
    const posResult = await query(
        `SELECT COALESCE(MAX(position), 0) AS max_pos
     FROM lists WHERE board_id = $1 AND is_archived = FALSE`,
        [boardId],
    );
    const position = getPositionBetween(posResult.rows[0].max_pos, null);

    const result = await withTransaction(async (client) => {
        const listResult = await client.query(
            `INSERT INTO lists (board_id, title, position)
       VALUES ($1, $2, $3)
       RETURNING *`,
            [boardId, title.trim(), position],
        );

        await client.query(
            `INSERT INTO activities (board_id, member_id, action, data)
       VALUES ($1, $2, 'created_list', $3)`,
            [
                boardId,
                DEFAULT_MEMBER_ID,
                JSON.stringify({ list_title: listResult.rows[0].title }),
            ],
        );

        return listResult.rows[0];
    });

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                { ...result, cards: [] },
                "List created successfully",
            ),
        );
});

// PUT /api/v1/lists/:listId
const updateList = asyncHandler(async (req, res) => {
    const { listId } = req.params;
    const { title } = req.body;

    if (!title?.trim()) {
        throw new ApiError(400, "List title is required");
    }

    const result = await query(
        `UPDATE lists
     SET title = $1, updated_at = NOW()
     WHERE id = $2 AND is_archived = FALSE
     RETURNING *`,
        [title.trim(), listId],
    );

    if (!result.rows[0]) {
        throw new ApiError(404, "List not found");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, result.rows[0], "List updated successfully"),
        );
});

// DELETE /api/v1/lists/:listId  (soft delete)
const deleteList = asyncHandler(async (req, res) => {
    const { listId } = req.params;

    // Get list info before deleting (for activity log)
    const listResult = await query(
        `SELECT * FROM lists WHERE id = $1 AND is_archived = FALSE`,
        [listId],
    );

    if (!listResult.rows[0]) {
        throw new ApiError(404, "List not found");
    }

    await withTransaction(async (client) => {
        // Soft delete the list
        await client.query(
            `UPDATE lists SET is_archived = TRUE, updated_at = NOW() WHERE id = $1`,
            [listId],
        );

        // Also soft delete all cards in this list
        await client.query(
            `UPDATE cards SET is_archived = TRUE, updated_at = NOW() WHERE list_id = $1`,
            [listId],
        );

        await client.query(
            `INSERT INTO activities (board_id, member_id, action, data)
       VALUES ($1, $2, 'archived_list', $3)`,
            [
                listResult.rows[0].board_id,
                DEFAULT_MEMBER_ID,
                JSON.stringify({ list_title: listResult.rows[0].title }),
            ],
        );
    });

    return res
        .status(200)
        .json(
            new ApiResponse(200, { id: listId }, "List archived successfully"),
        );
});

// DELETE /api/v1/lists/:listId/permanent  (hard delete)
const deleteListPermanently = asyncHandler(async (req, res) => {
    const { listId } = req.params;

    const listResult = await query(`SELECT * FROM lists WHERE id = $1`, [
        listId,
    ]);

    if (!listResult.rows[0]) {
        throw new ApiError(404, "List not found");
    }

    await withTransaction(async (client) => {
        await client.query(`DELETE FROM lists WHERE id = $1`, [listId]);

        await client.query(
            `INSERT INTO activities (board_id, member_id, action, data)
       VALUES ($1, $2, 'deleted_list', $3)`,
            [
                listResult.rows[0].board_id,
                DEFAULT_MEMBER_ID,
                JSON.stringify({ list_title: listResult.rows[0].title }),
            ],
        );
    });

    return res
        .status(200)
        .json(new ApiResponse(200, { id: listId }, "List deleted"));
});

// PUT /api/v1/lists/:listId/move
// Body: { position: float }  <- calculated by frontend using getPositionBetween
const moveList = asyncHandler(async (req, res) => {
    const { listId } = req.params;
    const { position } = req.body;

    if (position === undefined || position === null) {
        throw new ApiError(400, "Position is required");
    }

    if (typeof position !== "number") {
        throw new ApiError(400, "Position must be a number");
    }

    const result = await query(
        `UPDATE lists
     SET position = $1, updated_at = NOW()
     WHERE id = $2 AND is_archived = FALSE
     RETURNING *`,
        [position, listId],
    );

    if (!result.rows[0]) {
        throw new ApiError(404, "List not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, result.rows[0], "List moved successfully"));
});

// GET /api/v1/boards/:boardId/archived-lists
const getArchivedLists = asyncHandler(async (req, res) => {
    const { boardId } = req.params;

    const result = await query(
        `SELECT l.*,
       COUNT(c.id) AS card_count
     FROM lists l
     LEFT JOIN cards c ON c.list_id = l.id
     WHERE l.board_id = $1 AND l.is_archived = TRUE
     GROUP BY l.id
     ORDER BY l.updated_at DESC`,
        [boardId],
    );

    return res
        .status(200)
        .json(new ApiResponse(200, result.rows, "Archived lists fetched"));
});

// PUT /api/v1/lists/:listId/restore
const restoreList = asyncHandler(async (req, res) => {
    const { listId } = req.params;

    const result = await query(
        `UPDATE lists
     SET is_archived = FALSE, updated_at = NOW()
     WHERE id = $1 AND is_archived = TRUE
     RETURNING *`,
        [listId],
    );

    if (!result.rows[0]) {
        throw new ApiError(404, "Archived list not found");
    }

    // Also restore all cards that belong to this list
    await query(
        `UPDATE cards
     SET is_archived = FALSE, updated_at = NOW()
     WHERE list_id = $1`,
        [listId],
    );

    return res
        .status(200)
        .json(
            new ApiResponse(200, result.rows[0], "List restored successfully"),
        );
});

export {
    createList,
    updateList,
    deleteList,
    deleteListPermanently,
    moveList,
    getArchivedLists,
    restoreList,
};
