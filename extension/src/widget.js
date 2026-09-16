(function () {
  const WIDGET_ID = "kronk-gpa-widget";
  let expanded = false;
  let lastResult = null;

  function ensureWidget() {
    let el = document.getElementById(WIDGET_ID);
    if (!el && document.body) {
      el = document.createElement("div");
      el.id = WIDGET_ID;

      const summary = document.createElement("div");
      summary.className = "kronk-gpa-summary";

      const header = document.createElement("div");
      header.className = "kronk-gpa-header";
      header.textContent = "GPA réel";

      const value = document.createElement("div");
      value.className = "kronk-gpa-value";
      value.textContent = "—";

      const detail = document.createElement("div");
      detail.className = "kronk-gpa-detail";

      summary.append(header, value, detail);

      const panel = document.createElement("div");
      panel.className = "kronk-gpa-panel";

      el.append(summary, panel);

      el.addEventListener("click", (event) => {
        if (event.target.closest(".kronk-gpa-panel")) return;
        toggleExpanded();
      });
      document.body.appendChild(el);
    }
    return el;
  }

  function toggleExpanded() {
    expanded = !expanded;
    const el = document.getElementById(WIDGET_ID);
    if (!el) return;
    el.classList.toggle("kronk-gpa-expanded", expanded);
    if (expanded && lastResult) {
      renderPanel(lastResult);
    }
  }

  function mountWidget() {
    if (document.body) {
      ensureWidget();
    } else {
      document.addEventListener("DOMContentLoaded", ensureWidget, { once: true });
    }
  }

  function cell(text) {
    const td = document.createElement("td");
    td.textContent = text;
    return td;
  }

  function moduleRow(m) {
    const avg = m.averageScore !== null && m.averageScore !== undefined
      ? `${m.averageScore.toFixed(0)}/500`
      : "—";
    const progress = m.totalCount ? `${m.validatedCount ?? 0}/${m.totalCount}` : "—";

    const tr = document.createElement("tr");
    tr.append(
      cell(m.title),
      cell(m.projectedGrade),
      cell(avg),
      cell(progress),
      cell(String(m.credits))
    );
    return tr;
  }

  function renderPanel(overall) {
    const el = document.getElementById(WIDGET_ID);
    if (!el) return;
    const panel = el.querySelector(".kronk-gpa-panel");
    panel.textContent = "";

    const summary = document.createElement("div");
    summary.className = "kronk-gpa-blend";
    const officialText = overall.officialGpa !== null && overall.officialGpa !== undefined
      ? overall.officialGpa.toFixed(2)
      : "—";
    const currentText = overall.currentPeriod.gpa !== null
      ? overall.currentPeriod.gpa.toFixed(2)
      : "—";
    summary.textContent = `Officiel (${overall.priorCredits} cr.): ${officialText} · Ce semestre (${overall.currentPeriod.totalCredits} cr.): ${currentText}`;
    panel.appendChild(summary);

    const modules = overall.currentPeriod.includedModules || [];
    if (!modules.length) {
      const empty = document.createElement("div");
      empty.className = "kronk-gpa-empty";
      empty.textContent = "Aucun module avec progression pour l'instant.";
      panel.appendChild(empty);
      return;
    }

    const table = document.createElement("table");
    table.className = "kronk-gpa-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Module", "Note", "Moy. score", "Comp.", "Créd."].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const tbody = document.createElement("tbody");
    modules.forEach((m) => tbody.appendChild(moduleRow(m)));

    table.append(thead, tbody);
    panel.appendChild(table);
  }

  function renderWidget(overall) {
    const el = ensureWidget();
    if (!el) return;
    lastResult = overall;

    const valueEl = el.querySelector(".kronk-gpa-value");
    const detailEl = el.querySelector(".kronk-gpa-detail");
    el.classList.remove("kronk-gpa-error");

    if (overall.gpa === null) {
      valueEl.textContent = "N/A";
      detailEl.textContent = "Pas encore de données disponibles.";
    } else {
      const moduleCount = overall.currentPeriod.includedModules?.length || 0;
      valueEl.textContent = overall.gpa.toFixed(2);
      detailEl.textContent = `${moduleCount} module(s) actif(s) ce semestre · clique pour le détail`;
    }

    if (expanded) {
      renderPanel(overall);
    }
  }

  function renderError(err) {
    const el = ensureWidget();
    if (!el) return;
    const valueEl = el.querySelector(".kronk-gpa-value");
    const detailEl = el.querySelector(".kronk-gpa-detail");
    el.classList.add("kronk-gpa-error");
    valueEl.textContent = "Erreur";
    detailEl.textContent = err?.message || "Impossible de calculer le GPA.";
  }

  window.KronkGpa = window.KronkGpa || {};
  Object.assign(window.KronkGpa, { mountWidget, renderWidget, renderError });
})();
