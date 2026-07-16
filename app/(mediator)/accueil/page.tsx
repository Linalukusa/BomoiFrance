import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/app/SignOutButton";

export default async function AccueilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: mediator } = await supabase
    .from("mediators")
    .select("first_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-text-muted">Bonjour</p>
          <p className="text-2xl font-bold text-text-strong">
            {mediator?.first_name ?? "—"}
          </p>
        </div>
        <SignOutButton />
      </div>

      <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted">
        Les écrans « Nouvelle activité », « Nouvelle orientation », « Journal
        des freins » et « Mes statistiques » arrivent aux prochaines étapes
        du plan de développement (Étapes 3 à 7).
      </div>
    </div>
  );
}
