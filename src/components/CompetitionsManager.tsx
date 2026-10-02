import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Competition = {
  id: string;
  name: string;
  description: string | null;
  academic_year: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
};

export default function CompetitionsManager({ isAdmin, profileId }: { isAdmin: boolean; profileId?: string }) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    academic_year: "2026–2027",
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
    status: "draft",
  });

  async function loadCompetitions() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("competitions")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setCompetitions(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadCompetitions();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!supabase) return;
    if (form.name.trim().length < 3) {
      setError("Competition name must have at least 3 characters.");
      return;
    }
    if (form.end_date < form.start_date) {
      setError("End date must be on or after start date.");
      return;
    }

    const { error: insertError } = await supabase.from("competitions").insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      academic_year: form.academic_year.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      status: form.status,
      created_by: profileId || null,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setShowModal(false);
    setForm({
      name: "",
      description: "",
      academic_year: "2026–2027",
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date().toISOString().split("T")[0],
      status: "draft",
    });
    loadCompetitions();
  }

  async function updateStatus(id: string, newStatus: string) {
    if (!supabase || !isAdmin) return;
    const { error } = await supabase.from("competitions").update({ status: newStatus }).eq("id", id);
    if (!error) loadCompetitions();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#17251d]/20 pb-5">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[.15em] text-[#61726a]">Institutional Registry</p>
          <h1 className="mt-2 font-display text-4xl tracking-[-.04em]">Competitions</h1>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="border border-[#124734] bg-[#124734] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#1a5b44]"
          >
            + New Competition
          </button>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg border border-[#17251d]/30 bg-[#f8f6ee] p-6 shadow-xl">
            <h2 className="font-display text-2xl font-bold">Create Competition</h2>
            <p className="mt-1 text-xs text-[#61726a]">Register an official university competition series.</p>
            {error && <p className="mt-3 border-l-2 border-[#a23b30] bg-[#f3e2dc] p-2 text-xs text-[#70271f]">{error}</p>}
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold">Competition Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. CCS Week 2026"
                  className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief context or guidelines"
                  className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold">Academic Year</label>
                  <input
                    required
                    value={form.academic_year}
                    onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
                    className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold">Start Date</label>
                  <input
                    type="date"
                    required
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold">End Date</label>
                  <input
                    type="date"
                    required
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="border border-[#17251d]/30 px-3 py-2 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#124734] px-4 py-2 text-xs font-bold text-white hover:bg-[#1a5b44]"
                >
                  Save Competition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-8 font-mono text-xs uppercase tracking-wider text-[#61726a]">Loading competitions…</p>
      ) : competitions.length === 0 ? (
        <div className="mt-8 border-l-2 border-[#124734] bg-[#e6ece0] p-6">
          <h2 className="font-display text-2xl">No competitions created yet</h2>
          <p className="mt-2 text-sm text-[#52655c]">
            {isAdmin
              ? "Click '+ New Competition' above to register your first competition."
              : "No active competitions are currently available."}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto border border-[#17251d]/20 bg-[#f8f6ee]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#17251d]/20 bg-[#e6ece0] font-mono text-[10px] font-bold uppercase tracking-wider text-[#61726a]">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Academic Year</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Status</th>
                {isAdmin && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#17251d]/10">
              {competitions.map((c) => (
                <tr key={c.id} className="hover:bg-white/50">
                  <td className="p-3 font-semibold">
                    {c.name}
                    {c.description && <p className="text-xs font-normal text-[#61726a]">{c.description}</p>}
                  </td>
                  <td className="p-3 font-mono text-xs">{c.academic_year}</td>
                  <td className="p-3 text-xs">{c.start_date} to {c.end_date}</td>
                  <td className="p-3">
                    <span className="inline-block rounded-sm bg-[#dfe8da] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#124734]">
                      {c.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="p-3 text-right">
                      <select
                        value={c.status}
                        onChange={(e) => updateStatus(c.id, e.target.value)}
                        className="border border-[#17251d]/30 bg-white px-2 py-1 text-xs"
                      >
                        <option value="draft">Draft</option>
                        <option value="registration_open">Registration Open</option>
                        <option value="ongoing">Ongoing</option>
                        <option value="scoring">Scoring</option>
                        <option value="finalized">Finalized</option>
                        <option value="published">Published</option>
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
