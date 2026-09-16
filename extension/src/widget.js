(function () {
  const WIDGET_ID = "kronk-gpa-widget";
  const GRADE_OPTIONS = ["A", "B", "C", "D", "Fail"];
  let expanded = false;
  let simulating = false;
  let simOverrides = {};
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
    if (m.simulated) tr.classList.add("kronk-gpa-simulated-row");
    return tr;
  }

  function gradeSelect(moduleId) {
    const select = document.createElement("select");
    select.className = "kronk-gpa-grade-select";

    const noneOption = document.createElement("option");
    noneOption.value = "";
    noneOption.textContent = "—";
    select.appendChild(noneOption);

    GRADE_OPTIONS.forEach((grade) => {
      const opt = document.createElement("option");
      opt.value = grade;
      opt.textContent = grade;
      select.appendChild(opt);
    });

    select.value = simOverrides[moduleId] ?? "";
    select.addEventListener("click", (e) => e.stopPropagation());
    select.addEventListener("change", () => {
      if (select.value === "") {
        delete simOverrides[moduleId];
      } else {
        simOverrides[moduleId] = select.value;
      }
      if (lastResult) renderPanel(lastResult);
    });
    return select;
  }

  function simRow(moduleId, title, credits, realGrade) {
    const tr = document.createElement("tr");
    tr.append(
      cell(title),
      cell(realGrade || "—"),
      cell(String(credits))
    );
    const selectCell = document.createElement("td");
    selectCell.appendChild(gradeSelect(moduleId));
    tr.appendChild(selectCell);
    return tr;
  }

  function renderSimulationPanel(overall) {
    const container = document.createElement("div");
    container.className = "kronk-gpa-sim";

    const table = document.createElement("table");
    table.className = "kronk-gpa-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Module", "Note réelle", "Créd.", "Note simulée"].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const tbody = document.createElement("tbody");
    overall.currentPeriod.includedModules.forEach((m) => {
      tbody.appendChild(simRow(m.id, m.title, m.credits, m.projectedGrade));
    });
    overall.currentPeriod.excludedModules.forEach((m) => {
      if (!m.credits) return;
      tbody.appendChild(simRow(m.id, m.title, m.credits, null));
    });

    table.append(thead, tbody);
    container.appendChild(table);

    const simulated = window.KronkGpa.simulateGpa(overall, simOverrides);
    const result = document.createElement("div");
    result.className = "kronk-gpa-sim-result";
    const simText = simulated.gpa !== null ? simulated.gpa.toFixed(2) : "—";
    result.textContent = `GPA simulé : ${simText}`;
    container.appendChild(result);

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "kronk-gpa-reset";
    resetBtn.textContent = "Réinitialiser la simulation";
    resetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      simOverrides = {};
      if (lastResult) renderPanel(lastResult);
    });
    container.appendChild(resetBtn);

    return container;
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

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "kronk-gpa-sim-toggle";
    toggleBtn.textContent = simulating ? "Fermer la simulation" : "Simuler mes notes";
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      simulating = !simulating;
      renderPanel(overall);
    });
    panel.appendChild(toggleBtn);

    if (simulating) {
      panel.appendChild(renderSimulationPanel(overall));
      return;
    }

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

  function renderWidget(overall, options = {}) {
    const el = ensureWidget();
    if (!el) return;
    lastResult = overall;

    const valueEl = el.querySelector(".kronk-gpa-value");
    const detailEl = el.querySelector(".kronk-gpa-detail");
    el.classList.remove("kronk-gpa-error", "kronk-gpa-stale");

    if (overall.gpa === null) {
      valueEl.textContent = "N/A";
      detailEl.textContent = "Pas encore de données disponibles.";
    } else {
      const moduleCount = overall.currentPeriod.includedModules?.length || 0;
      valueEl.textContent = overall.gpa.toFixed(2);
      const suffix = options.stale
        ? "· dernière valeur connue, actualisation…"
        : "· clique pour le détail";
      detailEl.textContent = `${moduleCount} module(s) actif(s) ce semestre ${suffix}`;
    }

    if (options.stale) {
      el.classList.add("kronk-gpa-stale");
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
    el.classList.remove("kronk-gpa-stale");
    valueEl.textContent = "Erreur";
    detailEl.textContent = err?.message || "Impossible de calculer le GPA.";
  }

  function renderSessionExpired() {
    const el = ensureWidget();
    if (!el) return;
    const valueEl = el.querySelector(".kronk-gpa-value");
    const detailEl = el.querySelector(".kronk-gpa-detail");
    el.classList.add("kronk-gpa-error");
    el.classList.remove("kronk-gpa-stale");
    valueEl.textContent = "Session expirée";
    detailEl.textContent = "Recharge la page et reconnecte-toi pour continuer.";
  }

  window.KronkGpa = window.KronkGpa || {};
  Object.assign(window.KronkGpa, {
    mountWidget,
    renderWidget,
    renderError,
    renderSessionExpired,
  });
})();
