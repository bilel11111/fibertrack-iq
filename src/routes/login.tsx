import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Shield, Wrench, BarChart2, Briefcase, Eye } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Connexion — FiberNMS" }] }),
  component: LoginPage,
  ssr: false,
});

const DEMO_USERS = [
  {
    roleName: "Administrateur",
    email: "admin@sotetel.tn",
    desc: "Gestion de la sécurité, logs d'audit et attribution des rôles.",
    icon: <Shield className="h-5 w-5 text-red-500" />,
    color: "hover:border-red-500/40 hover:bg-red-50/20"
  },
  {
    roleName: "Opérateur TT",
    email: "operateur@sotetel.tn",
    desc: "Gestion complète des stocks, entrées/sorties et CRUD équipements.",
    icon: <Briefcase className="h-5 w-5 text-blue-500" />,
    color: "hover:border-blue-500/40 hover:bg-blue-50/20"
  },
  {
    roleName: "Chef de projet",
    email: "chefprojet@sotetel.tn",
    desc: "Suivi statistiques KPI, topologie GPON et rapports d'avancement.",
    icon: <BarChart2 className="h-5 w-5 text-violet-500" />,
    color: "hover:border-violet-500/40 hover:bg-violet-50/20"
  },
  {
    roleName: "Technicien terrain",
    email: "technicien@sotetel.tn",
    desc: "Supervision des alertes et interventions, scan rapide QR de terrain.",
    icon: <Wrench className="h-5 w-5 text-emerald-500" />,
    color: "hover:border-emerald-500/40 hover:bg-emerald-50/20"
  }
];

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground bg-[#f8fafc]">Chargement…</div>;
  if (user) return <Navigate to="/" />;

  const executeLogin = async (targetEmail: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: "password123"
      });
      if (error) throw error;
      toast.success(`Connecté en tant que ${targetEmail.split("@")[0]} !`);
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Authentification échouée");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    executeLogin(email || "technicien@sotetel.tn");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-6 dark:bg-slate-900">
      <div className="w-full max-w-4xl grid gap-8 md:grid-cols-2 bg-white dark:bg-slate-950 p-8 rounded-3xl border border-[#e2e8f0] dark:border-slate-800 shadow-2xl">
        
        {/* Left column: Welcome + Credentials Login form */}
        <div className="flex flex-col justify-between">
          <div>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white font-extrabold shadow-md shadow-primary/20">⚡</div>
              <div>
                <h1 className="text-base font-extrabold tracking-tight text-[#1e293b] dark:text-white">FiberNMS</h1>
                <p className="text-[10px] text-muted-foreground">Digitalization & Supervision Platform · SOTETEL</p>
              </div>
            </div>

            <h2 className="text-xl font-bold tracking-tight text-[#1e293b] dark:text-white mb-1">Connexion Espace Local</h2>
            <p className="text-xs text-muted-foreground mb-6">Identifiez-vous à l'aide de vos accès locaux connectés à SQLite.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Adresse Email Professionnelle</label>
                <input
                  type="email"
                  required
                  placeholder="technicien@sotetel.tn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Mot de passe</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-primary text-white font-bold py-2.5 text-xs shadow-md shadow-primary/15 hover:bg-primary/95 disabled:opacity-50 transition"
              >
                {busy ? "Connexion en cours…" : "S'authentifier"}
              </button>
            </form>
          </div>

          <p className="mt-8 text-[10px] text-muted-foreground border-t border-slate-100 pt-3 dark:border-slate-800">
            Sotetel GPON local workspace offline credentials auth.
          </p>
        </div>

        {/* Right column: Interactive Quick Role Selector matching use cases */}
        <div className="flex flex-col border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-6 md:pt-0 md:pl-8 justify-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Accès rapide par rôle</h3>
          <p className="text-[10px] text-muted-foreground mb-4">Sélectionnez un profil pour tester instantanément ses habilitations UML.</p>
          
          <div className="space-y-3">
            {DEMO_USERS.map((demo) => (
              <button
                key={demo.email}
                onClick={() => executeLogin(demo.email)}
                disabled={busy}
                className={`w-full flex items-start text-left gap-3.5 border border-border/75 bg-slate-50/50 p-3.5 rounded-2xl transition border-l-4 ${demo.color} disabled:opacity-50`}
              >
                <div className="p-2 rounded-xl bg-white shadow-xs border border-border/20">{demo.icon}</div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#1e293b] leading-tight">{demo.roleName}</span>
                    <span className="text-[9px] text-muted-foreground font-mono">({demo.email.split("@")[0]})</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-normal">{demo.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
