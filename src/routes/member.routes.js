import { Router } from "express";
import { getAllMembers } from "../controllers/member.controller.js";

const router = Router();

router.route("/").get(getAllMembers);

export default router;
