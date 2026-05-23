
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- MEMBERS
-- Pre-seeded, no registration. One acts as default logged-in user.

CREATE TABLE IF NOT EXISTS members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(150) UNIQUE NOT NULL,
    -- avatar_url from cloudinary if they upload, else we show initials
    avatar_url  VARCHAR(500),
    -- used as background color for avatar initials (like Trello)
    color       VARCHAR(7) NOT NULL DEFAULT '#0052CC',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- BOARDS
-- A board contains lists. Soft deleted via is_archived.

CREATE TABLE IF NOT EXISTS boards (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title            VARCHAR(200) NOT NULL,
    description      TEXT,
    background_color VARCHAR(7) DEFAULT '#0079BF',
    -- optional image as board background (URL or data URL)
    background_image TEXT,
    is_archived      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- BOARD MEMBERS
-- Which members have access to which boards

CREATE TABLE IF NOT EXISTS board_members (
    board_id   UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    -- 'admin' can delete board/lists, 'member' can only manage cards
    role       VARCHAR(20) NOT NULL DEFAULT 'member',
    joined_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (board_id, member_id)
);


-- LISTS
-- Ordered columns on a board. Soft deleted via is_archived.
-- position is FLOAT for fractional indexing.

CREATE TABLE IF NOT EXISTS lists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    -- float position enables drag-drop reorder with single DB update
    position    FLOAT NOT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- LABELS
-- Scoped to a board. Cards can have multiple labels.

CREATE TABLE IF NOT EXISTS labels (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id  UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name      VARCHAR(100),
    color     VARCHAR(7) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- CARDS
-- Live inside lists. Soft deleted via is_archived.
-- position is FLOAT for fractional indexing within a list.

CREATE TABLE IF NOT EXISTS cards (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id        UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    title          VARCHAR(500) NOT NULL,
    description    TEXT,
    position       FLOAT NOT NULL,
    due_date       TIMESTAMP WITH TIME ZONE,
    due_completed  BOOLEAN NOT NULL DEFAULT FALSE,
    -- cover is either a solid color or a cloudinary image url
    cover_color    VARCHAR(7),
    cover_image    VARCHAR(500),
    is_archived    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- CARD LABELS (junction)

CREATE TABLE IF NOT EXISTS card_labels (
    card_id   UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    label_id  UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (card_id, label_id)
);


-- CARD MEMBERS (junction)
-- Members assigned to a specific card

CREATE TABLE IF NOT EXISTS card_members (
    card_id   UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    PRIMARY KEY (card_id, member_id)
);


-- CHECKLISTS
-- A card can have multiple checklists

CREATE TABLE IF NOT EXISTS checklists (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id   UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    title     VARCHAR(200) NOT NULL DEFAULT 'Checklist',
    position  FLOAT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- CHECKLIST ITEMS
-- Individual to-do items inside a checklist

CREATE TABLE IF NOT EXISTS checklist_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id   UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
    title          VARCHAR(500) NOT NULL,
    is_completed   BOOLEAN NOT NULL DEFAULT FALSE,
    position       FLOAT NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- COMMENTS
-- Members can comment on cards. Hard deleted.

CREATE TABLE IF NOT EXISTS comments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id    UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    member_id  UUID REFERENCES members(id) ON DELETE SET NULL,
    content    TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ATTACHMENTS
-- Files uploaded to cards via Cloudinary

CREATE TABLE IF NOT EXISTS attachments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id     UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    member_id   UUID REFERENCES members(id) ON DELETE SET NULL,
    filename    VARCHAR(300) NOT NULL,
    file_url    VARCHAR(500) NOT NULL,
    file_size   INTEGER,
    mime_type   VARCHAR(100),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ACTIVITY LOG
-- Audit trail of all significant actions on a board

CREATE TABLE IF NOT EXISTS activities (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id   UUID REFERENCES boards(id) ON DELETE CASCADE,
    card_id    UUID REFERENCES cards(id) ON DELETE CASCADE,
    member_id  UUID REFERENCES members(id) ON DELETE SET NULL,
    -- action strings like 'created_card', 'moved_card', 'added_label'
    action     VARCHAR(100) NOT NULL,
    -- flexible JSON to store context: {from_list: 'Todo', to_list: 'Done'}
    data       JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- INDEXES FOR QUERY PERFORMANCE


-- Most common: fetch all lists for a board
CREATE INDEX IF NOT EXISTS idx_lists_board_id 
    ON lists(board_id) WHERE is_archived = FALSE;

-- Most common: fetch all cards for a list
CREATE INDEX IF NOT EXISTS idx_cards_list_id 
    ON cards(list_id) WHERE is_archived = FALSE;

-- Search cards by title (ILIKE queries)
CREATE INDEX IF NOT EXISTS idx_cards_title 
    ON cards USING gin(to_tsvector('english', title));

-- Filter cards by due date
CREATE INDEX IF NOT EXISTS idx_cards_due_date 
    ON cards(due_date) WHERE due_date IS NOT NULL;

-- Activity log lookups
CREATE INDEX IF NOT EXISTS idx_activities_board_id 
    ON activities(board_id);

CREATE INDEX IF NOT EXISTS idx_activities_card_id 
    ON activities(card_id);