import { deleteRow } from "./actions";

export default function DeleteButton({ table, id }) {
  return (
    <form action={deleteRow}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <button className="danger" title="Delete">Delete</button>
    </form>
  );
}
