import { Router, type IRouter } from "express";

const router: IRouter = Router();

const SUPPORTED_MODELS = [
  {
    id: "claude-opus-4-6",
    object: "model",
    created: 1714000000,
    owned_by: "anthropic",
  },
  {
    id: "claude-opus-4-5",
    object: "model",
    created: 1710000000,
    owned_by: "anthropic",
  },
  {
    id: "claude-opus-4-1",
    object: "model",
    created: 1706000000,
    owned_by: "anthropic",
  },
  {
    id: "claude-sonnet-4-6",
    object: "model",
    created: 1714000000,
    owned_by: "anthropic",
  },
  {
    id: "claude-sonnet-4-5",
    object: "model",
    created: 1710000000,
    owned_by: "anthropic",
  },
  {
    id: "claude-haiku-4-5",
    object: "model",
    created: 1710000000,
    owned_by: "anthropic",
  },
  {
    id: "gpt-5.2",
    object: "model",
    created: 1714000000,
    owned_by: "openai",
  },
  {
    id: "gpt-5.1",
    object: "model",
    created: 1712000000,
    owned_by: "openai",
  },
  {
    id: "gpt-5",
    object: "model",
    created: 1710000000,
    owned_by: "openai",
  },
  {
    id: "gpt-5-mini",
    object: "model",
    created: 1710000000,
    owned_by: "openai",
  },
  {
    id: "gpt-5-nano",
    object: "model",
    created: 1710000000,
    owned_by: "openai",
  },
  {
    id: "gpt-4o",
    object: "model",
    created: 1700000000,
    owned_by: "openai",
  },
  {
    id: "gpt-4o-mini",
    object: "model",
    created: 1700000000,
    owned_by: "openai",
  },
  {
    id: "o4-mini",
    object: "model",
    created: 1714000000,
    owned_by: "openai",
  },
  {
    id: "o3",
    object: "model",
    created: 1712000000,
    owned_by: "openai",
  },
];

router.get("/models", (_req, res) => {
  res.json({
    object: "list",
    data: SUPPORTED_MODELS,
  });
});

router.get("/models/:model", (req, res) => {
  const model = SUPPORTED_MODELS.find((m) => m.id === req.params["model"]);
  if (!model) {
    res.status(404).json({
      error: {
        message: `The model '${req.params["model"]}' does not exist`,
        type: "invalid_request_error",
        param: "model",
        code: "model_not_found",
      },
    });
    return;
  }
  res.json(model);
});

export default router;
