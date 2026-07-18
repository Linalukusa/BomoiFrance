"use client";

import { useState } from "react";
import { PROFILE_ROLE_OPTIONS } from "@/lib/config/options";
import { SubmitButton } from "@/components/forms/SubmitButton";

export function RoleSelector({
  action,
  currentRole,
}: {
  action: (formData: FormData) => void | Promise<void>;
  currentRole: string;
}) {
  const [role, setRole] = useState(currentRole);

  return (
    <form action={action} className="space-y-3">
      <select
        name="role"
        value={role}
        onChange={(event) => setRole(event.target.value)}
        className="w-full rounded-lg border border-border bg-card px-4 py-3 text-text-strong focus:outline-none focus:ring-2 focus:ring-bomoi-red"
      >
        {PROFILE_ROLE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <SubmitButton
        label="Changer le rôle"
        pendingLabel="Modification…"
        disabled={role === currentRole}
      />
    </form>
  );
}
