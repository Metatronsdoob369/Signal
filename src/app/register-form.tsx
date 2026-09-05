"use client";

import { useActionState } from "react";
import { createSite, type CreateSiteState } from "./actions";

const initial: CreateSiteState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(createSite, initial);

  return (
    <form action={action} className="mt-10 flex flex-col gap-3 sm:flex-row" data-testid="register-form">
      <input
        id="domain"
        name="domain"
        type="text"
        required
        placeholder="example.com"
        data-testid="domain-input"
        className="flex-1 border border-[var(--line)] bg-white px-4 py-3 font-mono text-sm text-[var(--ink)] outline-none focus:border-[var(--ink)]"
      />
      <input
        id="name"
        name="name"
        type="text"
        placeholder="Site name (optional)"
        data-testid="name-input"
        className="flex-1 border border-[var(--line)] bg-white px-4 py-3 font-mono text-sm text-[var(--ink)] outline-none focus:border-[var(--ink)]"
      />
      <button
        type="submit"
        disabled={pending}
        data-testid="create-pack"
        className="bg-[var(--ink)] px-6 py-3 font-mono text-sm font-medium text-[var(--paper)] transition hover:bg-[var(--accent)] disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create pack"}
      </button>
      {state.error ? (
        <p className="w-full font-mono text-sm text-red-700 sm:basis-full" data-testid="register-error">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
