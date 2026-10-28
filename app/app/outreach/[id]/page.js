import { redirect } from "next/navigation";

// Sequences are built and run as Lead Playbooks now.
export default async function OldSequence({ params }) {
  const { id } = await params;
  redirect(`/app/leads/playbook/${id}`);
}
