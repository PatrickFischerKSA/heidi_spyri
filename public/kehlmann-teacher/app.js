const app = document.body;
const config = window.KEHLMANN_TEACHER_CONFIG || {};

const state = {
  loading: true,
  error: "",
  overview: null
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function request(url) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Anfrage fehlgeschlagen.");
  }

  return response.json();
}

function classroom() {
  return state.overview?.classes[0] || null;
}

function students() {
  return (state.overview?.classes || [])
    .flatMap((entry) => entry.students || [])
    .sort((left, right) => right.progress.percent - left.progress.percent);
}

function averageProgress() {
  const entries = students();
  if (!entries.length) {
    return 0;
  }

  return Math.round(entries.reduce((sum, student) => sum + student.progress.percent, 0) / entries.length);
}

function renderLessonLinks() {
  const teacherEntryUrl = escapeHtml(config.teacherEntryUrl || "/teacher-entry");
  return state.overview.lessons.map((lesson) => `
    <article class="lesson-link-card">
      <h3>${escapeHtml(lesson.title)}</h3>
      <p>${escapeHtml(lesson.summary)}</p>
      ${lesson.materials?.length ? `
        <div class="teacher-material-list">
          ${lesson.materials.map((material) => `
            <a class="material-pill" href="${escapeHtml(material.openUrl)}" target="_blank" rel="noreferrer">
              <span>${escapeHtml(material.title)}</span>
              <small>${escapeHtml(material.sourceTitle || "Material")}</small>
            </a>
          `).join("")}
        </div>
      ` : ""}
      <div class="lesson-actions">
        <a class="button secondary" href="/open/lesson/${escapeHtml(lesson.id)}" target="_blank" rel="noreferrer">Reader öffnen</a>
        <a class="button secondary" href="${teacherEntryUrl}?lesson=${encodeURIComponent(lesson.id)}" target="_blank" rel="noreferrer">Materialansicht</a>
      </div>
    </article>
  `).join("");
}

function answerLine(label, value) {
  return hasContent(value)
    ? `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`
    : "";
}

function hasContent(value) {
  return Boolean(String(value || "").trim());
}

function renderStudentEntryAnswers(entry) {
  const focusAnswers = (entry.focusAnswers || []).filter((item) => hasContent(item.answer));
  const theoryResponses = (entry.theoryResponses || []).filter((section) => (
    [...(section.guidingAnswers || []), ...(section.transferAnswers || [])].some(hasContent)
  ));

  if (!entry.hasContent && !focusAnswers.length && !theoryResponses.length) {
    return "";
  }

  return `
    <details class="answer-detail">
      <summary>${escapeHtml(`${entry.passageLabel || entry.title}: ${entry.title}`)}</summary>
      <div class="answer-body">
        ${answerLine("Beobachtung", entry.answers?.observation)}
        ${answerLine("Textanker", entry.answers?.evidence)}
        ${answerLine("Deutung", entry.answers?.interpretation)}
        ${answerLine("Theoriebezug", entry.answers?.theory)}
        ${answerLine("Revision", entry.answers?.revision)}
        ${focusAnswers.length ? `
          <h4>Fokusantworten</h4>
          ${focusAnswers.map((item) => `
            <div class="answer-block">
              <strong>${escapeHtml(item.prompt)}</strong>
              <p>${escapeHtml(item.answer)}</p>
            </div>
          `).join("")}
        ` : ""}
        ${theoryResponses.length ? `
          <h4>Theorie- und Transferantworten</h4>
          ${theoryResponses.map((section) => `
            <div class="answer-block">
              <strong>${escapeHtml(section.title)}</strong>
              ${[...(section.guidingAnswers || []), ...(section.transferAnswers || [])]
                .filter(hasContent)
                .map((answer) => `<p>${escapeHtml(answer)}</p>`)
                .join("")}
            </div>
          `).join("")}
        ` : ""}
      </div>
    </details>
  `;
}

function renderStudentMaterialAnswers(material) {
  const answeredQuestions = (material.questions || []).filter((item) => hasContent(item.answer));
  if (!material.hasContent && !answeredQuestions.length) {
    return "";
  }

  return `
    <details class="answer-detail material-answer-detail">
      <summary>${escapeHtml(material.title)}</summary>
      <div class="answer-body">
        <div class="row">
          ${material.openUrl ? `<a class="button secondary" href="${escapeHtml(material.openUrl)}" target="_blank" rel="noreferrer">Material öffnen</a>` : ""}
        </div>
        ${answerLine("Arbeitsauftrag", material.taskResponse)}
        ${answeredQuestions.length ? `
          <h4>Materialfragen</h4>
          ${answeredQuestions.map((item) => `
            <div class="answer-block">
              <strong>${escapeHtml(item.prompt)}</strong>
              <p>${escapeHtml(item.answer)}</p>
              ${item.expected ? `<small>${escapeHtml(`Erwartungshorizont: ${item.expected}`)}</small>` : ""}
            </div>
          `).join("")}
        ` : ""}
      </div>
    </details>
  `;
}

function renderStudentWork(student) {
  const lessonBlocks = (student.workDetail || [])
    .map((lesson) => {
      const entryMarkup = (lesson.entries || []).map(renderStudentEntryAnswers).filter(Boolean).join("");
      const materialMarkup = (lesson.materials || []).map(renderStudentMaterialAnswers).filter(Boolean).join("");
      if (!entryMarkup && !materialMarkup) {
        return "";
      }

      return `
        <details class="lesson-answer-detail">
          <summary>${escapeHtml(lesson.title)}</summary>
          <div class="lesson-answer-body">
            ${materialMarkup ? `<h4>Materialantworten</h4>${materialMarkup}` : ""}
            ${entryMarkup ? `<h4>Passagenantworten</h4>${entryMarkup}` : ""}
          </div>
        </details>
      `;
    })
    .filter(Boolean)
    .join("");

  return lessonBlocks || '<div class="empty">Noch keine gespeicherten Antworten.</div>';
}

function renderStudents() {
  const entries = students();
  if (!entries.length) {
    return '<div class="empty">Noch keine Lernenden angemeldet.</div>';
  }

  return entries.map((student) => `
    <article class="student-card">
      <div class="student-head">
        <div>
          <h3>${escapeHtml(student.displayName)}</h3>
          <p>${escapeHtml(`Zuletzt aktiv: ${student.lastSeenAt ? new Date(student.lastSeenAt).toLocaleString("de-CH") : "-"}`)}</p>
        </div>
        <span class="badge">${escapeHtml(`${student.progress.percent}%`)}</span>
      </div>
      <div class="student-metrics">
        <span>${escapeHtml(`${student.progress.completedEntries}/${student.progress.totalEntries} Passagen`)}</span>
        <span>${escapeHtml(`${student.progress.theoryEntries} Theoriebezüge`)}</span>
        <span>${escapeHtml(`${student.progress.evidenceEntries} Textanker`)}</span>
        <span>${escapeHtml(`Modus: ${student.lastMode}`)}</span>
      </div>
      <div class="student-metrics">
        <span>${escapeHtml(`Reviews geschrieben: ${student.peerReview.completedAssignedCount}/${student.peerReview.assignedCount}`)}</span>
        <span>${escapeHtml(`Reviews erhalten: ${student.peerReview.receivedCompletedCount}/${student.peerReview.receivedCount}`)}</span>
      </div>
      <div class="lesson-progress-list">
        ${student.progress.lessonProgress.map((lesson) => `
          <div class="lesson-progress-row">
            <span>${escapeHtml(lesson.title)}</span>
            <strong>${escapeHtml(`${lesson.completedEntries}/${lesson.totalEntries}`)}</strong>
          </div>
        `).join("")}
      </div>
      <div class="student-work-section">
        <h4>Antworten und Materialien</h4>
        ${renderStudentWork(student)}
      </div>
    </article>
  `).join("");
}

function renderGuide() {
  return `
    <article class="panel">
      <div class="panel-head">
        <div>
          <div class="eyebrow">Betrieb</div>
          <h2>Nur Namen, alle Lektionen</h2>
        </div>
      </div>
      <div class="instruction-grid">
        <div class="instruction-card">
          <strong>1. Öffnen</strong>
          <p>Lernende öffnen <em>${escapeHtml(config.openUrl || "/open")}</em>, tragen ihren Namen ein und starten.</p>
        </div>
        <div class="instruction-card">
          <strong>2. Arbeiten</strong>
          <p>Alle Lektionen sind zugänglich und sollen bearbeitet werden.</p>
        </div>
        <div class="instruction-card">
          <strong>3. Beobachten</strong>
          <p>Dieses Dashboard zeigt Fortschritt, Materialien und gespeicherte Antworten der Lernenden.</p>
        </div>
      </div>
    </article>
  `;
}

function render() {
  if (state.loading) {
    app.innerHTML = '<main class="teacher-shell"><section class="panel"><h1>Lädt ...</h1><p>Dashboard wird vorbereitet.</p></section></main>';
    return;
  }

  if (state.error) {
    app.innerHTML = `<main class="teacher-shell"><section class="panel"><h1>Dashboard nicht verfügbar</h1><p>${escapeHtml(state.error)}</p></section></main>`;
    return;
  }

  const reviewSummary = (state.overview?.classes || []).reduce((summary, entry) => ({
    totalAssignments: summary.totalAssignments + (entry.peerReviewSummary?.totalAssignments || 0),
    completedReviews: summary.completedReviews + (entry.peerReviewSummary?.completedReviews || 0),
    pendingReviews: summary.pendingReviews + (entry.peerReviewSummary?.pendingReviews || 0)
  }), { totalAssignments: 0, completedReviews: 0, pendingReviews: 0 });

  app.innerHTML = `
    <main class="teacher-shell">
      <section class="hero panel">
        <div>
          <div class="eyebrow">Lehrer*innen-Dashboard</div>
          <h1>Heidi Lernstand</h1>
          <p>Namen genügen; alle Lektionen sind Teil des Parcours.</p>
        </div>
        <div class="hero-actions">
          <a class="button secondary" href="${escapeHtml(config.teacherEntryUrl || "/teacher-entry")}">Lehrer*inneneingang</a>
          <a class="button secondary" href="${escapeHtml(config.openUrl || "/open")}">Reader öffnen</a>
          <a class="button secondary" href="/">Startseite</a>
        </div>
      </section>

      <section class="status-strip">
        <article class="status-card">
          <div class="eyebrow">Lernende</div>
          <strong>${escapeHtml(students().length)}</strong>
        </article>
        <article class="status-card">
          <div class="eyebrow">Durchschnitt</div>
          <strong>${escapeHtml(`${averageProgress()}%`)}</strong>
        </article>
        <article class="status-card">
          <div class="eyebrow">Reviews</div>
          <strong>${escapeHtml(`${reviewSummary.completedReviews}/${reviewSummary.totalAssignments}`)}</strong>
        </article>
      </section>

      ${renderGuide()}

      <section class="panel">
        <div class="panel-head">
          <div>
            <div class="eyebrow">Lektionsübersicht</div>
            <h2>Alle Lektionen und Materialien</h2>
          </div>
        </div>
        <div class="lesson-link-grid">
          ${renderLessonLinks()}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <div class="eyebrow">Fortschritt</div>
            <h2>Lernende</h2>
          </div>
        </div>
        <div class="student-grid">
          ${renderStudents()}
        </div>
      </section>
    </main>
  `;
}

async function loadOverview() {
  state.loading = true;
  render();

  try {
    state.overview = await request("/reader-api/teacher/bootstrap");
    state.loading = false;
    state.error = "";
    render();
  } catch (error) {
    state.loading = false;
    state.error = error.message;
    render();
  }
}

loadOverview();
