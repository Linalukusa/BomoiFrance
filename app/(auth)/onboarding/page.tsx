import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 flex-col bg-page px-6 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-strong">
            Avant de commencer
          </h1>
          <p className="text-sm text-text-secondary">
            Deux engagements à valider pour activer votre compte médiateur.
          </p>
        </div>
        <OnboardingForm error={error} />
      </div>
    </div>
  );
}
