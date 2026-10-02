export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
export function validateContestantPhoto(file: {
  type: string
  size: number
}): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return "Choose a JPEG, PNG, or WebP image."
  if (file.size === 0) return "This file is empty. Choose another photo."
  if (file.size > MAX_PHOTO_BYTES) return "Choose a photo no larger than 5 MB."
  return null
}
