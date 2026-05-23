import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";

const app = express();

// Security headers - helmet sets safe HTTP headers automatically
app.use(helmet());

// Request logging - only in development (same use case as your YouTube clone)
if (process.env.NODE_ENV === "development") {
    app.use(morgan("dev"));
}

// CORS - allow frontend to talk to backend
app.use(
    cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true,
    }),
);

// Parse JSON bodies
app.use(express.json({ limit: "10mb" }));

// Parse URL-encoded bodies (form submissions)
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files from public/ (temp uploads etc.)
app.use(express.static("public"));

// Parse cookies
app.use(cookieParser());

// ROUTES

import boardRouter from "./routes/board.routes.js";
import listRouter from "./routes/list.routes.js";
import cardRouter from "./routes/card.routes.js";
import labelRouter from "./routes/label.routes.js";
import memberRouter from "./routes/member.routes.js";
import checklistRouter from "./routes/checklist.routes.js";
import commentRouter from "./routes/comment.routes.js";
import attachmentRouter from "./routes/attachment.routes.js";
import searchRouter from "./routes/search.routes.js";

app.use("/api/v1/boards", boardRouter);
app.use("/api/v1/lists", listRouter);
app.use("/api/v1/cards", cardRouter);
app.use("/api/v1/labels", labelRouter);
app.use("/api/v1/members", memberRouter);
app.use("/api/v1/checklists", checklistRouter);
app.use("/api/v1/comments", commentRouter);
app.use("/api/v1/attachments", attachmentRouter);
app.use("/api/v1/search", searchRouter);

// Health check endpoint
app.get("/api/v1/health", (req, res) => {
    res.json({ success: true, message: "Server is running" });
});

// GLOBAL ERROR HANDLER - must be mounted AFTER all routes

import { errorHandler } from "./middlewares/errorHandler.middleware.js";
app.use(errorHandler);

export { app };
