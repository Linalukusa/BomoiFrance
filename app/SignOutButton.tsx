export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="text-sm text-text-muted underline underline-offset-2"
      >
        Se déconnecter
      </button>
    </form>
  );
}
