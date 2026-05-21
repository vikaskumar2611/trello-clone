import { Router } from "express";
import { updateLabel, deleteLabel } from "../controllers/label.controller.js";

const router = Router();

router.route("/:labelId").put(updateLabel).delete(deleteLabel);

export default router;
