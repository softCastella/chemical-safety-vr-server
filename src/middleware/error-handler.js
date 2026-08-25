import { AppError } from "../lib/app-error.js";

export function notFoundHandler(request, response) {
  response.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route not found: ${request.method} ${request.originalUrl}`,
    },
  });
}

export function errorHandler(error, _request, response, _next) {
  if (error instanceof AppError) {
    const body = {
      error: {
        code: error.code,
        message: error.message,
      },
    };

    if (error.details !== undefined) {
      body.error.details = error.details;
    }

    response.status(error.statusCode).json(body);
    return;
  }

  if (error?.code === "ER_DUP_ENTRY") {
    response.status(409).json({
      error: {
        code: "CONFLICT",
        message: "A user with the same identity already exists.",
      },
    });
    return;
  }

  if (error instanceof SyntaxError && error?.status === 400) {
    response.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "The request body contains invalid JSON.",
      },
    });
    return;
  }

  console.error("Unhandled request error.", error);
  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "The server could not complete the request.",
    },
  });
}
