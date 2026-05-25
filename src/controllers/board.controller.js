// src/controllers/board.controller.js
import { query, withTransaction } from "../database/db.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    DEFAULT_LABEL_COLORS,
    DEFAULT_MEMBER_ID,
    DEFAULT_BOARD_BG,
} from "../constants.js";

// POST /api/v1/boards
const createBoard = asyncHandler(async (req, res) => {
    const { title, description, background_color, background_image } = req.body;

    if (!title?.trim()) {
        throw new ApiError(400, "Board title is required");
    }

    const result = await withTransaction(async (client) => {
        // Create board
        const boardResult = await client.query(
            `INSERT INTO boards (title, description, background_color, background_image)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
            [
                title.trim(),
                description?.trim() || null,
                background_color || DEFAULT_BOARD_BG,
                background_image || null,
            ],
        );
        const board = boardResult.rows[0];

        // Add default member (Alice) as admin of this board
        await client.query(
            `INSERT INTO board_members (board_id, member_id, role)
       VALUES ($1, $2, 'admin')`,
            [board.id, DEFAULT_MEMBER_ID],
        );

        // Create default labels for this board
        for (const label of DEFAULT_LABEL_COLORS) {
            await client.query(
                `INSERT INTO labels (board_id, name, color) VALUES ($1, $2, $3)`,
                [board.id, label.name, label.color],
            );
        }

        // Log activity
        await client.query(
            `INSERT INTO activities (board_id, member_id, action, data)
       VALUES ($1, $2, 'created_board', $3)`,
            [
                board.id,
                DEFAULT_MEMBER_ID,
                JSON.stringify({ board_title: board.title }),
            ],
        );

        return board;
    });

    return res
        .status(201)
        .json(new ApiResponse(201, result, "Board created successfully"));
});

// GET /api/v1/boards
const getAllBoards = asyncHandler(async (req, res) => {
    const result = await query(
        `SELECT 
       b.*,
       COUNT(DISTINCT l.id) FILTER (WHERE l.is_archived = FALSE) AS list_count,
       COUNT(DISTINCT c.id) FILTER (WHERE c.is_archived = FALSE) AS card_count
     FROM boards b
     LEFT JOIN lists l ON l.board_id = b.id
     LEFT JOIN cards c ON c.list_id = l.id
     WHERE b.is_archived = FALSE
     GROUP BY b.id
     ORDER BY b.created_at DESC`,
    );

    return res
        .status(200)
        .json(new ApiResponse(200, result.rows, "Boards fetched successfully"));
});

// GET /api/v1/boards/:boardId
const getBoardById = asyncHandler(async (req, res) => {
    const { boardId } = req.params;

    // Fetch board
    const boardResult = await query(
        `SELECT * FROM boards WHERE id = $1 AND is_archived = FALSE`,
        [boardId],
    );

    if (!boardResult.rows[0]) {
        throw new ApiError(404, "Board not found");
    }

    // Fetch lists with their cards and card details aggregated
    // One query to get everything - avoids N+1 problem
    const listsResult = await query(
        `SELECT
       l.id,
       l.title,
       l.position,
       l.created_at,
       COALESCE(
         JSON_AGG(
           JSON_BUILD_OBJECT(
             'id',            c.id,
             'title',         c.title,
             'description',   c.description,
             'position',      c.position,
             'due_date',      c.due_date,
             'due_completed', c.due_completed,
             'cover_color',   c.cover_color,
             'cover_image',   c.cover_image,
             'is_archived',   c.is_archived,
             'created_at',    c.created_at,
             'labels', (
               SELECT COALESCE(
                 JSON_AGG(
                   JSON_BUILD_OBJECT(
                     'id',    lbl.id,
                     'name',  lbl.name,
                     'color', lbl.color
                   )
                 ), '[]'::json
               )
               FROM card_labels cl
               JOIN labels lbl ON lbl.id = cl.label_id
               WHERE cl.card_id = c.id
             ),
             'members', (
               SELECT COALESCE(
                 JSON_AGG(
                   JSON_BUILD_OBJECT(
                     'id',         m.id,
                     'name',       m.name,
                     'avatar_url', m.avatar_url,
                     'color',      m.color
                   )
                 ), '[]'::json
               )
               FROM card_members cm
               JOIN members m ON m.id = cm.member_id
               WHERE cm.card_id = c.id
             ),
             'checklist_progress', (
               SELECT JSON_BUILD_OBJECT(
                 'total',     COUNT(ci.id),
                 'completed', COUNT(ci.id) FILTER (WHERE ci.is_completed = TRUE)
               )
               FROM checklists ch
               JOIN checklist_items ci ON ci.checklist_id = ch.id
               WHERE ch.card_id = c.id
             )
           ) ORDER BY c.position
         ) FILTER (WHERE c.id IS NOT NULL AND c.is_archived = FALSE),
         '[]'::json
       ) AS cards
     FROM lists l
     LEFT JOIN cards c ON c.list_id = l.id
     WHERE l.board_id = $1 AND l.is_archived = FALSE
     GROUP BY l.id
     ORDER BY l.position`,
        [boardId],
    );

    // Fetch board members
    const membersResult = await query(
        `SELECT m.id, m.name, m.email, m.avatar_url, m.color, bm.role
     FROM members m
     JOIN board_members bm ON bm.member_id = m.id
     WHERE bm.board_id = $1
     ORDER BY bm.joined_at`,
        [boardId],
    );

    // Fetch board labels
    const labelsResult = await query(
        `SELECT * FROM labels WHERE board_id = $1 ORDER BY created_at`,
        [boardId],
    );

    const board = {
        ...boardResult.rows[0],
        lists: listsResult.rows,
        members: membersResult.rows,
        labels: labelsResult.rows,
    };

    return res
        .status(200)
        .json(new ApiResponse(200, board, "Board fetched successfully"));
});

// PUT /api/v1/boards/:boardId
const updateBoard = asyncHandler(async (req, res) => {
    const { boardId } = req.params;
    const { title, description, background_color, background_image } = req.body;

    const hasTitle = Object.prototype.hasOwnProperty.call(req.body, "title");
    const hasDescription = Object.prototype.hasOwnProperty.call(
        req.body,
        "description",
    );
    const hasBackgroundColor = Object.prototype.hasOwnProperty.call(
        req.body,
        "background_color",
    );
    const hasBackgroundImage = Object.prototype.hasOwnProperty.call(
        req.body,
        "background_image",
    );

    if (
        !hasTitle &&
        !hasDescription &&
        !hasBackgroundColor &&
        !hasBackgroundImage
    ) {
        throw new ApiError(400, "At least one field is required to update");
    }

    if (hasTitle && !title?.trim()) {
        throw new ApiError(400, "Board title is required");
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (hasTitle) {
        updates.push(`title = $${idx++}`);
        values.push(title.trim());
    }

    if (hasDescription) {
        updates.push(`description = $${idx++}`);
        values.push(description?.trim() || null);
    }

    if (hasBackgroundColor) {
        updates.push(`background_color = $${idx++}`);
        values.push(background_color || null);
    }

    if (hasBackgroundImage) {
        updates.push(`background_image = $${idx++}`);
        values.push(background_image ?? null);
    }

    values.push(boardId);

    const result = await query(
        `UPDATE boards
     SET ${updates.join(", ")}, updated_at = NOW()
     WHERE id = $${idx} AND is_archived = FALSE
     RETURNING *`,
        values,
    );

    if (!result.rows[0]) {
        throw new ApiError(404, "Board not found");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, result.rows[0], "Board updated successfully"),
        );
});

// DELETE /api/v1/boards/:boardId  (soft delete)
const deleteBoard = asyncHandler(async (req, res) => {
    const { boardId } = req.params;

    const result = await query(
        `UPDATE boards SET is_archived = TRUE, updated_at = NOW()
     WHERE id = $1 AND is_archived = FALSE
     RETURNING id`,
        [boardId],
    );

    if (!result.rows[0]) {
        throw new ApiError(404, "Board not found");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { id: boardId },
                "Board archived successfully",
            ),
        );
});

export { createBoard, getAllBoards, getBoardById, updateBoard, deleteBoard };
