import AnimatedPresence from "./AnimatedPresence"
import { getDefaultEventId } from "../lib/default-event"
import { isCcsPageant, pageantContestantError } from "../lib/pageant-contestants"
import { FormEvent, useEffect, useState } from "react"

import { supabase } from "../lib/supabase"

import ContestantPhoto, { ContestantPhotoPicker } from "./ContestantPhoto"

import {
  uploadContestantPhoto,
  deleteContestantPhoto,
} from "../lib/contestant-photo-storage"

type Contestant = {
  id: string

  contestant_number: string
  gender: string | null

  full_name: string

  photo_path: string | null

  student_id: string | null

  course: string

  year_level: string | null

  section: string | null

  status: string

  event_contestants?: { event_id: string; events?: { name: string } }[]
}

type EventItem = { id: string; name: string }

export default function ContestantsManager({ isAdmin }: { isAdmin: boolean }) {
  const [contestants, setContestants] = useState<Contestant[]>([])

  const [events, setEvents] = useState<EventItem[]>([])

  const [selectedEventId, setSelectedEventId] = useState<string>("")

  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)

  const [error, setError] = useState("")

  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const [photoRemoved, setPhotoRemoved] = useState(false)

  const [photoChecking, setPhotoChecking] = useState(false)

  const [editingPhoto, setEditingPhoto] = useState<Contestant | null>(null)
  const [editGender, setEditGender] = useState("")
  const [editNumber, setEditNumber] = useState("")

  const [saving, setSaving] = useState(false)

  const [notice, setNotice] = useState("")

  const [form, setForm] = useState({
    gender: "",
    contestant_number: "",

    full_name: "",

    student_id: "",

    course: "BS Information Technology",

    year_level: "3rd Year",

    section: "BSIT 3-Y1-1",

    event_id: "",
  })

  async function loadData() {
    if (!supabase) return

    setLoading(true)

    // Load events

    const { data: evData } = await supabase

      .from("events")

      .select("id, name")

      .order("name")

    if (evData) {
      setEvents(evData)

      if (!selectedEventId && evData.length > 0) {
        setSelectedEventId(getDefaultEventId(evData))
        setForm((prev) => ({ ...prev, event_id: getDefaultEventId(evData) }))
      }
    }

    // Load contestants

    const { data: cData, error: loadError } = await supabase

      .from("contestants")

      .select(
        "id, contestant_number, gender, full_name, student_id, course, year_level, section, status, photo_path, event_contestants(event_id, events(name))",
      )

      .order("contestant_number")

    if (loadError) setNotice(`Could not load contestants: ${loadError.message}`)

    if (cData) {
      setContestants(cData as unknown as Contestant[])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const formEvent = events.find(event => event.id === form.event_id)
  const formIsPageant = isCcsPageant(formEvent?.name ?? "")
  const editingPageantEvent = editingPhoto?.event_contestants?.find(ec =>
    isCcsPageant(ec.events?.name ?? events.find(event => event.id === ec.event_id)?.name ?? ""),
  )
  function contestantsForEvent(eventId: string) {
    return contestants.filter(c => c.event_contestants?.some(ec => ec.event_id === eventId))
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()

    setError("")

    if (!supabase || !isAdmin || saving || photoChecking) return

    if (!form.contestant_number.trim()) {
      setError("Contestant number is required.")

      return
    }

    if (form.full_name.trim().length < 2) {
      setError("Contestant name must have at least 2 characters.")

      return
    }

    if (!form.event_id) {
      setError("Please select an event for this contestant.")

      return
    }

    const genderError = pageantContestantError(formEvent?.name ?? "", form.gender, form.contestant_number, contestantsForEvent(form.event_id))
    if (genderError) {
      setError(genderError)
      return
    }

    setSaving(true)

    setNotice("")

    const id = crypto.randomUUID()

    let photoPath: string | null = null

    let created = false

    try {
      if (photoFile) photoPath = await uploadContestantPhoto(id, photoFile)

      const { error: cErr } = await supabase.from("contestants").insert({
        id,

        contestant_number: form.contestant_number.trim(),
        ...(formIsPageant ? { gender: form.gender } : {}),

        full_name: form.full_name.trim(),

        student_id: form.student_id.trim() || null,

        course: form.course.trim(),

        year_level: form.year_level || null,

        section: form.section.trim() || null,

        status: "registered",

        photo_path: photoPath,
      })

      if (cErr) throw new Error(cErr.message)

      created = true

      const { error: ecErr } = await supabase.from("event_contestants").insert({
        event_id: form.event_id,

        contestant_id: id,

        registration_status: "registered",
      })

      if (ecErr) throw new Error(ecErr.code === "23505" && ecErr.message.includes("event_contestants_pageant_number_gender")
        ? "That contestant number is already assigned to another contestant of the same gender in this competition. Choose another number."
        : ecErr.message)
    } catch (failure) {
      let message =
        failure instanceof Error
          ? failure.message
          : "Could not save contestant. Please try again."

      let rolledBack = !created

      if (created) {
        const { error: rollbackError } = await supabase
          .from("contestants")
          .delete()
          .eq("id", id)

        rolledBack = !rollbackError

        if (rollbackError) {
          message = `Contestant was saved, but the competition assignment failed: ${message}. Contact an administrator to complete the assignment.`

          setShowModal(false)

          setNotice(message)

          void loadData()
        }
      }

      if (photoPath && rolledBack) {
        try {
          await deleteContestantPhoto(photoPath)
        } catch {
          message += " The unused uploaded photo could not be removed."
        }
      }

      setError(message)

      setSaving(false)

      return
    }

    setSaving(false)

    setPhotoFile(null)

    setPhotoRemoved(false)

    setShowModal(false)

    setForm({
      gender: "",
      contestant_number: "",

      full_name: "",

      student_id: "",

      course: "BS Information Technology",

      year_level: "3rd Year",

      section: "BSIT 3-Y1-1",

      event_id: getDefaultEventId(events),
    })

    loadData()
  }

  async function handlePhotoSave(e: FormEvent) {
    e.preventDefault()

    if (!supabase || !editingPhoto || !isAdmin || saving || photoChecking)
      return

    if (editingPageantEvent) {
      if (!editNumber.trim()) {
        setError("Contestant number is required.")
        return
      }
      const genderError = pageantContestantError("Mr. and Ms. CCS", editGender, editNumber, contestantsForEvent(editingPageantEvent.event_id), editingPhoto.id)
      if (genderError) {
        setError(genderError)
        return
      }
    }

    if (!photoFile && !photoRemoved && !editingPageantEvent) {
      setEditingPhoto(null)
      return
    }

    setSaving(true)

    setError("")

    setNotice("")

    let uploadedPath: string | null = null

    try {
      if (photoFile)
        uploadedPath = await uploadContestantPhoto(editingPhoto.id, photoFile)

      const { error: updateError } = await supabase
        .from("contestants")

        .update({
          ...(photoFile || photoRemoved ? { photo_path: uploadedPath } : {}),
          ...(editingPageantEvent ? { gender: editGender, contestant_number: editNumber.trim() } : {}),
        })
        .eq("id", editingPhoto.id)
        .select("id")
        .single()

      if (updateError) throw new Error(updateError.code === "23505" && updateError.message.includes("event_contestants_pageant_number_gender")
        ? "That contestant number is already assigned to another contestant of the same gender in this competition. Choose another number."
        : updateError.message)
    } catch (failure) {
      let message =
        failure instanceof Error
          ? failure.message
          : "Could not save contestant. Please try again."

      if (uploadedPath) {
        try {
          await deleteContestantPhoto(uploadedPath)
        } catch {
          message += " The unused uploaded photo could not be removed."
        }
      }

      setError(message)

      setSaving(false)

      return
    }

    if (editingPhoto.photo_path && (photoFile || photoRemoved)) {
      try {
        await deleteContestantPhoto(editingPhoto.photo_path)
      } catch {
        setNotice(
          "Photo updated, but the previous stored photo could not be removed.",
        )
      }
    }

    setEditingPhoto(null)

    setPhotoFile(null)

    setPhotoRemoved(false)

    setSaving(false)

    void loadData()
  }

  const filtered = selectedEventId
    ? contestants.filter((c) =>
        c.event_contestants?.some((ec) => ec.event_id === selectedEventId),
      )
    : contestants
  const selectedIsPageant = isCcsPageant(events.find(event => event.id === selectedEventId)?.name ?? "")

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#17251d]/20 pb-5">
        <div>
          <h1 className="font-sans text-[28px] font-semibold leading-9 tracking-[-.02em]">
            Contestants
          </h1>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setError("")
              setPhotoFile(null)
              setPhotoRemoved(false)
              setForm(prev => ({ ...prev, gender: "" }))
              setShowModal(true)
            }}
            className="bg-[#2a3441] px-4 py-2 text-xs font-bold  text-white hover:bg-[#394658]"
          >
            + Add Contestant
          </button>
        )}
      </div>

      {notice && (
        <p
          role="status"
          className="mt-3 bg-[#f3e2dc] p-3 text-sm text-[#70271f]"
        >
          {notice}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-4 bg-[#ffffff] p-4 border border-[#17251d]/20">
        <label className="text-xs font-bold  text-[#61726a]">
          Filter by Competition:
        </label>
        <select
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="border border-[#17251d]/30 bg-white px-3 py-1.5 text-sm font-semibold outline-none"
        >
          <option value="">All Competitions</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </select>
      </div>

      <AnimatedPresence kind="modal">
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8 sm:py-12">
          <div className="w-full max-w-lg border border-[#17251d]/30 bg-[#ffffff] p-6 shadow-xl">
            <h2 className="font-sans text-lg font-semibold font-bold">
              Register Contestant
            </h2>
            {error && (
              <p className="mt-3 border-l border-[#a23b30] bg-[#f3e2dc] p-2 text-xs text-[#70271f]">
                {error}
              </p>
            )}
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <fieldset disabled={saving} className="space-y-4">
                <ContestantPhotoPicker
                  file={photoFile}
                  name={form.full_name}
                  removed={photoRemoved}
                  disabled={saving}
                  onChecking={setPhotoChecking}
                  onChange={(file) => {
                    setPhotoFile(file)
                    setPhotoRemoved(false)
                  }}
                  onRemove={() => {
                    setPhotoFile(null)
                    setPhotoRemoved(true)
                  }}
                />
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-semibold">
                      Contestant / Team No.
                    </label>
                    <input
                      required
                      value={form.contestant_number}
                      onChange={(e) =>
                        setForm({ ...form, contestant_number: e.target.value })
                      }
                      placeholder="01"
                      className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold">
                      Competition Assignment
                    </label>
                    <select
                      required
                      value={form.event_id}
                      onChange={(e) =>
                        setForm({ ...form, event_id: e.target.value, gender: "" })
                      }
                      className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm"
                    >
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {formIsPageant && (
                    <div>
                      <label htmlFor="contestant-gender" className="block text-xs font-semibold">Gender</label>
                      <select id="contestant-gender" required value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm focus-visible:outline-2 focus-visible:outline-[#2a3441]">
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold">
                    Full Name / Team Name
                  </label>
                  <input
                    required
                    value={form.full_name}
                    onChange={(e) =>
                      setForm({ ...form, full_name: e.target.value })
                    }
                    placeholder="e.g. Russell Ignacio or Team Aqua"
                    className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-semibold">
                      Student ID
                    </label>
                    <input
                      value={form.student_id}
                      onChange={(e) =>
                        setForm({ ...form, student_id: e.target.value })
                      }
                      placeholder="01230001234"
                      className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold">
                      Year Level
                    </label>
                    <select
                      value={form.year_level}
                      onChange={(e) =>
                        setForm({ ...form, year_level: e.target.value })
                      }
                      className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm"
                    >
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold">
                      Section
                    </label>
                    <input
                      value={form.section}
                      onChange={(e) =>
                        setForm({ ...form, section: e.target.value })
                      }
                      placeholder="e.g. BSIT 3-Y1-1"
                      className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold">
                    Department / Course
                  </label>
                  <select
                    required
                    value={form.course}
                    onChange={(e) =>
                      setForm({ ...form, course: e.target.value })
                    }
                    className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                  >
                    <option value="BS Information Technology">
                      BS Information Technology
                    </option>
                    <option value="BS Computer Science">
                      BS Computer Science
                    </option>
                    <option value="BS Entertainment and Multimedia Computing">
                      BS Entertainment and Multimedia Computing
                    </option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    disabled={saving || photoChecking}
                    onClick={() => {
                      setShowModal(false)
                      setPhotoFile(null)
                      setError("")
                    }}
                    className="border border-[#17251d]/30 px-3 py-2 text-xs font-bold hover:bg-[#e8edf2] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || photoChecking}
                    className="bg-[#2a3441] px-4 py-2 text-xs font-bold text-white hover:bg-[#394658] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
                  >
                    {saving ? "Saving?" : "Save Contestant"}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}
      </AnimatedPresence>

      <AnimatedPresence kind="modal">
      {editingPhoto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8 sm:py-12">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="photo-editor-title"
            className="w-full max-w-lg border border-[#17251d]/30 bg-white p-6 shadow-xl"
          >
            <h2 id="photo-editor-title" className="text-lg font-semibold">
              {editingPageantEvent ? "Edit contestant" : "Update contestant photo"}
            </h2>
            <p className="mt-1 text-sm text-[#61726a]">
              {editingPhoto.full_name}
            </p>
            {error && (
              <p
                role="alert"
                className="mt-3 bg-[#f3e2dc] p-2 text-xs text-[#70271f]"
              >
                {error}
              </p>
            )}
            <form onSubmit={handlePhotoSave} className="mt-4 space-y-4">
              {editingPageantEvent && (
                <fieldset disabled={saving} className="grid gap-4">
                  <div>
                    <label htmlFor="edit-contestant-number" className="block text-xs font-semibold">Contestant / Team No.</label>
                    <input id="edit-contestant-number" required value={editNumber} onChange={e => setEditNumber(e.target.value)} className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm focus-visible:outline-2 focus-visible:outline-[#2a3441]" />
                  </div>
                  <div>
                    <label htmlFor="edit-contestant-gender" className="block text-xs font-semibold">Gender</label>
                    <select id="edit-contestant-gender" required value={editGender} onChange={e => setEditGender(e.target.value)} className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm focus-visible:outline-2 focus-visible:outline-[#2a3441]">
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </fieldset>
              )}
              <ContestantPhotoPicker
                file={photoFile}
                path={editingPhoto.photo_path}
                name={editingPhoto.full_name}
                removed={photoRemoved}
                disabled={saving}
                onChecking={setPhotoChecking}
                onChange={(file) => {
                  setPhotoFile(file)
                  setPhotoRemoved(false)
                }}
                onRemove={() => {
                  setPhotoFile(null)
                  setPhotoRemoved(true)
                }}
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  disabled={saving || photoChecking}
                  onClick={() => {
                    setEditingPhoto(null)
                    setPhotoFile(null)
                    setError("")
                  }}
                  className="border border-[#17251d]/30 px-3 py-2 text-xs font-bold hover:bg-[#e8edf2] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    saving || photoChecking || (!photoFile && !photoRemoved && !editingPageantEvent)
                  }
                  className="bg-[#2a3441] px-4 py-2 text-xs font-bold text-white hover:bg-[#394658] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a3441] disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingPageantEvent ? "Save Contestant" : "Save photo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </AnimatedPresence>
      {loading ? (
        <p className="mt-8 text-xs text-[#61726a]">Loading contestants…</p>
      ) : filtered.length === 0 ? (
        <div className="mt-8 border-l border-[#2a3441] bg-[#e8edf2] p-6">
          <h2 className="font-sans text-lg font-semibold">
            No contestants found
          </h2>
          <p className="mt-2 text-sm text-[#52655c]">
            {isAdmin
              ? "Click '+ Add Contestant' to register participants."
              : "No registered participants for this competition."}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto border border-[#17251d]/20 bg-[#ffffff]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#17251d]/20 bg-[#e8edf2] text-xs font-bold  text-[#61726a]">
              <tr>
                <th className="p-3">Number</th>
                <th className="p-3">Contestant Name</th>
                {selectedIsPageant && <th className="p-3">Gender</th>}
                <th className="p-3">Course / Year</th>
                <th className="p-3">Assigned Competitions</th>
                <th className="p-3">Status</th>
                {isAdmin && <th className="p-3">{selectedIsPageant ? "Actions" : "Photo"}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#17251d]/10">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-white/50">
                  <td className="p-3 font-mono font-bold text-[#2a3441]">
                    {c.contestant_number}
                  </td>
                  <td className="p-3 font-semibold">
                    <div className="flex items-center gap-3">
                      <ContestantPhoto path={c.photo_path} name={c.full_name} />
                      <div>
                        {c.full_name}
                        {c.student_id && (
                          <span className="ml-2 font-mono text-xs text-[#61726a]">
                            ({c.student_id})
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  {selectedIsPageant && <td className="p-3 text-xs">{c.gender ?? "Gender required"}</td>}
                  <td className="p-3 text-xs">
                    {c.course} {c.year_level ? `• ${c.year_level}` : ""}{" "}
                    {c.section ? `• ${c.section}` : ""}
                  </td>
                  <td className="p-3 text-xs">
                    {c.event_contestants

                      ?.map((ec) => ec.events?.name)

                      .filter(Boolean)

                      .join(", ") || "—"}
                  </td>
                  <td className="p-3">
                    <span className="inline-block rounded-sm bg-[#dfe5ec] px-2 py-0.5 text-xs font-bold  text-[#2a3441]">
                      {c.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="p-3">
                      <button
                        type="button"
                        aria-label={c.event_contestants?.some(ec => isCcsPageant(ec.events?.name ?? "")) ? `Edit contestant ${c.full_name}` : `${
                          c.photo_path ? "Change" : "Add"
                        } photo for ${c.full_name}`}
                        onClick={() => {
                          setEditingPhoto(c)
                          setEditGender(c.gender ?? "")
                          setEditNumber(c.contestant_number)
                          setPhotoFile(null)
                          setPhotoRemoved(false)
                          setError("")
                        }}
                        className="whitespace-nowrap border border-[#17251d]/30 px-3 py-2 text-xs font-semibold hover:bg-[#e8edf2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a3441]"
                      >
                        {c.event_contestants?.some(ec => isCcsPageant(ec.events?.name ?? "")) ? "Edit contestant" : c.photo_path ? "Change photo" : "Add photo"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
