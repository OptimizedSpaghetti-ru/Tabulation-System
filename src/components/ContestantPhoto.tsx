import { useEffect, useId, useRef, useState } from "react"

import { supabase } from "../lib/supabase"

import { PHOTO_BUCKET } from "../lib/contestant-photo-storage"

import { validateContestantPhoto } from "../lib/contestant-photo"

function PhotoViewer({
  src,
  name,
  size,
  onError,
}: {
  src: string
  name: string
  size: string
  onError?: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        aria-label={`Enlarge photo of ${name}`}
        aria-haspopup="dialog"
        className={`${size} shrink-0 overflow-hidden rounded-sm cursor-zoom-in hover:opacity-90`}
        onClick={() => {
          dialog.current?.showModal()
          setOpen(true)
        }}
      >
        <img
          src={src}
          alt={`Photo of ${name}`}
          onError={onError}
          className="h-full w-full object-cover"
        />
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="contestant-photo-viewer fixed m-auto w-fit max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-auto rounded-lg bg-white p-0 text-[#2a3441] shadow-xl"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return
          const bounds = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          ) {
            dialog.current?.close()
          }
        }}
      >
        <>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <h2
                id={titleId}
                className="min-w-0 break-words text-sm font-semibold"
              >
                {name}
              </h2>
              <button
                type="button"
                autoFocus
                aria-label="Close enlarged photo"
                onClick={() => dialog.current?.close()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm hover:bg-[#e8edf2]"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <img
              src={src}
              alt={`Enlarged photo of ${name}`}
              className="block max-h-[calc(100dvh-7rem)] max-w-full w-auto mx-auto object-contain"
            />
        </>
      </dialog>
    </>
  )
}

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
    <PhotoViewer
      src={url}
      name={name}
      onError={() => setFailed(true)}
      size={size}
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
          <PhotoViewer
            src={preview}
            name={name || "Contestant"}
            size="h-24 w-24"
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
