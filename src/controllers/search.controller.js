import { query } from "../database/db.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// GET /api/v1/boards/:boardId/search
// Query params:
//   q        -> text search on card title (ILIKE)
//   labels   -> comma-separated label IDs
//   members  -> comma-separated member IDs
//   due      -> 'overdue' | 'due_soon' | 'no_due' | 'has_due'
const searchCards = asyncHandler(async (req, res) => {
    const { boardId } = req.params;
    const { q, labels, members, due } = req.query;

    // At least one filter must be provided
    if (!q && !labels && !members && !due) {
        throw new ApiError(
            400,
            "At least one search/filter parameter is required",
        );
    }

    // Verify board exists
    const boardResult = await query(
        `SELECT id FROM boards WHERE id = $1 AND is_archived = FALSE`,
        [boardId],
    );
    if (!boardResult.rows[0]) {
        throw new ApiError(404, "Board not found");
    }

    // Build query dynamically based on which filters are active
    // Start with conditions that always apply
    const conditions = [
        "l.board_id = $1",
        "c.is_archived = FALSE",
        "l.is_archived = FALSE",
    ];
    const params = [boardId];
    let paramIdx = 2; // $1 is boardId, next available is $2

    // Text search - case insensitive partial match on title
    if (q?.trim()) {
        conditions.push(`c.title ILIKE $${paramIdx}`);
        params.push(`%${q.trim()}%`);
        paramIdx++;
    }

    // Label filter - card must have ALL of the specified labels
    if (labels?.trim()) {
        const labelIds = labels
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean);
        if (labelIds.length > 0) {
            conditions.push(
                `EXISTS (
           SELECT 1 FROM card_labels cl
           WHERE cl.card_id = c.id
           AND cl.label_id = ANY($${paramIdx}::uuid[])
         )`,
            );
            params.push(labelIds);
            paramIdx++;
        }
    }

    // Member filter - card must have at least one of the specified members
    if (members?.trim()) {
        const memberIds = members
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean);
        if (memberIds.length > 0) {
            conditions.push(
                `EXISTS (
           SELECT 1 FROM card_members cm
           WHERE cm.card_id = c.id
           AND cm.member_id = ANY($${paramIdx}::uuid[])
         )`,
            );
            params.push(memberIds);
            paramIdx++;
        }
    }

    // Due date filters
    if (due) {
        if (due === "overdue") {
            // Past due and not marked complete
            conditions.push(`c.due_date < NOW() AND c.due_completed = FALSE`);
        } else if (due === "due_soon") {
            // Due within next 2 days and not complete
            conditions.push(
                `c.due_date BETWEEN NOW() AND NOW() + INTERVAL '2 days'
         AND c.due_completed = FALSE`,
            );
        } else if (due === "no_due") {
            conditions.push(`c.due_date IS NULL`);
        } else if (due === "has_due") {
            conditions.push(`c.due_date IS NOT NULL`);
        } else {
            throw new ApiError(
                400,
                "due must be one of: overdue, due_soon, no_due, has_due",
            );
        }
    }

    const searchQuery = `
    SELECT
      c.id,
      c.title,
      c.description,
      c.position,
      c.due_date,
      c.due_completed,
      c.cover_color,
      c.cover_image,
      c.created_at,
      l.id    AS list_id,
      l.title AS list_title,
      COALESCE(
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT('id', lbl.id, 'name', lbl.name, 'color', lbl.color)
          )
          FROM card_labels cl
          JOIN labels lbl ON lbl.id = cl.label_id
          WHERE cl.card_id = c.id
        ), '[]'::json
      ) AS labels,
      COALESCE(
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT('id', m.id, 'name', m.name, 'color', m.color, 'avatar_url', m.avatar_url)
          )
          FROM card_members cm
          JOIN members m ON m.id = cm.member_id
          WHERE cm.card_id = c.id
        ), '[]'::json
      ) AS members
    FROM cards c
    JOIN lists l ON l.id = c.list_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY l.position, c.position
  `;

    const result = await query(searchQuery, params);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                count: result.rows.length,
                cards: result.rows,
            },
            "Search completed successfully",
        ),
    );
});

export { searchCards };
