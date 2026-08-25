import { Router } from "express";

import { createUserService } from "./user-service.js";

export function createUserRouter({ repository }) {
  const router = Router();
  const service = createUserService({ repository });

  router.post("/", async (request, response) => {
    const user = await service.create(request.body);
    response.location(`/api/users/${user.id}`).status(201).json({ data: user });
  });

  router.get("/", async (request, response) => {
    response.status(200).json(await service.list(request.query));
  });

  router.get("/:userId", async (request, response) => {
    const user = await service.get(request.params.userId);
    response.status(200).json({ data: user });
  });

  router.patch("/:userId", async (request, response) => {
    const user = await service.update(request.params.userId, request.body);
    response.status(200).json({ data: user });
  });

  router.delete("/:userId", async (request, response) => {
    await service.delete(request.params.userId);
    response.status(204).end();
  });

  return router;
}
