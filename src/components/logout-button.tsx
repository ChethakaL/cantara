export function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        className="rounded-full border border-[color:var(--navy)]/30 bg-white px-4 py-2 text-sm font-semibold text-[color:var(--navy)] transition hover:border-[color:var(--navy)] hover:bg-[color:var(--navy)] hover:text-white"
      >
        Sign out
      </button>
    </form>
  );
}
