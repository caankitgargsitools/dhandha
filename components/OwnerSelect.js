// Owner picker for leads and deals; blank adds an "unassigned" choice.
export default function OwnerSelect({ members, me, id = "owner_id", blank, value }) {
  return (
    <div>
      <label htmlFor={id}>Owner</label>
      <select id={id} name="owner_id" defaultValue={value === undefined ? (blank ? "" : me) : value || ""}>
        {(blank || value === null) && <option value="">{blank || "Unassigned"}</option>}
        {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.user_id === me ? "Me" : m.profiles?.full_name || m.profiles?.email}</option>)}
      </select>
    </div>
  );
}
