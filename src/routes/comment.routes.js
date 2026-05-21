import { Router } from "express";
import {
    updateComment,
    deleteComment,
} from "../controllers/comment.controller.js";

const router = Router();

router.route("/:commentId").put(updateComment).delete(deleteComment);

export default router;
