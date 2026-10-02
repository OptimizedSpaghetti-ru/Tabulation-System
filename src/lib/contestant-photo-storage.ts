import { requireSupabase } from "./supabase"
import { validateContestantPhoto } from "./contestant-photo"
export const PHOTO_BUCKET = "contestant-photos"
export async function uploadContestantPhoto(
  contestantId: string,
  file: File,
): Promise<string> {
  const validation = validateContestantPhoto(file)
  if (validation) throw new Error(validation)
  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[file.type]
  const path = `${contestantId}/${crypto.randomUUID()}.${extension}`
  const { error } = await requireSupabase()
    .storage.from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(`Photo upload failed: ${error.message}`)
  return path
}
export async function deleteContestantPhoto(path: string) {
  const { error } = await requireSupabase()
    .storage.from(PHOTO_BUCKET)
    .remove([path])
  if (error) throw new Error(`Photo cleanup failed: ${error.message}`)
}
