import { query } from "../database/db.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { DEFAULT_MEMBER_ID } from "../constants.js";

// GET /api/v1/cards/:cardId/comments
const getComments = asyncHandler(async (req, res) => {
    const { cardId } = req.params;

    const result = await query(
        `SELECT
       cm.id,
       cm.content,
       cm.created_at,
       cm.updated_at,
       JSON_BUILD_OBJECT(
         'id',         m.id,
         'name',       m.name,
         'avatar_url', m.avatar_url,
         'color',      m.color
       ) AS member
     FROM comments cm
     JOIN members m ON m.id = cm.member_id
     WHERE cm.card_id = $1
     ORDER BY cm.created_at ASC`,
        [cardId],
    );

    return res
        .status(200)
        .json(
            new ApiResponse(200, result.rows, "Comments fetched successfully"),
        );
});

// POST /api/v1/cards/:cardId/comments
const addComment = asyncHandler(async (req, res) => {
    const { cardId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
        throw new ApiError(400, "Comment content is required");
    }

    const cardResult = await query(
        `SELECT id FROM cards WHERE id = $1 AND is_archived = FALSE`,
        [cardId],
    );
    if (!cardResult.rows[0]) {
        throw new ApiError(404, "Card not found");
    }

    const result = await query(
        `INSERT INTO comments (card_id, member_id, content)
     VALUES ($1, $2, $3)
     RETURNING *`,
        [cardId, DEFAULT_MEMBER_ID, content.trim()],
    );

    // Return comment with member info
    const commentWithMember = await query(
        `SELECT
       cm.id,
       cm.content,
       cm.created_at,
       cm.updated_at,
       JSON_BUILD_OBJECT(
         'id',         m.id,
         'name',       m.name,
         'avatar_url', m.avatar_url,
         'color',      m.color
       ) AS member
     FROM comments cm
     JOIN members m ON m.id = cm.member_id
     WHERE cm.id = $1`,
        [result.rows[0].id],
    );

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                commentWithMember.rows[0],
                "Comment added successfully",
            ),
        );
});

// PUT /api/v1/comments/:commentId
const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
        throw new ApiError(400, "Comment content is required");
    }

    const result = await query(
        `UPDATE comments
     SET content = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
        [content.trim(), commentId],
    );

    if (!result.rows[0]) {
        throw new ApiError(404, "Comment not found");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                result.rows[0],
                "Comment updated successfully",
            ),
        );
});

// DELETE /api/v1/comments/:commentId
const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    const result = await query(
        `DELETE FROM comments WHERE id = $1 RETURNING id`,
        [commentId],
    );

    if (!result.rows[0]) {
        throw new ApiError(404, "Comment not found");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { id: commentId },
                "Comment deleted successfully",
            ),
        );
});

export { getComments, addComment, updateComment, deleteComment };
