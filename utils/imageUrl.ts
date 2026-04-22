/**
 * Image URL Helper Utility
 * Constructs full URLs for images stored in the backend uploads folder
 */

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8000";

/**
 * Constructs a full image URL from a filename or partial path
 * @param filename - The image filename or partial path (e.g., "profileImage-123456.jpg" or "/uploads/profileImage-123456.jpg")
 * @returns Full image URL or null if invalid
 */
export const getImageUrl = (
  filename: string | null | undefined,
): string | null => {
  if (!filename || typeof filename !== "string") {
    return null;
  }

  // If it's already a full URL, return as-is
  if (filename.startsWith("http") || filename.startsWith("https")) {
    return filename;
  }

  // If it's a data URI, return as-is
  if (filename.startsWith("data:")) {
    return filename;
  }

  // If it's a relative path, prepend API base URL
  if (filename.startsWith("/uploads/")) {
    return `${API_BASE_URL}${filename}`;
  }

  // If it's just a filename, construct the full path
  return `${API_BASE_URL}/uploads/${filename}`;
};
