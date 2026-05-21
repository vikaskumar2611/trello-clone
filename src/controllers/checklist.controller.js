import { query, withTransaction } from "../database/db.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { DEFAULT_MEMBER_ID } from "../constants.js";
import { getPositionBetween } from "../utils/position.js";

// POST /api/v1/cards/:cardId/checklists
const createChecklist = asyncHandler(async (req, res) => {
    const { cardId } = req.params;
    const { title } = req.body;

    const cardResult = await query(
        `SELECT c.id, l.board_id FROM cards c
     JOIN lists l ON l.id = c.list_id
     WHERE c.id = $1 AND c.is_archived = FALSE`,
        [cardId],
    );
    if (!cardResult.rows[0]) {
        throw new ApiError(404, "Card not found");
    }

    // Place new checklist at end
    const posResult = await query(
        `SELECT COALESCE(MAX(position), 0) AS max_pos
     FROM checklists WHERE card_id = $1`,
        [cardId],
    );
    const position = getPositionBetween(posResult.rows[0].max_pos, null);

    const result = await query(
        `INSERT INTO checklists (card_id, title, position)
     VALUES ($1, $2, $3)
     RETURNING *`,
        [cardId, title?.trim() || "Checklist", position],
    );

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                { ...result.rows[0], items: [] },
                "Checklist created successfully",
            ),
        );
});

// PUT /api/v1/checklists/:checklistId
const updateChecklist = asyncHandler(async (req, res) => {
    const { checklistId } = req.params;
    const { title } = req.body;

    if (!title?.trim()) {
        throw new ApiError(400, "Checklist title is required");
    }

    const result = await query(
        `UPDATE checklists SET title = $1 WHERE id = $2 RETURNING *`,
        [title.trim(), checklistId],
    );

    if (!result.rows[0]) {
        throw new ApiError(404, "Checklist not found");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                result.rows[0],
                "Checklist updated successfully",
            ),
        );
});

// DELETE /api/v1/checklists/:checklistId
const deleteChecklist = asyncHandler(async (req, res) => {
    const { checklistId } = req.params;

    // checklist_items deleted via CASCADE
    const result = await query(
        `DELETE FROM checklists WHERE id = $1 RETURNING id`,
        [checklistId],
    );

    if (!result.rows[0]) {
        throw new ApiError(404, "Checklist not found");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { id: checklistId },
                "Checklist deleted successfully",
            ),
        );
});

// POST /api/v1/checklists/:checklistId/items
const addChecklistItem = asyncHandler(async (req, res) => {
    const { checklistId } = req.params;
    const { title } = req.body;

    if (!title?.trim()) {
        throw new ApiError(400, "Item title is required");
    }

    const checklistResult = await query(
        `SELECT id FROM checklists WHERE id = $1`,
        [checklistId],
    );
    if (!checklistResult.rows[0]) {
        throw new ApiError(404, "Checklist not found");
    }

    // Place new item at end
    const posResult = await query(
        `SELECT COALESCE(MAX(position), 0) AS max_pos
     FROM checklist_items WHERE checklist_id = $1`,
        [checklistId],
    );
    const position = getPositionBetween(posResult.rows[0].max_pos, null);

    const result = await query(
        `INSERT INTO checklist_items (checklist_id, title, position)
     VALUES ($1, $2, $3)
     RETURNING *`,
        [checklistId, title.trim(), position],
    );

    return res
        .status(201)
        .json(new ApiResponse(201, result.rows[0], "Checklist item added"));
});

// PUT /api/v1/checklist-items/:itemId
const updateChecklistItem = asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    const { title, is_completed } = req.body;

    if (title === undefined && is_completed === undefined) {
        throw new ApiError(400, "title or is_completed is required");
    }

    const result = await query(
        `UPDATE checklist_items
     SET
       title        = COALESCE($1, title),
       is_completed = COALESCE($2, is_completed),
       updated_at   = NOW()
     WHERE id = $3
     RETURNING *`,
        [
            title?.trim() || null,
            is_completed !== undefined ? is_completed : null,
            itemId,
        ],
    );

    if (!result.rows[0]) {
        throw new ApiError(404, "Checklist item not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, result.rows[0], "Checklist item updated"));
});

// DELETE /api/v1/checklist-items/:itemId
const deleteChecklistItem = asyncHandler(async (req, res) => {
    const { itemId } = req.params;

    const result = await query(
        `DELETE FROM checklist_items WHERE id = $1 RETURNING id`,
        [itemId],
    );

    if (!result.rows[0]) {
        throw new ApiError(404, "Checklist item not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, { id: itemId }, "Checklist item deleted"));
});

export {
    createChecklist,
    updateChecklist,
    deleteChecklist,
    addChecklistItem,
    updateChecklistItem,
    deleteChecklistItem,
};
