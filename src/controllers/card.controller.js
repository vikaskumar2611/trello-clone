import { query, withTransaction } from "../database/db.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { DEFAULT_MEMBER_ID } from "../constants.js";
import { getPositionBetween } from "../utils/position.js";

// POST /api/v1/lists/:listId/cards
const createCard = asyncHandler(async (req, res) => {
    const { listId } = req.params;
    const { title } = req.body;

    if (!title?.trim()) {
        throw new ApiError(400, "Card title is required");
    }

    // Verify list exists and get its board_id for activity log
    const listResult = await query(
        `SELECT id, board_id FROM lists WHERE id = $1 AND is_archived = FALSE`,
        [listId],
    );
    if (!listResult.rows[0]) {
        throw new ApiError(404, "List not found");
    }
    const { board_id } = listResult.rows[0];

    // Place new card at the end of the list
    const posResult = await query(
        `SELECT COALESCE(MAX(position), 0) AS max_pos
     FROM cards WHERE list_id = $1 AND is_archived = FALSE`,
        [listId],
    );
    const position = getPositionBetween(posResult.rows[0].max_pos, null);

    const result = await withTransaction(async (client) => {
        const cardResult = await client.query(
            `INSERT INTO cards (list_id, title, position)
       VALUES ($1, $2, $3)
       RETURNING *`,
            [listId, title.trim(), position],
        );
        const card = cardResult.rows[0];

        await client.query(
            `INSERT INTO activities (board_id, card_id, member_id, action, data)
       VALUES ($1, $2, $3, 'created_card', $4)`,
            [
                board_id,
                card.id,
                DEFAULT_MEMBER_ID,
                JSON.stringify({ card_title: card.title }),
            ],
        );

        return card;
    });

    // Return card with empty relations (just created)
    return res.status(201).json(
        new ApiResponse(
            201,
            {
                ...result,
                labels: [],
                members: [],
                checklist_progress: { total: 0, completed: 0 },
            },
            "Card created successfully",
        ),
    );
});

// GET /api/v1/cards/:cardId  (full details for modal)
const getCardById = asyncHandler(async (req, res) => {
    const { cardId } = req.params;

    const cardResult = await query(
        `SELECT c.*, l.title AS list_title, l.board_id
     FROM cards c
     JOIN lists l ON l.id = c.list_id
     WHERE c.id = $1`,
        [cardId],
    );

    if (!cardResult.rows[0]) {
        throw new ApiError(404, "Card not found");
    }

    // Fetch all card relations in parallel - faster than sequential awaits
    const [
        labelsResult,
        membersResult,
        checklistsResult,
        commentsResult,
        attachmentsResult,
    ] = await Promise.all([
        // Labels
        query(
            `SELECT lbl.id, lbl.name, lbl.color
       FROM labels lbl
       JOIN card_labels cl ON cl.label_id = lbl.id
       WHERE cl.card_id = $1`,
            [cardId],
        ),
        // Members
        query(
            `SELECT m.id, m.name, m.email, m.avatar_url, m.color
       FROM members m
       JOIN card_members cm ON cm.member_id = m.id
       WHERE cm.card_id = $1`,
            [cardId],
        ),
        // Checklists with items aggregated
        query(
            `SELECT
         ch.id,
         ch.title,
         ch.position,
         ch.created_at,
         COALESCE(
           JSON_AGG(
             JSON_BUILD_OBJECT(
               'id',           ci.id,
               'title',        ci.title,
               'is_completed', ci.is_completed,
               'position',     ci.position,
               'created_at',   ci.created_at
             ) ORDER BY ci.position
           ) FILTER (WHERE ci.id IS NOT NULL),
           '[]'::json
         ) AS items
       FROM checklists ch
       LEFT JOIN checklist_items ci ON ci.checklist_id = ch.id
       WHERE ch.card_id = $1
       GROUP BY ch.id
       ORDER BY ch.position`,
            [cardId],
        ),
        // Comments with member info
        query(
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
        ),
        // Attachments with uploader info
        query(
            `SELECT
         a.id,
         a.filename,
         a.file_url,
         a.file_size,
         a.mime_type,
         a.created_at,
         JSON_BUILD_OBJECT(
           'id',   m.id,
           'name', m.name
         ) AS uploaded_by
       FROM attachments a
       LEFT JOIN members m ON m.id = a.member_id
       WHERE a.card_id = $1
       ORDER BY a.created_at DESC`,
            [cardId],
        ),
    ]);

    const card = {
        ...cardResult.rows[0],
        labels: labelsResult.rows,
        members: membersResult.rows,
        checklists: checklistsResult.rows,
        comments: commentsResult.rows,
        attachments: attachmentsResult.rows,
    };

    return res
        .status(200)
        .json(new ApiResponse(200, card, "Card fetched successfully"));
});

// PUT /api/v1/cards/:cardId
const updateCard = asyncHandler(async (req, res) => {
    const { cardId } = req.params;
    const {
        title,
        description,
        due_date,
        due_completed,
        cover_color,
        cover_image,
    } = req.body;

    if (
        !title &&
        description === undefined &&
        due_date === undefined &&
        due_completed === undefined &&
        cover_color === undefined &&
        cover_image === undefined
    ) {
        throw new ApiError(400, "At least one field is required to update");
    }

    // Get current card to log changes
    const currentCard = await query(
        `SELECT c.*, l.board_id FROM cards c JOIN lists l ON l.id = c.list_id WHERE c.id = $1`,
        [cardId],
    );
    if (!currentCard.rows[0]) {
        throw new ApiError(404, "Card not found");
    }

    const result = await withTransaction(async (client) => {
        const updatedCard = await client.query(
            `UPDATE cards
       SET
         title         = COALESCE($1, title),
         description   = $2,
         due_date      = $3,
         due_completed = COALESCE($4, due_completed),
         cover_color   = $5,
         cover_image   = $6,
         updated_at    = NOW()
       WHERE id = $7
       RETURNING *`,
            [
                title?.trim() || null,
                // Allow setting description to empty string (clearing it)
                description !== undefined
                    ? description
                    : currentCard.rows[0].description,
                due_date !== undefined
                    ? due_date
                    : currentCard.rows[0].due_date,
                due_completed !== undefined ? due_completed : null,
                cover_color !== undefined
                    ? cover_color
                    : currentCard.rows[0].cover_color,
                cover_image !== undefined
                    ? cover_image
                    : currentCard.rows[0].cover_image,
                cardId,
            ],
        );

        // Log what changed
        if (due_completed !== undefined) {
            await client.query(
                `INSERT INTO activities (board_id, card_id, member_id, action, data)
         VALUES ($1, $2, $3, $4, $5)`,
                [
                    currentCard.rows[0].board_id,
                    cardId,
                    DEFAULT_MEMBER_ID,
                    due_completed
                        ? "marked_due_complete"
                        : "marked_due_incomplete",
                    JSON.stringify({ card_title: currentCard.rows[0].title }),
                ],
            );
        }

        return updatedCard.rows[0];
    });

    return res
        .status(200)
        .json(new ApiResponse(200, result, "Card updated successfully"));
});

// PUT /api/v1/cards/:cardId/move
// Body: { list_id, position }
const moveCard = asyncHandler(async (req, res) => {
    const { cardId } = req.params;
    const { list_id, position } = req.body;

    if (!list_id) {
        throw new ApiError(400, "list_id is required");
    }
    if (position === undefined || position === null) {
        throw new ApiError(400, "position is required");
    }
    if (typeof position !== "number") {
        throw new ApiError(400, "position must be a number");
    }

    // Get current card state for activity log
    const currentCard = await query(
        `SELECT c.*, l.board_id, l.title AS list_title
     FROM cards c
     JOIN lists l ON l.id = c.list_id
     WHERE c.id = $1`,
        [cardId],
    );
    if (!currentCard.rows[0]) {
        throw new ApiError(404, "Card not found");
    }

    // Verify destination list exists
    const destList = await query(
        `SELECT id, title, board_id FROM lists WHERE id = $1 AND is_archived = FALSE`,
        [list_id],
    );
    if (!destList.rows[0]) {
        throw new ApiError(404, "Destination list not found");
    }

    const result = await withTransaction(async (client) => {
        const updatedCard = await client.query(
            `UPDATE cards
       SET list_id = $1, position = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
            [list_id, position, cardId],
        );

        // Only log if card actually moved to a different list
        if (currentCard.rows[0].list_id !== list_id) {
            await client.query(
                `INSERT INTO activities (board_id, card_id, member_id, action, data)
         VALUES ($1, $2, $3, 'moved_card', $4)`,
                [
                    currentCard.rows[0].board_id,
                    cardId,
                    DEFAULT_MEMBER_ID,
                    JSON.stringify({
                        card_title: currentCard.rows[0].title,
                        from_list: currentCard.rows[0].list_title,
                        to_list: destList.rows[0].title,
                    }),
                ],
            );
        }

        return updatedCard.rows[0];
    });

    return res
        .status(200)
        .json(new ApiResponse(200, result, "Card moved successfully"));
});

// DELETE /api/v1/cards/:cardId  (soft delete / archive)
const deleteCard = asyncHandler(async (req, res) => {
    const { cardId } = req.params;

    const currentCard = await query(
        `SELECT c.*, l.board_id FROM cards c JOIN lists l ON l.id = c.list_id WHERE c.id = $1`,
        [cardId],
    );
    if (!currentCard.rows[0]) {
        throw new ApiError(404, "Card not found");
    }

    await withTransaction(async (client) => {
        await client.query(
            `UPDATE cards SET is_archived = TRUE, updated_at = NOW() WHERE id = $1`,
            [cardId],
        );

        await client.query(
            `INSERT INTO activities (board_id, card_id, member_id, action, data)
       VALUES ($1, $2, $3, 'archived_card', $4)`,
            [
                currentCard.rows[0].board_id,
                cardId,
                DEFAULT_MEMBER_ID,
                JSON.stringify({ card_title: currentCard.rows[0].title }),
            ],
        );
    });

    return res
        .status(200)
        .json(
            new ApiResponse(200, { id: cardId }, "Card archived successfully"),
        );
});

// POST /api/v1/cards/:cardId/labels
const addLabel = asyncHandler(async (req, res) => {
    const { cardId } = req.params;
    const { label_id } = req.body;

    if (!label_id) {
        throw new ApiError(400, "label_id is required");
    }

    // Verify card and label both exist
    const [cardResult, labelResult] = await Promise.all([
        query(`SELECT id FROM cards WHERE id = $1`, [cardId]),
        query(`SELECT id, name, color FROM labels WHERE id = $1`, [label_id]),
    ]);

    if (!cardResult.rows[0]) throw new ApiError(404, "Card not found");
    if (!labelResult.rows[0]) throw new ApiError(404, "Label not found");

    // ON CONFLICT DO NOTHING prevents duplicate label assignment
    await query(
        `INSERT INTO card_labels (card_id, label_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
        [cardId, label_id],
    );

    return res
        .status(200)
        .json(new ApiResponse(200, labelResult.rows[0], "Label added to card"));
});

// DELETE /api/v1/cards/:cardId/labels/:labelId
const removeLabel = asyncHandler(async (req, res) => {
    const { cardId, labelId } = req.params;

    await query(
        `DELETE FROM card_labels WHERE card_id = $1 AND label_id = $2`,
        [cardId, labelId],
    );

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { card_id: cardId, label_id: labelId },
                "Label removed from card",
            ),
        );
});

// POST /api/v1/cards/:cardId/members
const assignMember = asyncHandler(async (req, res) => {
    const { cardId } = req.params;
    const { member_id } = req.body;

    if (!member_id) {
        throw new ApiError(400, "member_id is required");
    }

    const [cardResult, memberResult] = await Promise.all([
        query(`SELECT id FROM cards WHERE id = $1`, [cardId]),
        query(`SELECT id, name, avatar_url, color FROM members WHERE id = $1`, [
            member_id,
        ]),
    ]);

    if (!cardResult.rows[0]) throw new ApiError(404, "Card not found");
    if (!memberResult.rows[0]) throw new ApiError(404, "Member not found");

    await query(
        `INSERT INTO card_members (card_id, member_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
        [cardId, member_id],
    );

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                memberResult.rows[0],
                "Member assigned to card",
            ),
        );
});

// DELETE /api/v1/cards/:cardId/members/:memberId
const removeMember = asyncHandler(async (req, res) => {
    const { cardId, memberId } = req.params;

    await query(
        `DELETE FROM card_members WHERE card_id = $1 AND member_id = $2`,
        [cardId, memberId],
    );

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { card_id: cardId, member_id: memberId },
                "Member removed from card",
            ),
        );
});

// GET /api/v1/boards/:boardId/archived-cards
const getArchivedCards = asyncHandler(async (req, res) => {
    const { boardId } = req.params;

    const result = await query(
        `SELECT
       c.id,
       c.title,
       c.description,
       c.due_date,
       c.cover_color,
       c.updated_at,
       l.id    AS list_id,
       l.title AS list_title
     FROM cards c
     JOIN lists l ON l.id = c.list_id
     WHERE l.board_id = $1
       AND c.is_archived = TRUE
     ORDER BY c.updated_at DESC`,
        [boardId],
    );

    return res
        .status(200)
        .json(new ApiResponse(200, result.rows, "Archived cards fetched"));
});

// PUT /api/v1/cards/:cardId/restore
const restoreCard = asyncHandler(async (req, res) => {
    const { cardId } = req.params;

    // Check if the list the card belongs to is also archived
    // If list is archived, we cannot restore the card into it
    const cardResult = await query(
        `SELECT c.*, l.is_archived AS list_archived, l.title AS list_title
     FROM cards c
     JOIN lists l ON l.id = c.list_id
     WHERE c.id = $1 AND c.is_archived = TRUE`,
        [cardId],
    );

    if (!cardResult.rows[0]) {
        throw new ApiError(404, "Archived card not found");
    }

    if (cardResult.rows[0].list_archived) {
        throw new ApiError(
            400,
            `Cannot restore card - its list "${cardResult.rows[0].list_title}" is also archived. Restore the list first.`,
        );
    }

    const result = await query(
        `UPDATE cards
     SET is_archived = FALSE, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
        [cardId],
    );

    return res
        .status(200)
        .json(
            new ApiResponse(200, result.rows[0], "Card restored successfully"),
        );
});

export {
    createCard,
    getCardById,
    updateCard,
    moveCard,
    deleteCard,
    addLabel,
    removeLabel,
    assignMember,
    removeMember,
    restoreCard,
    getArchivedCards,
};
