import { getAdminContext } from "@/lib/admin";
import { lineStats, callFunnel } from "@/lib/callLearning";
import { CallFunnel, LineTable } from "@/components/CallLines";
import SubmitButton from "@/components/SubmitButton";
import FormState from "@/app/app/FormState";
import { saveSharedLesson, setSharedLesson } from "./actions";

export const metadata = { title: "Dhandha AI lessons" };

function LessonForm({ l, approve }) {
  return (
    <FormState action={saveSharedLesson} submit={approve ? "Save and approve for everyone" : l ? "Save" : "Add for every call"}>
      {l && <input type="hidden" name="id" value={l.id} />}
      {approve && <input type="hidden" name="approve" value="1" />}
      <div className="grid-2">
        <label>Kind<select name="kind" defaultValue={l?.kind || "rule"}><option value="rule">Rule</option><option value="example">Better answer for a moment</option></select></label>
        <label>When (optional)<input name="situation" defaultValue={l?.situation || ""} maxLength={500} /></label>
      </div>
      {(l?.kind === "example" || l?.bad) && <label>Instead of<textarea name="bad" rows={2} defaultValue={l?.bad || ""} maxLength={1000} /></label>}
      <label>Dhandha AI should<textarea name="better" rows={2} defaultValue={l?.better || ""} maxLength={1000} required /></label>
    </FormState>
  );
}

export default async function VoiceLessons() {
  const { supabase } = await getAdminContext();
  const [{ data: calls }, { data: lessons }] = await Promise.all([
    supabase.rpc("voice_calls_for_learning", { p_company: null, p_days: 90 }),
    supabase.from("voice_lessons").select("id, kind, situation, bad, better, status, starter, created_at").is("tenant_id", null).order("created_at"),
  ]);
  const list = calls || [];
  const stats = lineStats(list);
  const by = (st) => (lessons || []).filter((l) => l.status === st);
  const proposed = by("proposed");

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Dhandha AI lessons</h1>
          <p>Lessons here go into every Dhandha AI call of every customer: the starter pack, and lessons customers offered to share. Before approving a shared lesson, remove anything about that customer (names, prices, places). Below: which lines work and which lose people across all calls (last 90 days).</p>
        </div>
      </div>

      {proposed.length > 0 && (
        <div className="panel stack-sm">
          <h3 style={{ margin: 0 }}>Offered by customers — check and approve ({proposed.length})</h3>
          {proposed.map((l) => (
            <div key={l.id} className="panel stack-sm">
              <LessonForm l={l} approve />
              <form action={setSharedLesson}><input type="hidden" name="id" value={l.id} /><SubmitButton name="action" value="reject" className="ghost sm">Reject (stays with that customer only)</SubmitButton></form>
            </div>
          ))}
        </div>
      )}

      <div className="panel flush table-wrap">
        <h3 style={{ padding: "14px 16px 0" }}>Followed on every call ({by("active").length})</h3>
        <table>
          <thead><tr><th>Lesson</th><th /></tr></thead>
          <tbody>
            {by("active").map((l) => (
              <tr key={l.id}>
                <td className="small" style={{ maxWidth: 640 }}>
                  {l.situation && <div className="tiny faint">When {l.situation}</div>}
                  {l.bad && <div className="tiny faint">Instead of: {l.bad}</div>}
                  {l.better} {l.starter && <span className="chip mute">starter</span>}
                  <details><summary className="tiny">Edit</summary><LessonForm l={l} /></details>
                </td>
                <td><form action={setSharedLesson}><input type="hidden" name="id" value={l.id} /><SubmitButton name="action" value="retire" className="ghost sm">Switch off</SubmitButton></form></td>
              </tr>
            ))}
            {by("retired").map((l) => (
              <tr key={l.id} style={{ opacity: 0.55 }}>
                <td className="small">{l.better} <span className="chip mute">off</span></td>
                <td><form action={setSharedLesson}><input type="hidden" name="id" value={l.id} /><SubmitButton name="action" value="restore" className="ghost sm">Switch on</SubmitButton></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel"><h3>Add a lesson for every call</h3><LessonForm /></div>

      {!list.length ? <div className="notice">No Dhandha AI calls yet.</div> : (
        <>
          <CallFunnel funnel={callFunnel(list)} />
          <LineTable title="Lines that lose people (all customers)" hint="Line text only; open calls from the customer's own Call learning page." rows={stats.worst} />
          <LineTable title="Last line before the client hung up" rows={stats.exits} />
          <LineTable title="Lines that work" rows={stats.best} />
        </>
      )}
    </div>
  );
}
