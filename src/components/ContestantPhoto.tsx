import { useEffect, useId, useRef, useState } from "react"

import { supabase } from "../lib/supabase"

import { PHOTO_BUCKET } from "../lib/contestant-photo-storage"

import { validateContestantPhoto } from "../lib/contestant-photo"

export default function ContestantPhoto({
  path,
  name,
  large = false,
}: {
  path?: string | null
  name: string
  large?: boolean
}) {
  const [url, setUrl] = useState<string | null>(null)

  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true

    setUrl(null)

    setFailed(false)

    async function load() {
      if (!path || !supabase) return

      const { data, error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(path, 3600)

      if (active) {
        setUrl(data?.signedUrl ?? null)
        setFailed(Boolean(error))
      }
    }

    void load()

    const refresh = window.setInterval(
      () => {
        void load()
      },
      50 * 60 * 1000,
    )

    return () => {
      active = false
      window.clearInterval(refresh)
    }
  }, [path])

  const size = large ? "h-24 w-24" : "h-12 w-12"

  return url && !failed ? (
    <img
      src={url}
      alt={`Photo of ${name}`}
      onError={() => setFailed(true)}
      className={`${size} shrink-0 rounded-sm object-cover`}
    />
  ) : (
    <span
      role="img"
      aria-label={`No photo available for ${name}`}
      className={`${size} inline-flex shrink-0 items-center justify-center rounded-sm bg-[#e8edf2] text-sm font-semibold text-[#2a3441]`}
    >
      {name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "?"}
    </span>
  )
}

export function ContestantPhotoPicker({
  file,
  path,
  name,
  removed,
  disabled,
  onChange,
  onRemove,
  onChecking,
}: {
  file: File | null
  path?: string | null
  name: string
  removed: boolean
  disabled: boolean

  onChecking: (checking: boolean) => void

  onChange: (file: File) => void
  onRemove: () => void
}) {
  const id = useId()

  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
    }
  }, [])

  const [preview, setPreview] = useState<string | null>(null)

  const [error, setError] = useState("")

  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }

    const url = URL.createObjectURL(file)

    setPreview(url)

    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-xs font-semibold">
        Contestant photo{" "}
        <span className="font-normal text-[#61726a]">(optional)</span>
      </label>
      <div className="flex flex-wrap items-center gap-4">
        {preview ? (
          <img
            src={preview}
            alt="Selected photo preview"
            className="h-24 w-24 rounded-sm object-cover"
          />
        ) : (
          <ContestantPhoto path={removed ? null : path} name={name} large />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <input
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled || checking}
            aria-describedby={`${id}-help ${id}-error`}
            className="block w-full text-xs file:mr-3 file:border file:border-[#17251d]/30 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold hover:file:bg-[#e8edf2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a3441] disabled:opacity-50"
            onChange={async (event) => {
              const chosen = event.target.files?.[0]

              event.target.value = ""

              if (!chosen) return

              setError("")

              const validation = validateContestantPhoto(chosen)

              if (validation) {
                setError(validation)
                return
              }

              setChecking(true)
              onChecking(true)

              const url = URL.createObjectURL(chosen)

              try {
                const image = new Image()

                image.src = url

                await image.decode()

                if (mounted.current) onChange(chosen)
              } catch {
                if (mounted.current)
                  setError(
                    "This image could not be opened. Choose another photo.",
                  )
              } finally {
                URL.revokeObjectURL(url)
                if (mounted.current) {
                  setChecking(false)
                  onChecking(false)
                }
              }
            }}
          />
          <p id={`${id}-help`} className="text-xs text-[#61726a]">
            JPEG, PNG, or WebP. Maximum 5 MB.
            {checking ? " Checking image…" : ""}
          </p>
          {(file || (path && !removed)) && (
            <button
              type="button"
              disabled={disabled || checking}
              onClick={() => {
                setError("")
                onRemove()
              }}
              className="text-xs font-semibold text-[#70271f] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            >
              Remove photo
            </button>
          )}
        </div>
      </div>
      <p id={`${id}-error`} role="alert" className="text-xs text-[#70271f]">
        {error}
      </p>
    </div>
  )
}
