const roles = [
  "Managing Director",
  "Director",
  "GM – Sales & Operations",
  "Project Manager",
  "Manager – Customer Support & Administration"
];

const statuses = [
  "New Lead","Contacted","Site Visit Planned","Site Visit Done",
  "Proposal Sent","Follow-up/Negotiation","Booked",
  "Installation in Process","Completed","Lost/Not Interested"
];

const html = (title, body, user=null) => `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
body{font-family:Arial,sans-serif;margin:0;background:#f4f7f3;color:#17351f}
header{background:#1f6b38;color:#fff;padding:14px 18px;display:flex;justify-content:space-between;gap:12px;align-items:center}
.brand{font-weight:800;font-size:20px}.wrap{max-width:1150px;margin:auto;padding:18px}
.card{background:#fff;border-radius:12px;padding:16px;margin:12px 0;box-shadow:0 2px 10px #0001}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
input,select,textarea,button{box-sizing:border-box;width:100%;padding:11px;border:1px solid #ccd6cc;border-radius:8px}
button{background:#e4c52d;border:0;font-weight:700;cursor:pointer}
a{color:#1f6b38}.pill{background:#eaf5df;border-radius:20px;padding:5px 9px;font-size:12px}
table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #eee;text-align:left;white-space:nowrap}
.table{overflow:auto}.small{font-size:12px;color:#667}.flash{background:#fff4bf;padding:10px;border-radius:8px;margin-bottom:12px}
</style></head><body>
<header><div class="brand">☀ Sudarshan Solartech CRM</div>
${user?`<div>${esc(user.name)} · ${esc(user.role)} · <a style="color:#fff" href="/logout">Logout</a></div>`:""}</header>
<div class="wrap">${body}</div></body></html>`;

function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function now(){return new Date().toISOString().slice(0,16).replace("T"," ");}
function token(){return crypto.randomUUID()+"-"+crypto.randomUUID();}
async function hash(p, secret="sudarshan"){const b=new TextEncoder().encode(p+"|"+secret);let x=await crypto.subtle.digest("SHA-256",b);return [...new Uint8Array(x)].map(v=>v.toString(16).padStart(2,"0")).join("");}
async function userFromRequest(req,env){
 const t=(req.headers.get("Cookie")||"").match(/crm_session=([^;]+)/)?.[1]; if(!t)return null;
 const r=await env.DB.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>? AND u.active=1").bind(t,Date.now()).first();
 return r||null;
}
function redirect(loc){return new Response(null,{status:302,headers:{Location:loc}})}
async function bootstrap(env){
 const c=await env.DB.prepare("SELECT COUNT(*) n FROM users").first();
 if(c.n===0){
   const h=await hash("ChangeMe123!",env.SESSION_SECRET||"bootstrap");
   await env.DB.prepare("INSERT INTO users(username,password_hash,name,role) VALUES(?,?,?,?)").bind("md",h,"Managing Director","Managing Director").run();
 }
}
function formField(label,name,type="text",value=""){return `<div><label>${label}</label><input name="${name}" type="${type}" value="${esc(value)}"></div>`;}

export default {
 async fetch(req,env){
   try{
    await bootstrap(env);
    const url=new URL(req.url), path=url.pathname, method=req.method;
    const user=await userFromRequest(req,env);

    if(path==="/login" && method==="GET")
      return new Response(html("Login",`<div class="card" style="max-width:420px;margin:60px auto"><h2>CRM Login</h2><form method="post"><p><input name="username" placeholder="Username" required></p><p><input name="password" type="password" placeholder="Password" required></p><button>Login</button></form><p class="small">Initial bootstrap username: md. The initial password is ChangeMe123! and must be changed through a secure account-management flow before staff use.</p></div>`),{headers:{"content-type":"text/html;charset=UTF-8"}});

    if(path==="/login" && method==="POST"){
      const f=await req.formData(), u=await env.DB.prepare("SELECT * FROM users WHERE username=? AND active=1").bind(f.get("username")).first();
      if(!u || await hash(f.get("password"),env.SESSION_SECRET||"bootstrap")!==u.password_hash)
        return new Response(html("Login",`<div class="flash">Invalid login.</div><div class="card"><a href="/login">Try again</a></div>`),{status:401,headers:{"content-type":"text/html"}});
      const t=token(); await env.DB.prepare("INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)").bind(t,u.id,Date.now()+86400000*7).run();
      return new Response(null,{status:302,headers:{Location:"/", "Set-Cookie":`crm_session=${t}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`}});
    }

    if(path==="/logout"){return new Response(null,{status:302,headers:{Location:"/login","Set-Cookie":"crm_session=; Path=/; Max-Age=0"}});}

    if(!user)return redirect("/login");

    if(path==="/new" && method==="GET"){
      const us=await env.DB.prepare("SELECT id,name,role FROM users WHERE active=1 ORDER BY name").all();
      const opts=us.results.map(x=>`<option value="${x.id}">${esc(x.name)} — ${esc(x.role)}</option>`).join("");
      const statusOpts=statuses.map(x=>`<option>${x}</option>`).join("");
      return new Response(html("New Lead",`<div class="card"><h2>Punch New Lead</h2><form method="post"><div class="grid">
      ${formField("Customer Name","name")}
      ${formField("Mobile","mobile","tel")}
      ${formField("Email","email","email")}
      ${formField("Lead Source","source")}
      ${formField("System Size","system_size")}
      <div><label>Status</label><select name="status">${statusOpts}</select></div>
      <div><label>Assign To</label><select name="assigned_to"><option value="">Unassigned</option>${opts}</select></div>
      ${formField("Follow-up","followup","datetime-local")}
      </div><p><label>Address</label><textarea name="address"></textarea></p><p><label>Notes</label><textarea name="notes"></textarea></p><button>Create Lead</button></form></div>` ,user),{headers:{"content-type":"text/html"}})
    }

    if(path==="/new" && method==="POST"){
      const f=await req.formData(), mobile=(f.get("mobile")||"").trim();
      if(mobile && await env.DB.prepare("SELECT id FROM leads WHERE mobile=?").bind(mobile).first())
        return new Response(html("Duplicate",`<div class="flash">This mobile number already exists. <a href="/">Return to leads</a></div>`,user),{headers:{"content-type":"text/html"}});
      const t=now(); const r=await env.DB.prepare(`INSERT INTO leads(name,mobile,email,address,source,system_size,status,assigned_to,followup,notes,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
        f.get("name"),mobile,f.get("email"),f.get("address"),f.get("source"),f.get("system_size"),f.get("status"),f.get("assigned_to")||null,f.get("followup"),f.get("notes"),user.id,t,t).run();
      await env.DB.prepare("INSERT INTO activities(lead_id,user_id,note,created_at) VALUES(?,?,?,?)").bind(r.meta.last_row_id,user.id,"Lead created",t).run();
      return redirect("/");
    }

    if(path.startsWith("/lead/")){
      const id=path.split("/")[2], lead=await env.DB.prepare(`SELECT l.*,u.name assigned FROM leads l LEFT JOIN users u ON u.id=l.assigned_to WHERE l.id=?`).bind(id).first();
      if(!lead)return new Response("Lead not found",{status:404});
      if(!["Managing Director","Director"].includes(user.role) && lead.assigned_to!==user.id)return new Response("Not authorized",{status:403});
      const us=await env.DB.prepare("SELECT id,name,role FROM users WHERE active=1 ORDER BY name").all();
      if(method==="POST"){
        const f=await req.formData(), t=now();
        await env.DB.prepare("UPDATE leads SET status=?,assigned_to=?,followup=?,notes=?,updated_at=? WHERE id=?").bind(f.get("status"),f.get("assigned_to")||null,f.get("followup"),f.get("notes"),t,id).run();
        await env.DB.prepare("INSERT INTO activities(lead_id,user_id,note,created_at) VALUES(?,?,?,?)").bind(id,user.id,f.get("activity")||"Lead updated",t).run();
        return redirect("/lead/"+id);
      }
      const acts=await env.DB.prepare("SELECT a.*,u.name FROM activities a LEFT JOIN users u ON u.id=a.user_id WHERE lead_id=? ORDER BY a.id DESC").bind(id).all();
      const opts=us.results.map(x=>`<option value="${x.id}" ${x.id===lead.assigned_to?"selected":""}>${esc(x.name)} — ${esc(x.role)}</option>`).join("");
      const statusOpts=statuses.map(x=>`<option ${x===lead.status?"selected":""}>${x}</option>`).join("");
      const timeline=acts.results.map(a=>`<p><b>${esc(a.name)}</b> · ${esc(a.created_at)}<br>${esc(a.note)}</p>`).join("");
      return new Response(html("Lead",`<div class="card"><h2>${esc(lead.name)}</h2><p>${esc(lead.mobile||"")} · ${esc(lead.email||"")}</p><form method="post"><div class="grid"><div><label>Status</label><select name="status">${statusOpts}</select></div><div><label>Assigned To</label><select name="assigned_to">${opts}</select></div>${formField("Follow-up","followup","datetime-local",lead.followup||"")}</div><p><label>Notes</label><textarea name="notes">${esc(lead.notes||"")}</textarea></p><p><label>Activity / Update</label><textarea name="activity"></textarea></p><button>Save Update</button></form></div><div class="card"><h3>Customer Details</h3><p><b>Address:</b> ${esc(lead.address||"")}<br><b>Source:</b> ${esc(lead.source||"")}<br><b>System:</b> ${esc(lead.system_size||"")}<br><b>Created:</b> ${esc(lead.created_at)}</p></div><div class="card"><h3>Activity Timeline</h3>${timeline}</div>`,user),{headers:{"content-type":"text/html"}});
    }

    if(path==="/users"){
      if(!["Managing Director","Director"].includes(user.role))return new Response("Not authorized",{status:403});
      const us=await env.DB.prepare("SELECT id,name,username,role,active FROM users ORDER BY name").all();
      return new Response(html("Users",`<div class="card"><h2>Users & Access</h2><table><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th></tr>${us.results.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.username)}</td><td>${esc(x.role)}</td><td>${x.active?"Active":"Disabled"}</td></tr>`).join("")}</table></div>`,user),{headers:{"content-type":"text/html"}});
    }

    const filter = ["Managing Director","Director"].includes(user.role) ? {sql:"",args:[]} : {sql:" AND assigned_to=?",args:[user.id]};
    const rows=await env.DB.prepare(`SELECT l.*,u.name assigned FROM leads l LEFT JOIN users u ON u.id=l.assigned_to WHERE 1=1${filter.sql} ORDER BY l.id DESC LIMIT 200`).bind(...filter.args).all();
    const body=`<div class="grid"><div class="card"><h3>Total Leads</h3><h1>${rows.results.length}</h1></div><div class="card"><a href="/new"><button>+ Punch New Lead</button></a></div></div>
    <div class="card"><h2>Lead Register</h2><div class="table"><table><tr><th>Lead</th><th>Mobile</th><th>Status</th><th>Assigned</th><th>Follow-up</th></tr>${rows.results.map(r=>`<tr><td><a href="/lead/${r.id}">${esc(r.name)}</a></td><td>${esc(r.mobile||"")}</td><td><span class="pill">${esc(r.status)}</span></td><td>${esc(r.assigned||"Unassigned")}</td><td>${esc(r.followup||"")}</td></tr>`).join("")}</table></div></div>${["Managing Director","Director"].includes(user.role)?`<div class="card"><a href="/users">Manage Users & Access</a></div>`:""}`;
    return new Response(html("Dashboard",body,user),{headers:{"content-type":"text/html"}});
   }catch(e){return new Response("CRM error: "+e.message,{status:500});}
 }
};
