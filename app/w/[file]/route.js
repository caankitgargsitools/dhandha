import { anonClient } from "@/lib/supabase/anon";
import { widgetScript } from "@/lib/widget";

// The website widget script: <script src="https://<dhandha>/w/<token>.js" async></script>
export async function GET(request, { params }) {
  const { file } = await params;
  const token = String(file || "").replace(/\.js$/, "");
  const js = (body, status = 200) => new Response(body, { status, headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
  if (!/^[0-9a-f-]{36}$/i.test(token)) return js("/* not found */", 404);
  const { data } = await anonClient().rpc("web_widget_view", { p_token: token });
  if (!data) return js("/* widget switched off */", 404);
  return js(widgetScript({ endpoint: `${new URL(request.url).origin}/api/widget/${token}`, cfg: data }));
}
