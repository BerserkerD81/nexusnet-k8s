"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryWithBackoff = retryWithBackoff;
async function retryWithBackoff(operation, attempts = 3) {
    let lastError;
    for (let index = 0; index < attempts; index += 1) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, 2 ** index * 100));
        }
    }
    throw lastError instanceof Error ? lastError : new Error('Operation failed');
}
