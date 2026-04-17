import { Router, type IRouter } from "express";
import modelsRouter from "./models";
import chatCompletionsRouter from "./chat-completions";

const router: IRouter = Router();

router.use(modelsRouter);
router.use(chatCompletionsRouter);

export default router;
