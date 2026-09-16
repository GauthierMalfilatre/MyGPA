(function () {
  const WIDGET_ID = "mygpa-widget";
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
      summary.className = "mygpa-summary";

      const header = document.createElement("div");
      header.className = "mygpa-header";
      header.textContent = "GPA réel";

      const value = document.createElement("div");
      value.className = "mygpa-value";
      value.textContent = "—";

      const detail = document.createElement("div");
      detail.className = "mygpa-detail";

      summary.append(header, value, detail);

      const panel = document.createElement("div");
      panel.className = "mygpa-panel";

      el.append(summary, panel);

      el.addEventListener("click", (event) => {
        if (event.target.closest(".mygpa-panel")) return;
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
    el.classList.toggle("mygpa-expanded", expanded);
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
    const gradeLabel = m.atRisk ? `⚠ ${m.projectedGrade}` : m.projectedGrade;

    const tr = document.createElement("tr");
    tr.append(
      cell(m.title),
      cell(gradeLabel),
      cell(avg),
      cell(progress),
      cell(String(m.credits))
    );
    if (m.simulated) tr.classList.add("mygpa-simulated-row");
    if (m.atRisk) tr.classList.add("mygpa-at-risk-row");
    return tr;
  }

  function gradeSelect(moduleId) {
    const select = document.createElement("select");
    select.className = "mygpa-grade-select";

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
    container.className = "mygpa-sim";

    const table = document.createElement("table");
    table.className = "mygpa-table";

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

    const simulated = window.MyGpa.simulateGpa(overall, simOverrides);
    const result = document.createElement("div");
    result.className = "mygpa-sim-result";
    const simText = simulated.gpa !== null ? simulated.gpa.toFixed(2) : "—";
    result.textContent = `GPA simulé : ${simText}`;
    container.appendChild(result);

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "mygpa-reset";
    resetBtn.textContent = "Réinitialiser la simulation";
    resetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      simOverrides = {};
      if (lastResult) renderPanel(lastResult);
    });
    container.appendChild(resetBtn);

    return container;
  }

  function renderTargetSection(overall) {
    const container = document.createElement("div");
    container.className = "mygpa-target";

    const label = document.createElement("label");
    label.className = "mygpa-target-label";
    label.textContent = "Objectif GPA";

    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.01";
    input.min = "0";
    input.max = "4";
    input.className = "mygpa-target-input";
    input.placeholder = "ex: 3.70";
    input.addEventListener("click", (e) => e.stopPropagation());

    const result = document.createElement("span");
    result.className = "mygpa-target-result";

    function updateResult() {
      const target = parseFloat(input.value);
      if (Number.isNaN(target)) {
        result.textContent = "";
        return;
      }
      const req = window.MyGpa.requiredGradeForTarget(overall, target);
      if (req.reason === "no-remaining-credits") {
        result.textContent = "Tous les crédits du semestre sont déjà pris en compte.";
      } else if (!req.achievable) {
        result.textContent = `Non atteignable (nécessiterait mieux que A sur les ${req.remainingCredits} cr. restants).`;
      } else {
        result.textContent = `Besoin de ${req.requiredGrade} en moyenne sur les ${req.remainingCredits} cr. restants.`;
      }
    }

    input.addEventListener("input", (e) => {
      e.stopPropagation();
      updateResult();
    });

    container.append(label, input, result);
    return container;
  }

  function renderPanel(overall) {
    const el = document.getElementById(WIDGET_ID);
    if (!el) return;
    const panel = el.querySelector(".mygpa-panel");
    panel.textContent = "";

    const summary = document.createElement("div");
    summary.className = "mygpa-blend";
    const officialText = overall.officialGpa !== null && overall.officialGpa !== undefined
      ? overall.officialGpa.toFixed(2)
      : "—";
    const currentText = overall.currentPeriod.gpa !== null
      ? overall.currentPeriod.gpa.toFixed(2)
      : "—";
    summary.textContent = `Officiel (${overall.priorCredits} cr.): ${officialText} · Ce semestre (${overall.currentPeriod.totalCredits} cr.): ${currentText}`;
    panel.appendChild(summary);

    panel.appendChild(renderTargetSection(overall));

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "mygpa-sim-toggle";
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
      empty.className = "mygpa-empty";
      empty.textContent = "Aucun module avec progression pour l'instant.";
      panel.appendChild(empty);
      return;
    }

    const table = document.createElement("table");
    table.className = "mygpa-table";

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

    const valueEl = el.querySelector(".mygpa-value");
    const detailEl = el.querySelector(".mygpa-detail");
    el.classList.remove("mygpa-error", "mygpa-stale", "mygpa-has-risk");

    if (overall.gpa === null) {
      valueEl.textContent = "N/A";
      detailEl.textContent = "Pas encore de données disponibles.";
    } else {
      const moduleCount = overall.currentPeriod.includedModules?.length || 0;
      const riskCount = overall.currentPeriod.atRiskModules?.length || 0;
      valueEl.textContent = overall.gpa.toFixed(2);
      const suffix = options.stale
        ? "· dernière valeur connue, actualisation…"
        : "· clique pour le détail";
      const riskSuffix = riskCount > 0 ? ` · ⚠ ${riskCount} à risque` : "";
      detailEl.textContent = `${moduleCount} module(s) actif(s) ce semestre${riskSuffix} ${suffix}`;
      if (riskCount > 0) el.classList.add("mygpa-has-risk");
    }

    if (options.stale) {
      el.classList.add("mygpa-stale");
    }

    if (expanded) {
      renderPanel(overall);
    }
  }

  function renderError(err) {
    const el = ensureWidget();
    if (!el) return;
    const valueEl = el.querySelector(".mygpa-value");
    const detailEl = el.querySelector(".mygpa-detail");
    el.classList.add("mygpa-error");
    el.classList.remove("mygpa-stale");
    valueEl.textContent = "Erreur";
    detailEl.textContent = err?.message || "Impossible de calculer le GPA.";
  }

  function renderSessionExpired() {
    const el = ensureWidget();
    if (!el) return;
    const valueEl = el.querySelector(".mygpa-value");
    const detailEl = el.querySelector(".mygpa-detail");
    el.classList.add("mygpa-error");
    el.classList.remove("mygpa-stale");
    valueEl.textContent = "Session expirée";
    detailEl.textContent = "Recharge la page et reconnecte-toi pour continuer.";
  }

  window.MyGpa = window.MyGpa || {};
  Object.assign(window.MyGpa, {
    mountWidget,
    renderWidget,
    renderError,
    renderSessionExpired,
  });
})();
