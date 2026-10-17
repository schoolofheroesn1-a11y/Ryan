export class AppError extends Error {}

export class ForbiddenError extends AppError {
  constructor(message = "Недостаточно прав для этого действия") {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Не найдено") {
    super(message);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public fieldErrors: Record<string, string | undefined> = {},
  ) {
    super(message);
  }
}
