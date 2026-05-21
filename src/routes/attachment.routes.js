import { Router } from "express";
import { deleteAttachment } from "../controllers/attachment.controller.js";

const router = Router();

router.route("/:attachmentId").delete(deleteAttachment);

export default router;
