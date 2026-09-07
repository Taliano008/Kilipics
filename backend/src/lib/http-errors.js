// One error shape everywhere: { error, message, fields? }. Handlers throw
// ApiError (or use the constructors below); the central setErrorHandler in
// app.js serializes it. Keeps route handlers free of reply.code().send()
// boilerplate and guarantees the envelope never drifts.
export class ApiError extends Error {
  constructor(statusCode, code, message, fields) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
  }
}

export const badRequest = (code, message, fields) => new ApiError(400, code, message, fields);
export const unauthorized = (message = "Invalid credentials.", code = "unauthorized") =>
  new ApiError(401, code, message);
export const forbidden = (message = "You do not have access to this resource.", code = "forbidden") =>
  new ApiError(403, code, message);
export const notFound = (code, message) => new ApiError(404, code, message);
export const conflict = (code, message) => new ApiError(409, code, message);
export const unprocessable = (code, message, fields) => new ApiError(422, code, message, fields);
