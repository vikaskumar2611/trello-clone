import dotenv from "dotenv";
dotenv.config();

import pg from "pg";
import { getInitialPosition } from "./src/utils/position.js";
import { DEFAULT_LABEL_COLORS, DEFAULT_MEMBER_ID } from "./src/constants.js";

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
        process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : false,
});

async function seed() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        console.log("🌱 Starting seed...");

        //  CLEAR EXISTING DATA (order matters for FK constraints)
        await client.query("DELETE FROM activities");
        await client.query("DELETE FROM attachments");
        await client.query("DELETE FROM comments");
        await client.query("DELETE FROM checklist_items");
        await client.query("DELETE FROM checklists");
        await client.query("DELETE FROM card_members");
        await client.query("DELETE FROM card_labels");
        await client.query("DELETE FROM cards");
        await client.query("DELETE FROM labels");
        await client.query("DELETE FROM lists");
        await client.query("DELETE FROM board_members");
        await client.query("DELETE FROM boards");
        await client.query("DELETE FROM members");
        console.log("🗑️  Cleared existing data");

        //  MEMBERS
        // Alice's ID is fixed - matches DEFAULT_MEMBER_ID in constants.js
        // She is the "logged in" user for all operations
        const membersData = [
            {
                id: DEFAULT_MEMBER_ID,
                name: "Alice Johnson",
                email: "alice@example.com",
                color: "#0052CC",
            },
            {
                id: "b0000000-0000-0000-0000-000000000002",
                name: "Bob Smith",
                email: "bob@example.com",
                color: "#00875A",
            },
            {
                id: "c0000000-0000-0000-0000-000000000003",
                name: "Carol White",
                email: "carol@example.com",
                color: "#DE350B",
            },
            {
                id: "d0000000-0000-0000-0000-000000000004",
                name: "David Lee",
                email: "david@example.com",
                color: "#6554C0",
            },
            {
                id: "e0000000-0000-0000-0000-000000000005",
                name: "Emma Davis",
                email: "emma@example.com",
                color: "#FF8B00",
            },
        ];

        for (const m of membersData) {
            await client.query(
                `INSERT INTO members (id, name, email, color) VALUES ($1, $2, $3, $4)`,
                [m.id, m.name, m.email, m.color],
            );
        }
        console.log(`✅ Seeded ${membersData.length} members`);

        //  BOARD
        const boardId = "f0000000-0000-0000-0000-000000000001";
        await client.query(
            `INSERT INTO boards (id, title, description, background_color)
       VALUES ($1, $2, $3, $4)`,
            [
                boardId,
                "Product Development",
                "Main board for tracking product development tasks",
                "#0079BF",
            ],
        );
        console.log("✅ Seeded board");

        //  BOARD MEMBERS
        for (let i = 0; i < membersData.length; i++) {
            await client.query(
                `INSERT INTO board_members (board_id, member_id, role) VALUES ($1, $2, $3)`,
                [
                    boardId,
                    membersData[i].id,
                    i === 0 ? "admin" : "member", // Alice is admin
                ],
            );
        }
        console.log("✅ Seeded board members");

        //  LABELS
        const labelIds = [];
        for (let i = 0; i < DEFAULT_LABEL_COLORS.length; i++) {
            const labelId = `10000000-0000-0000-0000-00000000000${i + 1}`;
            await client.query(
                `INSERT INTO labels (id, board_id, name, color) VALUES ($1, $2, $3, $4)`,
                [
                    labelId,
                    boardId,
                    DEFAULT_LABEL_COLORS[i].name,
                    DEFAULT_LABEL_COLORS[i].color,
                ],
            );
            labelIds.push(labelId);
        }
        console.log("✅ Seeded labels");

        //  LISTS
        const listsData = [
            { id: "20000000-0000-0000-0000-000000000001", title: "Backlog" },
            {
                id: "20000000-0000-0000-0000-000000000002",
                title: "In Progress",
            },
            { id: "20000000-0000-0000-0000-000000000003", title: "In Review" },
            { id: "20000000-0000-0000-0000-000000000004", title: "Done" },
        ];

        for (let i = 0; i < listsData.length; i++) {
            await client.query(
                `INSERT INTO lists (id, board_id, title, position) VALUES ($1, $2, $3, $4)`,
                [
                    listsData[i].id,
                    boardId,
                    listsData[i].title,
                    getInitialPosition(i),
                ],
            );
        }
        console.log("✅ Seeded lists");

        // CARDS
        const [backlogId, inProgressId, inReviewId, doneId] = listsData.map(
            (l) => l.id,
        );

        const cardsData = [
            // Backlog
            {
                id: "30000000-0000-0000-0000-000000000001",
                list_id: backlogId,
                title: "User authentication system",
                description:
                    "Implement JWT-based authentication with refresh tokens",
                position: getInitialPosition(0),
                due_date: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                ).toISOString(),
                cover_color: null,
            },
            {
                id: "30000000-0000-0000-0000-000000000002",
                list_id: backlogId,
                title: "Design landing page mockups",
                description: "Create wireframes and high-fidelity designs",
                position: getInitialPosition(1),
                due_date: null,
                cover_color: "#0079BF",
            },
            {
                id: "30000000-0000-0000-0000-000000000003",
                list_id: backlogId,
                title: "Set up CI/CD pipeline",
                description: null,
                position: getInitialPosition(2),
                due_date: new Date(
                    Date.now() - 2 * 24 * 60 * 60 * 1000,
                ).toISOString(), // overdue
                cover_color: null,
            },
            // In Progress
            {
                id: "30000000-0000-0000-0000-000000000004",
                list_id: inProgressId,
                title: "Build REST API endpoints",
                description: "Create CRUD endpoints for all resources",
                position: getInitialPosition(0),
                due_date: null,
                cover_color: null,
            },
            {
                id: "30000000-0000-0000-0000-000000000005",
                list_id: inProgressId,
                title: "Database schema design",
                description: null,
                position: getInitialPosition(1),
                due_date: new Date(
                    Date.now() + 3 * 24 * 60 * 60 * 1000,
                ).toISOString(),
                cover_color: null,
            },
            // In Review
            {
                id: "30000000-0000-0000-0000-000000000006",
                list_id: inReviewId,
                title: "Code review for auth module",
                description: "Review PR #42 - authentication implementation",
                position: getInitialPosition(0),
                due_date: null,
                cover_color: null,
            },
            // Done
            {
                id: "30000000-0000-0000-0000-000000000007",
                list_id: doneId,
                title: "Project setup and configuration",
                description: null,
                position: getInitialPosition(0),
                due_date: null,
                due_completed: true,
                cover_color: null,
            },
        ];

        for (const card of cardsData) {
            await client.query(
                `INSERT INTO cards 
           (id, list_id, title, description, position, due_date, due_completed, cover_color)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    card.id,
                    card.list_id,
                    card.title,
                    card.description || null,
                    card.position,
                    card.due_date || null,
                    card.due_completed || false,
                    card.cover_color || null,
                ],
            );
        }
        console.log("✅ Seeded cards");

        // CARD LABELS
        const cardLabelMap = [
            // [card_id, label_index]  label index matches DEFAULT_LABEL_COLORS
            ["30000000-0000-0000-0000-000000000001", 1], // auth -> Feature
            ["30000000-0000-0000-0000-000000000001", 4], // auth -> High Priority
            ["30000000-0000-0000-0000-000000000002", 5], // design -> Design
            ["30000000-0000-0000-0000-000000000003", 4], // cicd -> High Priority
            ["30000000-0000-0000-0000-000000000004", 1], // api -> Feature
            ["30000000-0000-0000-0000-000000000005", 3], // schema -> Documentation
        ];

        for (const [cardId, labelIndex] of cardLabelMap) {
            await client.query(
                `INSERT INTO card_labels (card_id, label_id) VALUES ($1, $2)`,
                [cardId, labelIds[labelIndex]],
            );
        }
        console.log("✅ Seeded card labels");

        //  CARD MEMBERS
        const cardMemberMap = [
            ["30000000-0000-0000-0000-000000000001", DEFAULT_MEMBER_ID], // auth -> Alice
            [
                "30000000-0000-0000-0000-000000000001",
                "b0000000-0000-0000-0000-000000000002",
            ], // auth -> Bob
            [
                "30000000-0000-0000-0000-000000000002",
                "c0000000-0000-0000-0000-000000000003",
            ], // design -> Carol
            [
                "30000000-0000-0000-0000-000000000004",
                "d0000000-0000-0000-0000-000000000004",
            ], // api -> David
            [
                "30000000-0000-0000-0000-000000000005",
                "e0000000-0000-0000-0000-000000000005",
            ], // schema -> Emma
        ];

        for (const [cardId, memberId] of cardMemberMap) {
            await client.query(
                `INSERT INTO card_members (card_id, member_id) VALUES ($1, $2)`,
                [cardId, memberId],
            );
        }
        console.log("✅ Seeded card members");

        // CHECKLISTS
        const checklist1Id = "40000000-0000-0000-0000-000000000001";
        const checklist2Id = "40000000-0000-0000-0000-000000000002";

        await client.query(
            `INSERT INTO checklists (id, card_id, title, position) VALUES ($1, $2, $3, $4)`,
            [
                checklist1Id,
                "30000000-0000-0000-0000-000000000001",
                "Implementation Steps",
                getInitialPosition(0),
            ],
        );

        await client.query(
            `INSERT INTO checklists (id, card_id, title, position) VALUES ($1, $2, $3, $4)`,
            [
                checklist2Id,
                "30000000-0000-0000-0000-000000000004",
                "API Endpoints",
                getInitialPosition(0),
            ],
        );

        //  CHECKLIST ITEMS
        const checklistItems1 = [
            ["Set up user model", true],
            ["Create registration endpoint", true],
            ["Create login endpoint", false],
            ["Implement JWT tokens", false],
            ["Add refresh token logic", false],
            ["Write unit tests", false],
        ];

        for (let i = 0; i < checklistItems1.length; i++) {
            await client.query(
                `INSERT INTO checklist_items (checklist_id, title, is_completed, position)
         VALUES ($1, $2, $3, $4)`,
                [
                    checklist1Id,
                    checklistItems1[i][0],
                    checklistItems1[i][1],
                    getInitialPosition(i),
                ],
            );
        }

        const checklistItems2 = [
            ["GET /boards", true],
            ["POST /boards", true],
            ["GET /boards/:id", false],
            ["POST /lists", false],
            ["POST /cards", false],
        ];

        for (let i = 0; i < checklistItems2.length; i++) {
            await client.query(
                `INSERT INTO checklist_items (checklist_id, title, is_completed, position)
         VALUES ($1, $2, $3, $4)`,
                [
                    checklist2Id,
                    checklistItems2[i][0],
                    checklistItems2[i][1],
                    getInitialPosition(i),
                ],
            );
        }
        console.log("✅ Seeded checklists and items");

        // ---- COMMENTS ----
        await client.query(
            `INSERT INTO comments (card_id, member_id, content) VALUES ($1, $2, $3)`,
            [
                "30000000-0000-0000-0000-000000000001",
                DEFAULT_MEMBER_ID,
                "Starting work on this today!",
            ],
        );
        await client.query(
            `INSERT INTO comments (card_id, member_id, content) VALUES ($1, $2, $3)`,
            [
                "30000000-0000-0000-0000-000000000001",
                "b0000000-0000-0000-0000-000000000002",
                "I can help with the JWT implementation.",
            ],
        );
        console.log("✅ Seeded comments");

        await client.query("COMMIT");
        console.log("\n🎉 Database seeded successfully!");
        console.log(`\nDefault user: Alice Johnson (${DEFAULT_MEMBER_ID})`);
        console.log(`Board ID: ${boardId}`);
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ Seed failed:", err.message);
        console.error(err);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
