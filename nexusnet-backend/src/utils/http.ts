export type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  message: string;
  pagination?: PaginationMeta;
};

export type PaginationMeta = {
  nextCursor: string | null;
  hasMore: boolean;
};

export function successResponse<T>(data: T, message = 'OK', pagination?: PaginationMeta): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    ...(pagination ? { pagination } : {})
  };
}

export function errorResponse(message: string): ApiResponse<null> {
  return {
    success: false,
    data: null,
    message
  };
}
