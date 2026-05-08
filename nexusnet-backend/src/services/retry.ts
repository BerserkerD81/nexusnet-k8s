export async function retryWithBackoff<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 2 ** index * 100));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Operation failed');
}
