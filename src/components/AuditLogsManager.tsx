import { useEffect, useState } from "react";
import { authEmailToUsername, supabase } from "../lib/supabase";

type AuditEntry = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  profiles?: { full_name: string; email: string };
};

export default function AuditLogsManager() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadLogs() {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase
      .from("audit_logs")
      .select("id, user_id, action, entity_type, entity_id, created_at, profiles(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      setLogs(data as unknown as AuditEntry[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#17251d]/20 pb-5">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[.15em] text-[#61726a]">Security & Integrity</p>
          <h1 className="mt-2 font-display text-4xl tracking-[-.04em]">Audit Logs</h1>
        </div>
        <button
          onClick={loadLogs}
          className="border border-[#17251d]/30 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#2a3441] hover:bg-[#e8edf2]"
        >
          Refresh Log
        </button>
      </div>

      {loading ? (
        <p className="mt-8 font-mono text-xs uppercase tracking-wider text-[#61726a]">Loading audit records…</p>
      ) : logs.length === 0 ? (
        <div className="mt-8 border-l-2 border-[#2a3441] bg-[#e8edf2] p-6">
          <h2 className="font-display text-2xl">No Logged Events</h2>
          <p className="mt-2 text-sm text-[#52655c]">Institutional database actions will automatically appear here.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto border border-[#17251d]/20 bg-[#f8f6ee]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#17251d]/20 bg-[#e8edf2] font-mono text-[10px] font-bold uppercase tracking-wider text-[#61726a]">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity Type</th>
                <th className="p-3">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#17251d]/10">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/50">
                  <td className="p-3 font-mono text-xs text-[#61726a]">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-block rounded-sm px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                        log.action === "insert"
                          ? "bg-[#dfe5ec] text-[#2a3441]"
                          : log.action === "update"
                          ? "bg-[#fff3cf] text-[#a97b26]"
                          : "bg-[#f3e2dc] text-[#a23b30]"
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs font-semibold">{log.entity_type}</td>
                  <td className="p-3 text-xs">
                    {log.profiles?.full_name ? (
                      <span>
                        <b>{log.profiles.full_name}</b> (@{authEmailToUsername(log.profiles.email)})
                      </span>
                    ) : (
                      <span className="font-mono text-[#61726a]">System / Anonymous</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
