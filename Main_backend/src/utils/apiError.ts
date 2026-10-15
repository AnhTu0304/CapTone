export class ApiError extends Error {
  public statusCode: number;
  public errors?: unknown;

  constructor(statusCode: number, message: string, errors?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  public static badRequest(message: string, errors?: unknown): ApiError {
    return new ApiError(400, message, errors);
  }

  public static unauthorized(message: string = 'Unauthorized'): ApiError {
    return new ApiError(401, message);
  }

  public static forbidden(message: string = 'Forbidden'): ApiError {
    return new ApiError(403, message);
  }

  public static notFound(message: string = 'Not found'): ApiError {
    return new ApiError(404, message);
  }

  public static internal(message: string = 'Internal server error'): ApiError {
    return new ApiError(500, message);
  }
}
