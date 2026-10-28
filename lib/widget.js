// Website widget (C20; pure, tested): the script a customer pastes on their own website. It draws a chat-style button
// (shadow DOM, so the site's CSS cannot break it); the visitor leaves name, phone / email and a message → POST
// /api/widget/[token] → SQL web_widget_lead → a lead (source "website"). Optional "Chat on WhatsApp" button.

// may this site use the widget? An empty list allows any site.
export function domainAllowed(domains = [], origin = "") {
  if (!domains?.length) return true;
  let host = "";
  try { host = new URL(origin).hostname.toLowerCase(); } catch { return false; }
  return domains.some((d) => { const x = String(d).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""); return host === x || host.endsWith("." + x); });
}

const esc = (s) => JSON.stringify(String(s ?? ""));

export function widgetScript({ endpoint, cfg }) {
  const c = cfg || {};
  return `(function(){if(window.__dhandhaWidget)return;window.__dhandhaWidget=1;
var E=${esc(endpoint)},T=${esc(c.title)},G=${esc(c.greeting)},C=${esc(c.color || "#4f46e5")},W=${esc(c.whatsapp || "")},AE=${c.ask_email ? 1 : 0},N=${esc(c.company || "")};
var h=document.createElement("div");h.style.cssText="position:fixed;right:18px;bottom:18px;z-index:2147483000";document.body.appendChild(h);
var r=h.attachShadow?h.attachShadow({mode:"open"}):h;
r.innerHTML='<style>*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}.b{width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25);font-size:26px}.p{display:none;position:absolute;right:0;bottom:68px;width:300px;max-width:calc(100vw - 36px);background:#fff;color:#0f172a;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.25);overflow:hidden}.p.o{display:block}.hd{color:#fff;padding:12px 14px;font-weight:600}.bd{padding:12px 14px;font-size:14px}input,textarea{width:100%;margin:5px 0;padding:9px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px}textarea{height:64px;resize:vertical}.s{width:100%;margin-top:6px;padding:10px;border:0;border-radius:8px;color:#fff;font-weight:600;cursor:pointer}.w{display:block;text-align:center;margin-top:8px;color:#15803d;font-weight:600;text-decoration:none}.m{font-size:13px;margin:6px 0}.hp{position:absolute;left:-9999px}.f{font-size:11px;color:#94a3b8;text-align:center;margin-top:8px}</style>'+
'<div class="p"><div class="hd"></div><div class="bd"><div class="g m"></div><form><input name="name" placeholder="Your name" required maxlength="120"><input name="phone" placeholder="Phone" inputmode="tel" maxlength="20">'+(AE?'<input name="email" placeholder="Email" type="email" maxlength="200">':'')+'<textarea name="message" placeholder="How can we help?" maxlength="1500"></textarea><input class="hp" name="website_url_hp" tabindex="-1" autocomplete="off"><button class="s" type="submit">Send</button><div class="m r" role="status"></div></form>'+(W?'<a class="w" target="_blank" rel="noopener">Chat on WhatsApp</a>':'')+'<div class="f">Powered by Dhandha</div></div></div><button class="b" aria-label="Contact us">💬</button>';
var p=r.querySelector(".p"),b=r.querySelector(".b"),f=r.querySelector("form"),o=r.querySelector(".r");
r.querySelector(".hd").textContent=T||"Talk to us";r.querySelector(".g").textContent=G;r.querySelector(".hd").style.background=C;b.style.background=C;r.querySelector(".s").style.background=C;
if(W){r.querySelector(".w").href="https://wa.me/"+W+"?text="+encodeURIComponent("Hello"+(N?" "+N:"")+", I have a question.");}
b.onclick=function(){p.classList.toggle("o")};
f.onsubmit=function(e){e.preventDefault();var d={};new FormData(f).forEach(function(v,k){d[k]=v});d.page=location.href;
if(!d.phone&&!d.email){o.textContent="Please give a phone number"+(AE?" or an email":"")+".";return}
o.textContent="Sending…";fetch(E,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(d)}).then(function(x){return x.json()}).then(function(j){if(j.ok){f.reset();o.textContent="Thank you! We will get back to you soon."}else{o.textContent=j.error||"Could not send — please try again."}}).catch(function(){o.textContent="Could not send — please try again."})};
})();`;
}
