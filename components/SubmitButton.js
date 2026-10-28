"use client";
import { useFormStatus } from "react-dom";

// A submit button for a plain <form action={serverAction}>: disabled and spinning (aria-busy) while the form runs.
// With name/value, only the button that was pressed spins. `confirm` asks before submitting.
export default function SubmitButton({ children, name, value, confirm, ...rest }) {
  const { pending, data } = useFormStatus();
  const mine = pending && (!name || data?.get(name) === String(value));
  return (
    <button
      {...rest}
      name={name}
      value={value}
      disabled={pending || rest.disabled}
      aria-busy={mine}
      onClick={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
    >
      {children}
    </button>
  );
}
