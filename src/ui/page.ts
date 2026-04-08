export function buildHtml(): string {
  return String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Google Forms Control Room</title>
    <style>
      :root { --bg:#f2ede2; --panel:rgba(255,250,240,.9); --panel-strong:#fffaf0; --ink:#1e1d19; --muted:#665f54; --line:rgba(30,29,25,.12); --accent:#0f766e; --accent-soft:rgba(15,118,110,.12); --danger:#b42318; --shadow:0 18px 50px rgba(59,47,32,.12); }
      * { box-sizing:border-box; }
      body { margin:0; color:var(--ink); font-family:Georgia,"Times New Roman",serif; background:radial-gradient(circle at top left, rgba(15,118,110,.14), transparent 30%), radial-gradient(circle at top right, rgba(166,87,37,.16), transparent 26%), linear-gradient(180deg, #f7f1e7 0%, #eee4d2 100%); min-height:100vh; }
      .shell { width:min(1380px, calc(100vw - 32px)); margin:24px auto 48px; }
      .hero { display:grid; gap:16px; grid-template-columns:1.2fr .8fr; align-items:end; margin-bottom:18px; }
      .hero-card,.panel,.item-card,.response-card { background:var(--panel); border:1px solid var(--line); border-radius:24px; box-shadow:var(--shadow); backdrop-filter:blur(12px); }
      .hero-card { padding:28px; min-height:220px; position:relative; overflow:hidden; }
      .hero-card::after { content:""; position:absolute; inset:auto -40px -40px auto; width:180px; height:180px; border-radius:999px; background:rgba(15,118,110,.08); }
      .eyebrow { text-transform:uppercase; letter-spacing:.16em; font-size:12px; color:var(--muted); }
      h1,h2,h3 { margin:0; font-weight:600; }
      h1 { font-size:clamp(2.2rem, 4vw, 4.4rem); line-height:.94; max-width:10ch; }
      .lede { color:var(--muted); max-width:54ch; margin-top:14px; font-size:1rem; }
      .status-board { padding:24px; display:grid; gap:12px; }
      .status-chip { display:inline-flex; align-items:center; gap:8px; padding:8px 12px; border-radius:999px; background:var(--accent-soft); color:var(--accent); width:fit-content; font-size:.92rem; }
      .layout { display:grid; gap:18px; grid-template-columns:360px 1fr; }
      .panel { padding:20px; }
      .sticky { position:sticky; top:16px; }
      .section { display:grid; gap:12px; margin-bottom:18px; }
      .label { font-size:.9rem; color:var(--muted); }
      input,textarea,select { width:100%; border:1px solid var(--line); background:rgba(255,255,255,.8); border-radius:16px; padding:12px 14px; color:var(--ink); font:inherit; }
      textarea { min-height:96px; resize:vertical; }
      button,a.button-link { border:0; border-radius:999px; padding:12px 16px; font:inherit; cursor:pointer; transition:transform 160ms ease, opacity 160ms ease; text-decoration:none; display:inline-flex; justify-content:center; align-items:center; }
      button:hover,a.button-link:hover { transform:translateY(-1px); }
      .btn-primary { background:var(--accent); color:white; }
      .btn-secondary { background:#eaddc6; color:var(--ink); }
      .btn-danger { background:#fce9e7; color:var(--danger); }
      .row { display:flex; gap:10px; flex-wrap:wrap; }
      .grid-two { display:grid; gap:10px; grid-template-columns:repeat(2, minmax(0,1fr)); }
      .workspace { display:grid; gap:18px; }
      .summary { display:grid; gap:12px; grid-template-columns:repeat(4, minmax(0,1fr)); }
      .metric { padding:18px; border-radius:22px; background:var(--panel-strong); border:1px solid var(--line); }
      .metric strong { display:block; font-size:1.9rem; margin-top:6px; }
      .items-head { display:flex; justify-content:space-between; align-items:center; gap:12px; }
      .stack { display:grid; gap:14px; }
      .item-card,.response-card { padding:18px; }
      .item-top { display:flex; justify-content:space-between; gap:12px; align-items:start; margin-bottom:12px; }
      .badge { padding:6px 10px; border-radius:999px; background:#efe5d0; color:#6c4c1d; font-size:.82rem; white-space:nowrap; }
      .muted { color:var(--muted); }
      .options { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
      .pill { padding:8px 10px; border-radius:999px; background:#f6efe4; border:1px solid var(--line); }
      .flash { padding:12px 14px; border-radius:16px; border:1px solid var(--line); background:rgba(255,255,255,.72); display:none; }
      .flash.error { display:block; color:var(--danger); background:#fff1ef; }
      .flash.success { display:block; color:var(--accent); background:#ecfdf3; }
      .empty { padding:32px; border-radius:22px; border:1px dashed var(--line); text-align:center; color:var(--muted); }
      @media (max-width:1080px) { .hero,.layout { grid-template-columns:1fr; } .sticky { position:static; } .summary { grid-template-columns:repeat(2, minmax(0,1fr)); } }
      @media (max-width:640px) { .shell { width:min(100vw - 20px, 1380px); } .summary,.grid-two { grid-template-columns:1fr; } }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero">
        <article class="hero-card">
          <div class="eyebrow">Visual Console</div>
          <h1>Google Forms Control Room</h1>
          <p class="lede">Carga un formulario, inspecciona estructura y respuestas, y ejecuta edición visual sobre las mismas operaciones MCP que ya construiste.</p>
        </article>
        <aside class="hero-card status-board">
          <div class="eyebrow">Runtime</div>
          <div class="status-chip">Local UI over your existing OAuth token</div>
          <div class="muted">Port <strong>3210</strong> by default. Override with <code>UI_PORT</code>.</div>
          <div class="muted">La UI usa el mismo token local y las mismas clases de Google Forms del servidor MCP.</div>
        </aside>
      </section>
      <div class="layout">
        <aside class="panel sticky">
          <div class="section">
            <div class="eyebrow">Connect</div>
            <label class="label" for="formId">Google Form ID</label>
            <input id="formId" placeholder="1AbCdEfGhIjKlMn..." />
            <div class="row">
              <button class="btn-primary" id="loadBtn">Load form</button>
              <button class="btn-secondary" id="refreshBtn">Refresh</button>
            </div>
          </div>
          <div id="flash" class="flash"></div>
          <div class="section">
            <div class="eyebrow">Form Meta</div>
            <label class="label" for="formTitle">Title</label>
            <input id="formTitle" placeholder="Form title" />
            <label class="label" for="formDescription">Description</label>
            <textarea id="formDescription" placeholder="Form description"></textarea>
            <button class="btn-primary" id="saveMetaBtn">Save form info</button>
          </div>
          <div class="section">
            <div class="eyebrow">Publishing</div>
            <div class="grid-two">
              <button class="btn-secondary" id="publishBtn">Publish</button>
              <button class="btn-secondary" id="unpublishBtn">Unpublish</button>
            </div>
          </div>
          <div class="section">
            <div class="eyebrow">New Question</div>
            <label class="label" for="newType">Type</label>
            <select id="newType">
              <option value="text">Text</option>
              <option value="multiple_choice">Multiple choice</option>
              <option value="checkbox">Checkbox</option>
            </select>
            <label class="label" for="newTitle">Question title</label>
            <input id="newTitle" placeholder="What do you want to ask?" />
            <label class="label" for="newOptions">Options</label>
            <textarea id="newOptions" placeholder="One option per line"></textarea>
            <label class="label"><input id="newRequired" type="checkbox" style="width:auto; margin-right:8px;" />Required</label>
            <button class="btn-primary" id="createBtn">Add question</button>
          </div>
        </aside>
        <main class="workspace">
          <section class="summary" id="summary"></section>
          <section class="panel">
            <div class="items-head">
              <div>
                <div class="eyebrow">Structure</div>
                <h2>Questions</h2>
              </div>
              <a id="openFormLink" class="button-link btn-secondary" href="#" target="_blank" rel="noreferrer" style="display:none;">Open live form</a>
            </div>
            <div id="items" class="stack" style="margin-top:14px;"></div>
          </section>
          <section class="panel">
            <div class="items-head">
              <div>
                <div class="eyebrow">Responses</div>
                <h2>Latest submissions</h2>
              </div>
            </div>
            <div id="responses" class="stack" style="margin-top:14px;"></div>
          </section>
        </main>
      </div>
    </div>
    <script>
      const state = { formId:"", form:null };
      const $ = (id) => document.getElementById(id);
      const formIdInput = $("formId");
      const formTitleInput = $("formTitle");
      const formDescriptionInput = $("formDescription");
      const newTypeInput = $("newType");
      const newTitleInput = $("newTitle");
      const newOptionsInput = $("newOptions");
      const newRequiredInput = $("newRequired");
      const flash = $("flash");
      const itemsRoot = $("items");
      const responsesRoot = $("responses");
      const summaryRoot = $("summary");
      const openFormLink = $("openFormLink");
      function escapeHtml(value) { return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }
      function setFlash(message, kind) { flash.textContent = message || ""; flash.className = "flash" + (kind ? " " + kind : ""); }
      function optionLines(value) { return value.split("\\n").map((line) => line.trim()).filter(Boolean); }
      async function request(url, options = {}) {
        const response = await fetch(url, { headers:{ "Content-Type":"application/json" }, ...options });
        const payload = await response.json();
        if (!payload.ok) throw new Error(payload.error?.message || "Request failed");
        return payload.data;
      }
      async function loadForm() {
        const formId = formIdInput.value.trim();
        if (!formId) { setFlash("Enter a Google Form ID.", "error"); return; }
        setFlash("Loading form...", "success");
        try {
          const data = await request("/api/form?formId=" + encodeURIComponent(formId));
          state.formId = formId;
          state.form = data;
          hydrateControls();
          render();
          setFlash("Form loaded.", "success");
        } catch (error) {
          setFlash(error.message, "error");
        }
      }
      async function runAction(type, payload) {
        if (!state.formId) { setFlash("Load a form first.", "error"); return; }
        setFlash("Applying " + type + "...", "success");
        try {
          const data = await request("/api/action", { method:"POST", body:JSON.stringify({ type, payload }) });
          state.form = data;
          hydrateControls();
          render();
          setFlash(type + " completed.", "success");
        } catch (error) {
          setFlash(error.message, "error");
        }
      }
      function hydrateControls() {
        if (!state.form) return;
        formTitleInput.value = state.form.info?.title || "";
        formDescriptionInput.value = state.form.info?.description || "";
        if (state.form.responderUri) {
          openFormLink.href = state.form.responderUri;
          openFormLink.style.display = "inline-flex";
        } else {
          openFormLink.style.display = "none";
        }
      }
      function renderSummary() {
        const data = state.form;
        const cards = [
          ["Items", String(data?.itemCount || 0)],
          ["Responses", String(data?.responseCount || 0)],
          ["Published", data?.publishSettings?.publishState?.isPublished ? "Yes" : "No"],
          ["Revision", data?.revisionId ? data.revisionId.slice(0, 8) + "…" : "—"],
        ];
        summaryRoot.innerHTML = cards.map(([label, value]) => '<div class="metric"><div class="muted">' + label + '</div><strong>' + value + '</strong></div>').join("");
      }
      function itemEditor(item) {
        const options = (item.options || []).join("\\n");
        return '<article class="item-card" data-item-id="' + (item.itemId || "") + '" data-index="' + item.index + '">' +
          '<div class="item-top"><div><div class="eyebrow">Question #' + (item.index + 1) + '</div><h3>' + escapeHtml(item.title || "Untitled question") + '</h3><div class="muted">itemId: ' + escapeHtml(item.itemId || "n/a") + '</div></div><span class="badge">' + escapeHtml(item.kind) + '</span></div>' +
          '<div class="grid-two"><div><label class="label">Title</label><input data-field="title" value="' + escapeHtml(item.title || "") + '" /></div><div><label class="label">Move to index</label><div class="row"><input data-field="newIndex" type="number" min="0" value="' + item.index + '" /><button class="btn-secondary" data-action="move">Move</button></div></div></div>' +
          '<div style="margin-top:10px;"><label class="label">Description</label><textarea data-field="description">' + escapeHtml(item.description || "") + '</textarea></div>' +
          '<div style="margin-top:10px;"><label class="label"><input data-field="required" type="checkbox" style="width:auto; margin-right:8px;" ' + (item.required ? "checked" : "") + ' />Required</label></div>' +
          ((item.kind === "multiple_choice" || item.kind === "checkbox") ? '<div style="margin-top:10px;"><label class="label">Options</label><textarea data-field="options">' + escapeHtml(options) + '</textarea></div>' : "") +
          (item.options?.length ? '<div class="options">' + item.options.map((option) => '<span class="pill">' + escapeHtml(option) + '</span>').join("") + '</div>' : "") +
          '<div class="row" style="margin-top:12px;"><button class="btn-primary" data-action="save">Save</button><button class="btn-danger" data-action="delete">Delete</button></div></article>';
      }
      function renderItems() {
        const items = state.form?.items || [];
        itemsRoot.innerHTML = items.length ? items.map(itemEditor).join("") : '<div class="empty">No items found in this form.</div>';
      }
      function renderResponses() {
        const responses = state.form?.responses || [];
        responsesRoot.innerHTML = responses.length ? responses.map((response) => {
          const answers = Object.entries(response.answers || {}).map(([questionId, answer]) => {
            const values = (answer.textAnswers?.answers || []).map((entry) => entry.value).filter(Boolean).join(", ");
            return '<div class="pill"><strong>' + escapeHtml(questionId) + '</strong>: ' + escapeHtml(values || "—") + '</div>';
          }).join("");
          return '<article class="response-card"><div class="item-top"><div><div class="eyebrow">Response</div><h3>' + escapeHtml(response.responseId || "unknown") + '</h3></div><span class="badge">' + escapeHtml(response.lastSubmittedTime || "pending") + '</span></div><div class="options">' + (answers || '<span class="muted">No parsed answers.</span>') + '</div></article>';
        }).join("") : '<div class="empty">No responses yet for this form.</div>';
      }
      function render() { renderSummary(); renderItems(); renderResponses(); }
      $("loadBtn").addEventListener("click", loadForm);
      $("refreshBtn").addEventListener("click", () => state.formId ? loadForm() : setFlash("Load a form first.", "error"));
      $("saveMetaBtn").addEventListener("click", () => runAction("update_form_info", { formId:state.formId, title:formTitleInput.value.trim(), description:formDescriptionInput.value.trim() }));
      $("publishBtn").addEventListener("click", () => runAction("set_publish_settings", { formId:state.formId, published:true }));
      $("unpublishBtn").addEventListener("click", () => runAction("set_publish_settings", { formId:state.formId, published:false }));
      $("createBtn").addEventListener("click", () => {
        const base = { formId:state.formId, title:newTitleInput.value.trim(), required:newRequiredInput.checked };
        if (newTypeInput.value === "text") { runAction("add_text_question", base); return; }
        const payload = { ...base, options:optionLines(newOptionsInput.value) };
        runAction(newTypeInput.value === "multiple_choice" ? "add_multiple_choice_question" : "add_checkbox_question", payload);
      });
      itemsRoot.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const card = button.closest(".item-card");
        const itemId = card.dataset.itemId || undefined;
        const currentIndex = Number(card.dataset.index);
        const title = card.querySelector('[data-field="title"]').value.trim();
        const description = card.querySelector('[data-field="description"]').value.trim();
        const required = card.querySelector('[data-field="required"]').checked;
        const optionsInput = card.querySelector('[data-field="options"]');
        if (button.dataset.action === "save") {
          runAction("update_question", { formId:state.formId, itemId, title, description, required, ...(optionsInput ? { options:optionLines(optionsInput.value) } : {}) });
          return;
        }
        if (button.dataset.action === "delete") {
          runAction("delete_item", { formId:state.formId, itemId });
          return;
        }
        if (button.dataset.action === "move") {
          const newIndex = Number(card.querySelector('[data-field="newIndex"]').value);
          runAction("move_item", { formId:state.formId, itemId, currentIndex, newIndex });
        }
      });
      render();
    </script>
  </body>
</html>`;
}
