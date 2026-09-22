/**
 * Helper utility to generate unique, professional Order Numbers for RizeX.
 * Format: RZ-YYMM-XXXX (e.g., RZ-2609-4821)
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // e.g., '26'
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // e.g., '09'
  const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4-digit random number (1000-9999)

  return `RZ-${year}${month}-${randomSuffix}`;
}
