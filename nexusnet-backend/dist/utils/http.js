"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
function successResponse(data, message = 'OK', pagination) {
    return {
        success: true,
        data,
        message,
        ...(pagination ? { pagination } : {})
    };
}
function errorResponse(message) {
    return {
        success: false,
        data: null,
        message
    };
}
