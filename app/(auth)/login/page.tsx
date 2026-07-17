import { AUTH_QUERY_ERROR_MESSAGES } from "@/lib/auth-errors";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const initialError = error ? AUTH_QUERY_ERROR_MESSAGES[error] : undefined;

  return <LoginForm initialError={initialError} />;
}
