import {
  createBrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  useNavigate,
  useOutletContext,
} from "react-router"
import { FormEvent, ReactNode, useEffect, useState } from "react"
import {
  authEmailToUsername,
  isSupabaseConfigured,
  isValidUsername,
  supabase,
  usernameToAuthEmail,
} from "./lib/supabase"
import CompetitionsManager from "./components/CompetitionsManager"
import EventsManager from "./components/EventsManager"
import ContestantsManager from "./components/ContestantsManager"
import JudgesManager from "./components/JudgesManager"
import CriteriaManager from "./components/CriteriaManager"
import ScoresManager from "./components/ScoresManager"
import ResultsManager from "./components/ResultsManager"
import AuditLogsManager from "./components/AuditLogsManager"
import PublicResults from "./components/PublicResults"

const nav = [
  "Dashboard",
  "Competitions",
  "Events",
  "Contestants",
  "Judges",
  "Assign Judges",
  "Criteria",
  "Scores",
  "Tabulation",
  "Rankings",
  "Winners",
  "Results",
  "Audit Logs",
  "Settings",
]
const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/

type ProfileContext = {
  profile: {
    id: string
    full_name: string
    role: string
    status: string
    email?: string
  }
}

function Brand() {
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold leading-5">
        Our Lady of Fatima University
      </p>
      <p className="mt-0.5 text-xs leading-5 text-[#61726a]">
        College of Computer Studies
      </p>
    </div>
  )
}

function SetupNotice() {
  return !isSupabaseConfigured ? (
    <div className="border-b border-[#a97b26] bg-[#fff3cf] px-5 py-3 text-center text-xs text-[#624815]">
      Database connection pending. Add{" "}
      <code className="font-mono">VITE_SUPABASE_URL</code> and{" "}
      <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> after creating
      your Supabase project. No production data is displayed until then.
    </div>
  ) : null
}

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page min-h-screen bg-[#f1efe6] text-[#17251d]">
      <SetupNotice />
      <div className="mx-auto w-full max-w-[440px] px-5 py-6 sm:py-12">
        <header className="border-b border-[#17251d]/15 pb-5">
          <Brand />
          <p className="mt-3 text-xs text-[#61726a]">
            Competition tabulation system
          </p>
        </header>
        <section className="pt-6">{children}</section>
      </div>
    </main>
  )
}

function Login() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setMessage("")
    if (!username || !password)
      return setMessage("Enter your username and password.")
    if (!supabase)
      return setMessage(
        "Supabase connection is required before sign-in can be used.",
      )

    setLoading(true)
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: usernameToAuthEmail(username),
      password,
    })

    if (error) {
      setLoading(false)
      return setMessage(
        "We could not sign you in. Check your credentials and account status.",
      )
    }

    if (authData.user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("status")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle()

      if (profileData && profileData.status !== "active") {
        await supabase.auth.signOut()
        setLoading(false)
        return setMessage(
          `Your account is currently ${profileData.status}. Please wait for administrator activation.`,
        )
      }
    }

    setLoading(false)
    navigate("/app")
  }

  return (
    <AuthLayout>
      <form onSubmit={submit} className="w-full max-w-md">
        <h1 className="text-[28px] font-semibold leading-9 tracking-[-.02em]">
          Sign in
        </h1>
        <p className="mt-2 mb-5 text-sm leading-6 text-[#61726a]">
          For administrators and approved judges.
        </p>
        <Field
          label="Username"
          placeholder="e.g. admin or judge1"
          value={username}
          onChange={setUsername}
          autoComplete="username"
        />
        <div className="mt-5">
          <label
            htmlFor="login-password"
            className="mb-2 block text-sm font-semibold"
          >
            Password
          </label>
          <div className="flex rounded-md border border-[#17251d]/35 bg-white focus-within:border-[#2a3441] focus-within:ring-2 focus-within:ring-[#2a3441]/20">
            <input
              id="login-password"
              required
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="min-w-0 flex-1 rounded-l-md px-3 py-2.5 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-pressed={show}
              className="border-l border-[#17251d]/20 px-3 text-sm font-semibold"
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        {message && (
          <p
            role="alert"
            className="mt-4 border-l border-[#a23b30] bg-[#f3e2dc] px-3 py-2 text-sm text-[#70271f]"
          >
            {message}
          </p>
        )}
        <button
          disabled={loading}
          className="mt-7 w-full bg-[#17251d] px-4 py-3 text-sm font-bold text-white disabled:bg-[#8d9990]"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-6 text-center text-sm text-[#61726a]">
          New judge?{" "}
          <NavLink
            to="/register"
            className="font-bold text-[#2a3441] underline underline-offset-4"
          >
            Request an account
          </NavLink>
        </p>
      </form>
    </AuthLayout>
  )
}

function Register() {
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirm: "",
  })
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setMessage("")
    const username = form.username.trim().toLowerCase()

    if (!isValidUsername(username))
      return setMessage(
        "Username must be 3–30 characters and can only contain letters, numbers, underscores, dots, or hyphens.",
      )
    if (!passwordRule.test(form.password))
      return setMessage(
        "Password needs 8+ characters with uppercase, lowercase, number, and special character.",
      )
    if (form.password !== form.confirm)
      return setMessage("Password confirmation does not match.")
    if (!supabase)
      return setMessage(
        "Supabase connection is required before registration can be used.",
      )

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: usernameToAuthEmail(username),
      password: form.password,
      options: {
        data: {
          username: username,
          full_name: username,
        },
      },
    })

    setMessage(
      error
        ? "We could not complete registration. Verify your details or try again."
        : "Registration received. Please wait for administrator approval to activate your account.",
    )
    setLoading(false)
  }

  return (
    <AuthLayout>
      <form onSubmit={submit} className="w-full max-w-md">
        <h1 className="text-[28px] font-semibold leading-9 tracking-[-.02em]">
          Request judge access
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#61726a]">
          Your registration is reviewed before any event is assigned.
        </p>
        <div className="mt-5 space-y-4">
          <Field
            label="Username"
            placeholder="e.g. jdelacruz"
            value={form.username}
            onChange={set("username")}
            autoComplete="username"
          />
          <Field
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
          />
          <p className="text-xs leading-5 text-[#61726a]">
            Use at least 8 characters, including uppercase and lowercase
            letters, a number, and a special character.
          </p>
          <Field
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={set("confirm")}
          />
        </div>
        {message && (
          <p
            role="alert"
            className="mt-4 border-l border-[#a23b30] bg-[#f3e2dc] px-3 py-2 text-sm text-[#70271f]"
          >
            {message}
          </p>
        )}
        <button
          disabled={loading}
          className="mt-7 w-full bg-[#17251d] px-4 py-3 text-sm font-bold text-white disabled:bg-[#8d9990]"
        >
          {loading ? "Submitting…" : "Submit registration"}
        </button>
        <p className="mt-5 text-center text-sm text-[#61726a]">
          Already approved?{" "}
          <NavLink
            to="/login"
            className="font-bold text-[#2a3441] underline underline-offset-4"
          >
            Sign in
          </NavLink>
        </p>
      </form>
    </AuthLayout>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <input
        required
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-md border border-[#17251d]/35 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#2a3441] focus:ring-2 focus:ring-[#2a3441]/20"
      />
    </label>
  )
}

function Application() {
  const [profile, setProfile] = useState<{
    id: string
    full_name: string
    role: string
    status: string
    email?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      if (!supabase) return setLoading(false)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        navigate("/login")
        return
      }
      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,role,status,email")
        .eq("auth_user_id", user.id)
        .single()
      if (!data || data.status !== "active") {
        await supabase.auth.signOut()
        navigate("/login")
        return
      }
      setProfile(data)
      setLoading(false)
    }
    load()
  }, [navigate])

  async function logout() {
    await supabase?.auth.signOut()
    navigate("/login")
  }

  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f1efe6] text-xs text-[#61726a]">
        Loading secure workspace
      </main>
    )

  const permittedNav =
    profile?.role === "admin"
      ? nav
      : [
          "Dashboard",
          "Events",
          "Criteria",
          "Scores",
          "Tabulation",
          "Rankings",
          "Winners",
          "Results",
        ]

  return (
    <main className="workspace min-h-screen bg-[#f1efe6] text-[#17251d]">
      <SetupNotice />
      <header className="border-b border-[#17251d]/20 bg-[#f8f6ee]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-8">
          <Brand />
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">
                {profile?.full_name ?? "Account"}
              </p>
              <p className="text-xs  text-[#61726a]">
                {profile?.role ?? "Access pending"}
              </p>
            </div>
            <button
              onClick={logout}
              className="border border-[#17251d]/30 px-3 py-2 text-xs font-bold hover:bg-[#e8edf2]"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[192px_minmax(0,1fr)]">
        <aside className="border-b border-[#17251d]/20 px-4 py-4 lg:min-h-[calc(100vh-73px)] lg:border-r lg:border-b-0 lg:px-4">
          <p className="mb-3 text-xs font-bold  text-[#61726a]">
            System navigation
          </p>
          <nav className="flex gap-1 overflow-x-auto lg:block lg:space-y-0.5">
            {permittedNav.map((item) => (
              <NavLink
                key={item}
                to={`/app/${item.toLowerCase().replace(/ /g, "-")}`}
                end={item === "Dashboard"}
                className={({ isActive }) =>
                  `block shrink-0 border-l px-3 py-2 text-sm ${
                    isActive
                      ? "border-[#2a3441] bg-[#dfe5ec] font-bold"
                      : "border-transparent hover:border-[#17251d]/25 hover:bg-white/60"
                  }`
                }
              >
                {item}
              </NavLink>
            ))}
          </nav>
        </aside>
        <section className="min-w-0 px-5 py-8 lg:px-7 lg:py-7">
          <Outlet context={{ profile }} />
        </section>
      </div>
    </main>
  )
}

function DataPage() {
  const { profile } = useOutletContext<ProfileContext>()
  const navigate = useNavigate()
  const path =
    location.pathname.split("/").pop()?.replace(/-/g, " ") ?? "dashboard"
  const title = path.replace(/\b\w/g, (letter: string) => letter.toUpperCase())
  const isAdmin = profile?.role === "admin"

  if (title === "Dashboard") return <Dashboard />
  if (title === "Competitions")
    return <CompetitionsManager isAdmin={isAdmin} profileId={profile?.id} />
  if (title === "Events")
    return (
      <EventsManager
        isAdmin={isAdmin}
        profileId={profile?.id}
        onNavigate={(p) => navigate(`/app/${p}`)}
      />
    )
  if (title === "Contestants") return <ContestantsManager isAdmin={isAdmin} />
  if (title === "Judges")
    return <JudgesManager isAdmin={isAdmin} isAssignMode={false} />
  if (title === "Assign Judges")
    return <JudgesManager isAdmin={isAdmin} isAssignMode={true} />
  if (title === "Criteria")
    return <CriteriaManager isAdmin={isAdmin} profileId={profile?.id} />
  if (title === "Scores")
    return <ScoresManager isAdmin={isAdmin} profileId={profile?.id} />
  if (title === "Tabulation")
    return <ResultsManager isAdmin={isAdmin} viewMode="tabulation" />
  if (title === "Rankings")
    return <ResultsManager isAdmin={isAdmin} viewMode="rankings" />
  if (title === "Winners")
    return <ResultsManager isAdmin={isAdmin} viewMode="winners" />
  if (title === "Results")
    return <ResultsManager isAdmin={isAdmin} viewMode="results" />
  if (title === "Audit Logs") return <AuditLogsManager />

  if (title === "Settings") {
    return (
      <div className="max-w-xl">
        <h1 className="font-sans text-[28px] font-semibold leading-9 tracking-[-.02em]">
          Account Settings
        </h1>
        <div className="mt-6 border border-[#17251d]/20 bg-[#f8f6ee] p-6 space-y-4">
          <div>
            <label className="block text-xs font-mono font-semibold text-[#61726a]">
              Full Name
            </label>
            <p className="text-base font-semibold">{profile?.full_name}</p>
          </div>
          <div>
            <label className="block text-xs font-mono font-semibold text-[#61726a]">
              Role
            </label>
            <p className="text-sm capitalize font-mono text-[#2a3441] font-bold">
              {profile?.role}
            </p>
          </div>
          <div>
            <label className="block text-xs font-mono font-semibold text-[#61726a]">
              Username
            </label>
            <p className="text-sm font-mono">
              {authEmailToUsername(profile?.email) || "Authenticated"}
            </p>
          </div>
          <div>
            <label className="block text-xs font-mono font-semibold text-[#61726a]">
              Status
            </label>
            <span className="inline-block rounded bg-[#dfe5ec] px-2 py-0.5 text-xs font-semibold text-[#2a3441]">
              {profile?.status}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-sans text-[28px] font-semibold leading-9 tracking-[-.02em]">
          {title}
        </h1>
      </div>
      <div className="mt-10 border-l border-[#2a3441] bg-[#e8edf2] px-5 py-7">
        <h2 className="font-sans text-lg font-semibold">Module ready</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#52655c]">
          Connected to Supabase PostgreSQL database.
        </p>
      </div>
    </>
  )
}

function Dashboard() {
  const specs = [
    ["Total Competitions", "competitions"],
    ["Active Competitions", "competitions"],
    ["Total Events", "events"],
    ["Total Contestants", "contestants"],
    ["Registered Judges", "profiles"],
    ["Completed Events", "events"],
    ["Events Awaiting Scores", "events"],
    ["Finalized Events", "events"],
  ] as const
  const [counts, setCounts] = useState<Record<string, number | null>>({})

  useEffect(() => {
    async function load() {
      const client = supabase
      if (!client) return
      const queries = specs.map(async ([label, table]) => {
        let query = client
          .from(table)
          .select("id", { count: "exact", head: true })
        if (label === "Active Competitions")
          query = query.eq("status", "ongoing")
        if (label === "Registered Judges")
          query = query.eq("role", "judge").eq("status", "active")
        if (label === "Completed Events")
          query = query.eq("status", "finalized")
        if (label === "Events Awaiting Scores")
          query = query.eq("status", "scoring")
        if (label === "Finalized Events")
          query = query.eq("status", "finalized")
        const { count } = await query
        return [label, count] as const
      })
      setCounts(Object.fromEntries(await Promise.all(queries)))
    }
    load()
  }, [])

  return (
    <>
      <h1 className="font-sans text-[28px] font-semibold leading-9 tracking-[-.02em]">
        Control room
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[#61726a]">
        Competition and event activity at a glance.
      </p>
      <div className="mt-9 grid border-l border-t border-[#17251d]/20 sm:grid-cols-2 xl:grid-cols-4">
        {specs.map(([label]) => (
          <div
            key={label}
            className="min-h-24 border-r border-b border-[#17251d]/20 bg-[#f8f6ee] p-4"
          >
            <p className="text-xs font-bold  text-[#61726a]">{label}</p>
            <p className="mt-3 font-mono text-2xl">{counts[label] ?? "—"}</p>
            <p className="mt-1 text-xs text-[#61726a]">
              {counts[label] === undefined
                ? "Loading live count"
                : "Current count"}
            </p>
          </div>
        ))}
      </div>
    </>
  )
}

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/results" replace /> },
  { path: "/login", Component: Login },
  { path: "/register", Component: Register },
  { path: "/results", element: <PublicResults brand={<Brand />} /> },
  {
    path: "/app",
    Component: Application,
    children: [
      { index: true, Component: DataPage },
      { path: ":page", Component: DataPage },
    ],
  },
  { path: "*", element: <Navigate to="/results" replace /> },
])
