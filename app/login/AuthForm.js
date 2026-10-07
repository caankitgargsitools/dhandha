"use client";
import { useActionState } from "react";
import { signIn, signUp } from "./actions";

export default function AuthForm({ mode }) {
  const [state, action, pending] = useActionState(mode === "signup" ? signUp : signIn, {});
  return (
    <form action={action} className="stack">
      {mode === "signup" && (
        <>
          <div><label htmlFor="full_name">Your name</label><input id="full_name" name="full_name" required /></div>
          <div><label htmlFor="phone">Mobile number</label><input id="phone" name="phone" inputMode="tel" placeholder="98XXXXXXXX" /></div>
        </>
      )}
      <div><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
      <div>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "signup" ? "new-password" : "current-password"} />
      </div>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.message && <p className="notice small">{state.message}</p>}
      <button disabled={pending}>{pending ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</button>
    </form>
  );
}
