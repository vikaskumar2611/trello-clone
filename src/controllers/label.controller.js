import { query } from "../database/db.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// GET /api/v1/boards/:boardId/labels
const getBoardLabels = asyncHandler(async (req, res) => {
    const { boardId } = req.params;

    const result = await query(
        `SELECT * FROM labels WHERE board_id = $1 ORDER BY created_at`,
        [boardId],
    );

    return res
        .status(200)
        .json(new ApiResponse(200, result.rows, "Labels fetched successfully"));
});

// POST /api/v1/boards/:boardId/labels
const createLabel = asyncHandler(async (req, res) => {
    const { boardId } = req.params;
    const { name, color } = req.body;

    if (!color) {
        throw new ApiError(400, "Label color is required");
    }

    // Validate hex color format
    const hexColorRegex = /^#([A-Fa-f0-9]{6})$/;
    if (!hexColorRegex.test(color)) {
        throw new ApiError(400, "Color must be a valid hex code e.g. #FF5630");
    }

    const boardResult = await query(
        `SELECT id FROM boards WHERE id = $1 AND is_archived = FALSE`,
        [boardId],
    );
    if (!boardResult.rows[0]) {
        throw new ApiError(404, "Board not found");
    }

    const result = await query(
        `INSERT INTO labels (board_id, name, color)
     VALUES ($1, $2, $3)
     RETURNING *`,
        [boardId, name?.trim() || null, color],
    );

    return res
        .status(201)
        .json(
            new ApiResponse(201, result.rows[0], "Label created successfully"),
        );
});

// PUT /api/v1/labels/:labelId
const updateLabel = asyncHandler(async (req, res) => {
    const { labelId } = req.params;
    const { name, color } = req.body;

    if (!name && !color) {
        throw new ApiError(400, "name or color is required to update");
    }

    if (color) {
        const hexColorRegex = /^#([A-Fa-f0-9]{6})$/;
        if (!hexColorRegex.test(color)) {
            throw new ApiError(
                400,
                "Color must be a valid hex code e.g. #FF5630",
            );
        }
    }

    const result = await query(
        `UPDATE labels
     SET
       name  = COALESCE($1, name),
       color = COALESCE($2, color)
     WHERE id = $3
     RETURNING *`,
        [name?.trim() || null, color || null, labelId],
    );

    if (!result.rows[0]) {
        throw new ApiError(404, "Label not found");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, result.rows[0], "Label updated successfully"),
        );
});

// DELETE /api/v1/labels/:labelId
const deleteLabel = asyncHandler(async (req, res) => {
    const { labelId } = req.params;

    // card_labels rows are deleted via CASCADE on labels table
    const result = await query(
        `DELETE FROM labels WHERE id = $1 RETURNING id`,
        [labelId],
    );

    if (!result.rows[0]) {
        throw new ApiError(404, "Label not found");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, { id: labelId }, "Label deleted successfully"),
        );
});

export { getBoardLabels, createLabel, updateLabel, deleteLabel };
