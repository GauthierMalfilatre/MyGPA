(function () {
  const WIDGET_ID = "kronk-gpa-widget";

  function ensureWidget() {
    let el = document.getElementById(WIDGET_ID);
    if (!el && document.body) {
      el = document.createElement("div");
      el.id = WIDGET_ID;
      el.innerHTML = `
        <div class="kronk-gpa-header">GPA réel</div>
        <div class="kronk-gpa-value">—</div>
        <div class="kronk-gpa-detail"></div>
      `;
      document.body.appendChild(el);
    }
    return el;
  }

  function mountWidget() {
    if (document.body) {
      ensureWidget();
    } else {
      document.addEventListener("DOMContentLoaded", ensureWidget, { once: true });
    }
  }

  function renderWidget(result) {
    const el = ensureWidget();
    if (!el) return;
    const valueEl = el.querySelector(".kronk-gpa-value");
    const detailEl = el.querySelector(".kronk-gpa-detail");
    el.classList.remove("kronk-gpa-error");

    if (result.gpa === null) {
      valueEl.textContent = "N/A";
      detailEl.textContent = "Aucun module avec progression pour l'instant.";
      return;
    }

    valueEl.textContent = result.gpa.toFixed(2);
    detailEl.textContent = `${result.includedModules.length} module(s) actif(s) · ${result.totalCredits} crédits`;
    detailEl.title = result.includedModules
      .map((m) => `${m.title}: ${m.projectedGrade} (${m.credits} cr.)`)
      .join("\n");
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
