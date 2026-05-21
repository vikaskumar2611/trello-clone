export const DB_NAME = "trello_clone";

// Fractional indexing gap between positions
// Cards and lists use float positions like 1000, 2000, 3000
// When inserting between: new = (prev + next) / 2
export const POSITION_GAP = 1000;

// This is the default "logged in" member
// This UUID is manually set and matches what seed.js inserts for Alice
// No auth in this app - all actions are attributed to this member
export const DEFAULT_MEMBER_ID = "a0000000-0000-0000-0000-000000000001";
export const DEFAULT_MEMBER_EMAIL = "alice@example.com";

// Trello's standard label colors - board gets these by default on creation
export const DEFAULT_LABEL_COLORS = [
    { name: "Bug", color: "#EB5A46" },
    { name: "Feature", color: "#61BD4F" },
    { name: "Enhancement", color: "#F2D600" },
    { name: "Documentation", color: "#C377E0" },
    { name: "High Priority", color: "#FF9F1A" },
    { name: "Design", color: "#0079BF" },
];

// Default board background color
export const DEFAULT_BOARD_BG = "#0079BF";

// File upload limits
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Allowed MIME types for card attachments
export const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
