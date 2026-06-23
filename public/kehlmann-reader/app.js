import { buildTask, pdfSource, readerModules, starterPrompt, theoryResources, lessonSets } from "./data.js";
import { buildParcoursMarkdown } from "./export.js";

const mode = window.KEHLMANN_READER_MODE || "open";
const modeLabel = window.KEHLMANN_READER_MODE_LABEL || "Offene Version";
const config = window.KEHLMANN_READER_CONFIG || {};
const app = document.body;
const AUDIOBOOK_URL = "/reader/assets/heidi-hoerbuch.mp3";

const reviewLevels = [
  { value: "stark", label: "stark" },
  { value: "teilweise", label: "teilweise" },
  { value: "offen", label: "offen" }
];

const defaultState = {
  ready: false,
  loading: true,
  error: "",
  classroom: null,
  student: null,
  progress: null,
  peerReview: null,
  sebFeedback: null,
  sebFeedbackStatus: "idle",
  sebFeedbackError: "",
  sebFeedbackKey: "",
  selectedReviewId: null,
  lessonId: config.forcedLessonId || lessonSets[0].id,
  moduleId: readerModules[0].id,
  entryId: readerModules[0].entries[0].id,
  theoryId: theoryResources[0].id,
  notes: {},
  saveStatus: "idle",
  reviewSaveStatus: "idle",
  lastSavedAt: ""
};

const state = structuredClone(defaultState);
let saveTimer = null;
let feedbackTimer = null;
let sebFeedbackRequestId = 0;
const entryIndex = new Map();
const semanticGroups = {
  heidi: ["heidi", "kind", "mädchen", "maedchen", "waise"],
  almoehi: ["almöhi", "almoehi", "grossvater", "grossvater", "öhi", "oehi"],
  peter: ["geissenpeter", "geissenpeter", "peter", "ziegen", "geissen", "weide"],
  klara: ["klara", "rollstuhl", "sesemann", "frankfurt", "freundin"],
  dete: ["dete", "tante", "dienst", "familie", "tobias"],
  natur: ["alp", "alm", "berge", "natur", "luft", "sonne", "weide", "dörfli", "doerfli"],
  stadt: ["stadt", "frankfurt", "fenster", "hausordnung", "benimmregel", "rottenmeier", "tinette", "sebastian"],
  religion: ["gott", "gebet", "pfarrer", "grossmama", "grossmama", "grossmutter", "vertrauen", "zweifel"],
  koerper: ["körper", "koerper", "krank", "gesund", "heimweh", "schlaf", "essen", "laufen", "medizin", "doktor"],
  sprache: ["wort", "formulierung", "begriff", "satz", "bild", "dialog", "ton", "erzählen", "erzaehlen"],
  ambivalenz: ["zugleich", "gleichzeitig", "widerspruch", "ambivalenz", "offen", "unsicher"]
};
const semanticLookup = new Map(
  Object.entries(semanticGroups).flatMap(([canonical, variants]) => variants.map((variant) => [variant, canonical]))
);

for (const module of readerModules) {
  for (const entry of module.entries) {
    entryIndex.set(entry.id, { module, entry });
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function tokenizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 || /^\d+$/.test(part));
}

function canonicalToken(token) {
  return semanticLookup.get(token) || token;
}

function conceptSet(value) {
  const text = String(value || "").toLowerCase();
  const set = new Set(tokenizeText(text).map(canonicalToken));
  for (const [canonical, variants] of Object.entries(semanticGroups)) {
    if (variants.some((variant) => text.includes(variant))) {
      set.add(canonical);
    }
  }
  return set;
}

function hasSemanticSignal(value, candidates) {
  const concepts = conceptSet(value);
  return candidates.some((candidate) => concepts.has(canonicalToken(String(candidate).toLowerCase())));
}

function promptOperator(prompt = "") {
  const text = String(prompt).trim().toLowerCase();
  if (/^(nenne|benenne|welche|welcher|welches)/.test(text)) {
    return "Benennen";
  }
  if (/^(erkläre|erlaeutere|warum|wie)/.test(text)) {
    return "Erklären";
  }
  if (/^(zeige|weise|ordne|vergleiche|verbinde)/.test(text)) {
    return "Zeigen";
  }
  if (/^(prüfe|pruefe|entscheide)/.test(text)) {
    return "Prüfen";
  }
  if (/^(beschreibe|bestimme|wähle|waehle)/.test(text)) {
    return "Präzisieren";
  }
  return "Ausarbeiten";
}

function responseLabel(base, index, prompt) {
  return `${base} ${index + 1} · ${promptOperator(prompt)}`;
}

function responsePlaceholder(prompt = "") {
  const operator = promptOperator(prompt);
  if (operator === "Benennen") {
    return "Antworte knapp und präzise. Nenne die Beobachtung und sichere sie am Wortlaut.";
  }
  if (operator === "Erklären") {
    return "Erkläre in 2-4 Sätzen: Beobachtung, Textsignal, Wirkung.";
  }
  if (operator === "Zeigen") {
    return "Zeige die Aussage am Text: nenne ein Signal und leite daraus eine Deutung ab.";
  }
  if (operator === "Prüfen") {
    return "Prüfe die Möglichkeit genau und entscheide dich begründet.";
  }
  return "Arbeite die Frage in 2-4 präzisen, textnahen Sätzen aus.";
}

function taskPrompt(task) {
  return typeof task === "string" ? task : task?.prompt || "";
}

function focusTasksFor(entry = currentEntry()) {
  return entry?.focusTasks || entry?.prompts?.map((prompt) => buildTask(prompt, {
    context: entry.context,
    signalWords: entry.signalWords,
    relatedTheoryIds: entry.relatedTheoryIds,
    writingFrame: entry.writingFrame,
    kind: "focus",
    taskTitle: entry.title
  })) || [];
}

function guidingTasksFor(theory = currentTheory()) {
  return theory?.questionTasks || theory?.questions?.map((question) => buildTask(question, {
    context: theory.summary,
    keyIdeas: theory.keyIdeas,
    relatedTheoryIds: [theory.id],
    writingFrame: theory.writingFrame,
    kind: "theory",
    taskTitle: theory.title
  })) || [];
}

function transferTasksFor(entry = currentEntry(), theory = currentTheory()) {
  const prompts = [
    `Beziehe "${entry.passageLabel}" gezielt auf ${theory.shortTitle.toLowerCase()} und sichere deine Aussage mit mindestens zwei Wörtern aus dem Text.`,
    ...(theory.transferPrompts || []).slice(0, 2)
  ];

  return prompts.map((prompt) => buildTask(prompt, {
    context: `${entry.context} ${theory.summary}`,
    signalWords: entry.signalWords,
    keyIdeas: theory.keyIdeas,
    relatedTheoryIds: uniqueTheoryIds(entry.relatedTheoryIds, [theory.id]),
    writingFrame: theory.writingFrame,
    kind: "transfer",
    taskTitle: `${entry.title} · ${theory.shortTitle}`
  }));
}

function resourceQuestionTasksFor(assignment) {
  const questions = assignment?.questionTasks || assignment?.questions || [];
  return questions.map((question, index) => {
    const prompt = taskPrompt(question);
    const builtTask = buildTask(prompt, {
      context: `${assignment.summary} ${assignment.task}`,
      relatedTheoryIds: [assignment.resourceId],
      kind: "resource",
      taskTitle: assignment.title
    });
    return {
      ...builtTask,
      ...(typeof question === "object" ? question : {}),
      prompt,
      modelAnswer: (typeof question === "object" ? question.modelAnswer : "") || assignment.answerGuides?.[index] || builtTask.modelAnswer
    };
  });
}

function resourceMainTaskFor(assignment) {
  const builtTask = buildTask(assignment.task, {
    context: `${assignment.summary} ${assignment.task}`,
    relatedTheoryIds: [assignment.resourceId],
    kind: "resource",
    taskTitle: assignment.title
  });
  return {
    ...builtTask,
    ...(assignment.taskCard || {}),
    modelAnswer: assignment.taskCard?.modelAnswer || assignment.taskGuide || builtTask.modelAnswer
  };
}

function uniqueTheoryIds(primary = [], extra = []) {
  return [...new Set([...(primary || []), ...(extra || [])].filter(Boolean))];
}

function conceptMatches(answer, concept) {
  const text = String(answer || "").toLowerCase();
  const concepts = conceptSet(text);
  return (concept?.aliases || []).some((alias) => {
    const normalized = String(alias || "").toLowerCase();
    return normalized && (text.includes(normalized) || concepts.has(canonicalToken(normalized)));
  });
}

function conceptMatchDetails(answer, concept) {
  const text = String(answer || "").toLowerCase();
  const concepts = conceptSet(text);
  const matches = [];

  for (const alias of concept?.aliases || []) {
    const normalized = String(alias || "").toLowerCase().trim();
    if (!normalized || normalized.length < 4) {
      continue;
    }
    if (text.includes(normalized) || concepts.has(canonicalToken(normalized))) {
      matches.push(normalized);
    }
  }

  return [...new Set(matches)].sort((left, right) => right.length - left.length).slice(0, 2);
}

function evaluateAnswer(answer, task, { minTokens = 12 } = {}) {
  const plain = String(answer || "").trim();
  const tokens = tokenizeText(plain);
  const analysisTerms = ["zeigt", "verdeutlicht", "macht sichtbar", "deutet", "wirkt", "funktion", "bedeutet", "deshalb", "dadurch", "zugleich"];
  const concepts = Array.isArray(task?.concepts) ? task.concepts : [];
  const matchedConceptDetails = concepts
    .map((concept) => ({ label: concept.label, aliases: conceptMatchDetails(plain, concept) }))
    .filter((concept) => concept.aliases.length);
  const matchedConcepts = matchedConceptDetails.map((concept) => concept.label);
  const missingConcepts = concepts.filter((concept) => !conceptMatches(plain, concept)).map((concept) => concept.label);
  const hasAnalysis = hasSemanticSignal(plain, analysisTerms);
  const hasEvidence = matchedConcepts.includes("Textsignal") || /["„‚]/.test(plain);

  if (!plain) {
    return {
      level: "empty",
      heading: "Noch keine Antwort eingetragen",
      summary: "Schreibe jetzt 2-4 Sätze. Die Antwort soll Textsignal, Deutung und Wirkung verbinden.",
      recognized: [],
      recognizedDetails: [],
      missing: concepts.slice(0, 3).map((concept) => concept.label)
    };
  }

  if (tokens.length >= minTokens && hasEvidence && hasAnalysis && matchedConcepts.length >= Math.min(2, concepts.length || 2)) {
    return {
      level: "strong",
      heading: "Tragfähige Antwort",
      summary: "Die Antwort ist textnah und bereits analytisch angebunden. Jetzt kannst du vor allem noch präziser formulieren.",
      recognized: matchedConcepts,
      recognizedDetails: matchedConceptDetails,
      missing: missingConcepts.slice(0, 2)
    };
  }

  if (tokens.length >= 8 && (hasEvidence || matchedConcepts.length >= 1)) {
    return {
      level: "partial",
      heading: "Gute Richtung, aber noch zu knapp",
      summary: "Ein Ansatz ist erkennbar. Es fehlen aber noch mehr Wortlaut, klarere Deutung oder ein expliziter Theoriebezug.",
      recognized: matchedConcepts,
      recognizedDetails: matchedConceptDetails,
      missing: missingConcepts.slice(0, 3)
    };
  }

  return {
    level: "weak",
    heading: "Noch zu allgemein",
    summary: "Im Moment klingt die Antwort eher nach Eindruck oder Nacherzählung. Benenne ein konkretes Signal und leite daraus eine Wirkung ab.",
    recognized: matchedConcepts,
    recognizedDetails: matchedConceptDetails,
    missing: missingConcepts.slice(0, 3)
  };
}

function responseMask(task) {
  const prompt = taskPrompt(task);
  const operator = task.operatorLabel || promptOperator(prompt);
  const theoryTargets = (task?.concepts || [])
    .map((concept) => concept.label)
    .filter((label) => label && label !== "Textsignal" && label !== "Fragekern")
    .slice(0, 2);

  const closing = theoryTargets.length
    ? `Fachbezug: Das lässt sich mit ${theoryTargets.join(" und ")} verbinden, weil ...`
    : "Deutung: Dadurch wird sichtbar, dass ...";

  if (operator === "Benennen") {
    return [
      "Beobachtung: In der Passage fällt auf, dass ...",
      "Textsignal: Das zeigt sich am Wort/Detail \"...\".",
      closing
    ];
  }

  if (operator === "Prüfen") {
    return [
      "These: Zunächst spricht dafür/dagegen, dass ...",
      "Textsignal: Das sieht man an \"...\".",
      closing
    ];
  }

  return [
    "Beobachtung: Heidi zeigt hier, dass ...",
    "Textsignal: Das erkennt man an \"...\".",
    closing
  ];
}

function renderTaskPreview(task, index, baseLabel = "Aufgabe") {
  return `
    <article class="question-task-card">
      <div class="section-head">
        <strong>${escapeHtml(`${baseLabel} ${index + 1} · ${task.operatorLabel || promptOperator(taskPrompt(task))}`)}</strong>
      </div>
      <p class="field-prompt">${escapeHtml(taskPrompt(task))}</p>
      <p class="task-instruction">${escapeHtml(task.instruction || responsePlaceholder(taskPrompt(task)))}</p>
      <ul class="task-checklist">
        ${(task.checklist || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </article>
  `;
}

function renderTaskFeedbackMarkup(task, feedback) {
  const synonymExplanation = feedback.recognizedDetails?.length
    ? feedback.recognizedDetails
      .map((concept) => `„${concept.aliases.join(" / ")}“ → ${concept.label}`)
      .join("; ")
    : (task.synonymHints || []).slice(0, 6).map((hint) => `„${hint}“`).join(", ");

  return `
    <strong>${escapeHtml(feedback.heading)}</strong>
    <p>${escapeHtml(feedback.summary)}</p>
    ${feedback.recognized.length ? `<p><strong>Erkannt:</strong> ${escapeHtml(feedback.recognized.join(", "))}</p>` : ""}
    ${feedback.missing.length ? `<p><strong>Noch absichern:</strong> ${escapeHtml(feedback.missing.join(", "))}</p>` : ""}
    <p><strong>Synonymerklärung:</strong> ${escapeHtml(synonymExplanation || "Sobald du Fachwörter oder Varianten nutzt, wird hier das Mapping sichtbar.")}</p>
  `;
}

function renderTaskField({ task, value, dataset, label }) {
  const feedback = evaluateAnswer(value, task);
  const dataAttributes = Object.entries(dataset)
    .map(([key, fieldValue]) => `data-${key}="${escapeHtml(String(fieldValue))}"`)
    .join(" ");
  const inputLabel = String(label || "");
  const prompt = taskPrompt(task);
  const instruction = task.instruction || responsePlaceholder(prompt);
  const maskLines = responseMask(task);

  return `
    <article class="question-answer-block">
      <div class="section-head">
        <strong class="question-answer-label">${escapeHtml(inputLabel)}</strong>
        <span class="status-badge">${escapeHtml(task.operatorLabel || promptOperator(prompt))}</span>
      </div>
      <p class="field-prompt">${escapeHtml(prompt)}</p>
      <div class="answer-mask" aria-hidden="true">
        <strong>Eingabemaske</strong>
        <ol class="answer-mask-list">
          ${maskLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
        </ol>
      </div>
      <textarea ${dataAttributes} aria-label="${escapeHtml(inputLabel)}" placeholder="${escapeHtml(instruction)}">${escapeHtml(value || "")}</textarea>
      <div class="task-feedback task-feedback--${feedback.level}" data-task-feedback aria-live="polite">
        ${renderTaskFeedbackMarkup(task, feedback)}
      </div>
      <details class="task-guidance">
        <summary>Hilfen aufklappen</summary>
        <p class="task-instruction">${escapeHtml(instruction)}</p>
        <ul class="task-checklist">
          ${(task.checklist || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
        <div class="model-answer">
          <p><strong>Musterlösung:</strong> ${escapeHtml(task.modelAnswer || "")}</p>
        </div>
      </details>
    </article>
  `;
}

async function fetchBootstrap() {
  const response = await fetch("/reader-api/bootstrap", { credentials: "same-origin" });
  if (response.status === 401) {
    window.location.replace(window.location.pathname + window.location.search);
    return new Promise(() => {});
  }
  if (!response.ok) {
    throw new Error("Die Reader-Sitzung konnte nicht geladen werden.");
  }
  return response.json();
}

async function fetchSebFeedback(payload) {
  const response = await fetch("/reader-api/seb-feedback", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.error || "Das SEB-Fachfeedback konnte nicht geladen werden.");
  }

  return response.json();
}

function applyBootstrap(payload) {
  state.classroom = payload.classroom;
  state.student = payload.student;
  state.progress = payload.progress;
  state.peerReview = payload.peerReview;
  state.notes = payload.work.notes || {};
  state.lessonId = config.forcedLessonId
    || (mode === "seb" ? payload.classroom.activeSebLessonId : payload.work.selectedLessonId)
    || state.lessonId;
  state.moduleId = payload.work.moduleId || state.moduleId;
  state.entryId = payload.work.entryId || state.entryId;
  state.theoryId = payload.work.theoryId || state.theoryId;
  state.lastSavedAt = payload.work.updatedAt || "";

  if (state.peerReview?.assignments?.length) {
    const stillVisible = state.peerReview.assignments.some((assignment) => assignment.id === state.selectedReviewId);
    if (!stillVisible) {
      state.selectedReviewId = state.peerReview.assignments[0].id;
    }
  } else {
    state.selectedReviewId = null;
  }
}

function sebFeedbackPayload() {
  const entry = currentEntry();
  return {
    lessonId: state.lessonId,
    moduleId: state.moduleId,
    entryId: state.entryId,
    theoryId: state.theoryId,
    note: noteForEntry(entry?.id || state.entryId)
  };
}

function sebFeedbackKeyFor(payload) {
  return [
    payload.lessonId,
    payload.moduleId,
    payload.entryId,
    payload.theoryId,
    payload.note?.observation || "",
    payload.note?.evidence || "",
    payload.note?.interpretation || "",
    payload.note?.theory || "",
    payload.note?.revision || ""
  ].join("::");
}

async function requestSebFeedback({ showLoading = false, force = false } = {}) {
  if (mode !== "seb" || !state.ready) {
    return;
  }

  ensureSelection();
  const payload = sebFeedbackPayload();
  const feedbackKey = sebFeedbackKeyFor(payload);
  if (!force && state.sebFeedbackStatus === "ready" && state.sebFeedbackKey === feedbackKey) {
    return;
  }

  const requestId = ++sebFeedbackRequestId;
  state.sebFeedbackStatus = showLoading || !state.sebFeedback ? "loading" : "refreshing";
  state.sebFeedbackError = "";
  if (showLoading && !updateSebFeedbackPanelLive()) {
    render();
  }

  try {
    const feedback = await fetchSebFeedback(payload);
    if (requestId !== sebFeedbackRequestId) {
      return;
    }

    state.sebFeedback = feedback;
    state.sebFeedbackKey = feedbackKey;
    state.sebFeedbackStatus = "ready";
    state.sebFeedbackError = "";
    if (!updateSebFeedbackPanelLive()) {
      render();
    }
  } catch (error) {
    if (requestId !== sebFeedbackRequestId) {
      return;
    }

    state.sebFeedbackStatus = "error";
    state.sebFeedbackError = error.message;
    if (!updateSebFeedbackPanelLive()) {
      render();
    }
  }
}

async function saveProgress() {
  clearTimeout(saveTimer);
  state.saveStatus = "saving";
  if (!updateTopStatusLive()) {
    render();
  }

  try {
    const response = await fetch("/reader-api/progress", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode,
        lessonId: state.lessonId,
        moduleId: state.moduleId,
        entryId: state.entryId,
        theoryId: state.theoryId,
        notes: state.notes
      })
    });

    if (!response.ok) {
      throw new Error("Arbeitsstand konnte nicht gespeichert werden.");
    }

    const payload = await response.json();
    applyBootstrap(payload);
    state.saveStatus = "saved";
    const updatedLive =
      updateTopStatusLive()
      && updateProgressBoxLive()
      && updateParcoursExportPanelLive();
    if (!updatedLive) {
      render();
    }
    if (mode === "seb") {
      requestSebFeedback();
    }
  } catch (error) {
    state.saveStatus = "error";
    state.error = error.message;
    render();
  }
}

function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveProgress();
  }, 500);
}

function queueSebFeedback() {
  if (mode !== "seb") {
    return;
  }

  clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => {
    requestSebFeedback();
  }, 700);
}

function availableLessons() {
  const allowedLessonIds = state.classroom?.lessonIds || lessonSets.map((lesson) => lesson.id);

  if (config.forcedLessonId) {
    return lessonSets.filter((lesson) => lesson.id === config.forcedLessonId);
  }

  if (mode === "seb") {
    const activeLessonId = state.classroom?.activeSebLessonId || state.lessonId;
    return lessonSets.filter((lesson) => lesson.id === activeLessonId);
  }

  return lessonSets.filter((lesson) => allowedLessonIds.includes(lesson.id));
}

function currentLesson() {
  return availableLessons().find((lesson) => lesson.id === state.lessonId) || availableLessons()[0] || lessonSets[0];
}

function entriesForLesson(lesson = currentLesson()) {
  if (Array.isArray(lesson?.entryIds) && lesson.entryIds.length) {
    return lesson.entryIds
      .map((entryId) => entryIndex.get(entryId)?.entry)
      .filter(Boolean);
  }

  return (lesson?.moduleIds || [])
    .flatMap((moduleId) => readerModules.find((module) => module.id === moduleId)?.entries || []);
}

function modulesForLesson(lesson = currentLesson()) {
  const lessonEntries = entriesForLesson(lesson);
  const modules = new Map();

  for (const entry of lessonEntries) {
    const meta = entryIndex.get(entry.id);
    if (!meta) {
      continue;
    }

    if (!modules.has(meta.module.id)) {
      modules.set(meta.module.id, {
        ...meta.module,
        entries: []
      });
    }

    modules.get(meta.module.id).entries.push(meta.entry);
  }

  return readerModules
    .filter((module) => modules.has(module.id))
    .map((module) => modules.get(module.id));
}

function currentModule() {
  return modulesForLesson().find((module) => module.id === state.moduleId) || modulesForLesson()[0];
}

function currentEntry() {
  return currentModule()?.entries.find((entry) => entry.id === state.entryId) || currentModule()?.entries[0];
}

function theoryIdsFor(module = currentModule(), entry = currentEntry()) {
  const ids = [
    ...(currentLesson()?.recommendedTheoryIds || []),
    ...(module?.relatedTheoryIds || []),
    ...(entry?.relatedTheoryIds || [])
  ];
  return [...new Set(ids)].filter((id) => theoryResources.some((resource) => resource.id === id));
}

function theoryOptionsFor(module = currentModule(), entry = currentEntry()) {
  const ids = theoryIdsFor(module, entry);
  if (!ids.length) {
    return theoryResources;
  }

  return ids
    .map((id) => theoryResources.find((resource) => resource.id === id))
    .filter(Boolean);
}

function ensureSelection() {
  const lessons = availableLessons();
  if (!lessons.some((lesson) => lesson.id === state.lessonId)) {
    state.lessonId = lessons[0]?.id || lessonSets[0].id;
  }

  const visibleModules = modulesForLesson();
  if (!visibleModules.some((module) => module.id === state.moduleId)) {
    state.moduleId = visibleModules[0]?.id || readerModules[0].id;
  }

  const module = currentModule();
  if (module && !module.entries.some((entry) => entry.id === state.entryId)) {
    state.entryId = module.entries[0]?.id || state.entryId;
  }

  const theories = theoryOptionsFor();
  if (!theories.some((resource) => resource.id === state.theoryId)) {
    state.theoryId = theories[0]?.id || theoryResources[0].id;
  }
}

function currentTheory() {
  const options = theoryOptionsFor();
  return options.find((resource) => resource.id === state.theoryId) || options[0] || theoryResources[0];
}

function resourceAssignmentsForLesson(lesson = currentLesson()) {
  return (lesson?.resourceAssignments || [])
    .map((assignment) => {
      const resource = theoryResources.find((entry) => entry.id === assignment.resourceId);
      if (!resource) {
        return null;
      }

      return {
        ...assignment,
        resource
      };
    })
    .filter(Boolean);
}

function resourceResponseKey(lessonId, resourceId) {
  return `lesson-resource::${lessonId}::${resourceId}`;
}

function noteForEntry(entryId) {
  const raw = state.notes[entryId] || {};
  return {
    observation: "",
    evidence: "",
    interpretation: "",
    theory: "",
    revision: "",
    focusAnswers: [],
    theoryResponses: {},
    ...raw
  };
}

function focusAnswersFor(entry = currentEntry()) {
  const note = noteForEntry(entry.id);
  return focusTasksFor(entry).map((_, index) => note.focusAnswers?.[index] || "");
}

function theoryResponseFor(entry = currentEntry(), theory = currentTheory()) {
  const note = noteForEntry(entry.id);
  const stored = note.theoryResponses?.[theory.id] || {};
  const guidingTasks = guidingTasksFor(theory);
  const transferTasks = transferTasksFor(entry, theory);

  return {
    guidingAnswers: guidingTasks.map((_, index) => stored.guidingAnswers?.[index] || ""),
    transferAnswers: transferTasks.map((_, index) => stored.transferAnswers?.[index] || "")
  };
}

function resourceResponseForAssignment(assignment, lesson = currentLesson()) {
  const raw = state.notes[resourceResponseKey(lesson.id, assignment.resourceId)] || {};
  const questionTasks = resourceQuestionTasksFor(assignment);
  return {
    taskResponse: raw.taskResponse || "",
    questionAnswers: questionTasks.map((_, index) => raw.questionAnswers?.[index] || "")
  };
}

function trimmed(value) {
  return String(value || "").trim();
}

function documentationStatusForEntry(entry = currentEntry(), theory = currentTheory()) {
  const note = noteForEntry(entry.id);
  const focusAnswers = focusAnswersFor(entry);
  const theoryResponses = theoryResponseFor(entry, theory);
  const focusTasks = focusTasksFor(entry);
  const guidingTasks = guidingTasksFor(theory);
  const transferTasks = transferTasksFor(entry, theory);
  const checks = [
    { label: "Beobachtung", complete: Boolean(trimmed(note.observation)) },
    { label: "Textanker / Wortlaut", complete: Boolean(trimmed(note.evidence)) },
    { label: "Deutung", complete: Boolean(trimmed(note.interpretation)) },
    { label: "Theoriebezug", complete: Boolean(trimmed(note.theory)) },
    { label: "Revision / nächster Schritt", complete: Boolean(trimmed(note.revision)) },
    ...focusTasks.map((task, index) => ({
      label: `Fokusfrage ${index + 1}: ${taskPrompt(task)}`,
      complete: Boolean(trimmed(focusAnswers[index]))
    })),
    ...guidingTasks.map((task, index) => ({
      label: `Leitfrage ${index + 1}: ${taskPrompt(task)}`,
      complete: Boolean(trimmed(theoryResponses.guidingAnswers[index]))
    })),
    ...transferTasks.map((task, index) => ({
      label: `Transfer ${index + 1}: ${taskPrompt(task)}`,
      complete: Boolean(trimmed(theoryResponses.transferAnswers[index]))
    }))
  ];

  return {
    completed: checks.filter((item) => item.complete).length,
    total: checks.length,
    missing: checks.filter((item) => !item.complete).map((item) => item.label)
  };
}

function documentationStatusForAssignment(assignment, lesson = currentLesson()) {
  const response = resourceResponseForAssignment(assignment, lesson);
  const questionTasks = resourceQuestionTasksFor(assignment);
  const checks = [
    { label: "Arbeitsauftrag schriftlich beantworten", complete: Boolean(trimmed(response.taskResponse)) },
    ...questionTasks.map((task, index) => ({
      label: `Materialfrage ${index + 1}: ${taskPrompt(task)}`,
      complete: Boolean(trimmed(response.questionAnswers[index]))
    }))
  ];

  return {
    completed: checks.filter((item) => item.complete).length,
    total: checks.length,
    missing: checks.filter((item) => !item.complete).map((item) => item.label)
  };
}

function completion(module) {
  const completed = module.entries.filter((entry) => {
    const note = noteForEntry(entry.id);
    return note.observation.trim() || note.interpretation.trim() || note.theory.trim();
  }).length;

  return `${completed}/${module.entries.length}`;
}

function progressForCurrentLesson() {
  const lesson = currentLesson();
  return state.progress?.lessonProgress?.find((entry) => entry.id === lesson.id) || null;
}

function isParcoursComplete() {
  return Boolean(
    state.progress &&
    state.progress.totalEntries > 0 &&
    state.progress.completedEntries >= state.progress.totalEntries
  );
}

function currentReviewAssignment() {
  return state.peerReview?.assignments?.find((assignment) => assignment.id === state.selectedReviewId) || state.peerReview?.assignments?.[0] || null;
}

function pageRangeForLesson(lesson = currentLesson()) {
  const pageNumbers = entriesForLesson(lesson)
    .map((entry) => Number(entry.pageNumber || 0))
    .filter(Boolean);

  if (!pageNumbers.length) {
    return "";
  }

  const first = Math.min(...pageNumbers);
  const last = Math.max(...pageNumbers);
  return first === last ? `S. ${first}` : `S. ${first}-${last}`;
}

function feedbackFor(note, module, entry) {
  const body = `${note.observation} ${note.interpretation} ${note.theory}`;
  const evidence = note.evidence;
  const theory = note.theory;
  const signals = ["zeigt", "verdeutlicht", "deutet", "wirkt", "weil", "macht sichtbar", "inszeniert"];
  const summarySignals = ["dann", "danach", "passiert", "anschliessend", "erzählt"];
  const contextualSignals = [
    "tilda",
    "ida",
    "mutter",
    "viktor",
    "ivan",
    "vater",
    "schwimmbad",
    "wasser",
    "bahnen",
    "fürsorge",
    "kleinstadt",
    "überdosis",
    "fieber",
    "meer",
    "libelle",
    "berlin"
  ];
  const precisionSignals = ["wort", "formulierung", "kontrast", "montage", "szene", "satz", "bild", "perspektive", "rhythmus", "liste", "dialog", "geruch", "körper"];
  const positives = [];
  const cautions = [];
  const steps = [];
  const relatedTheories = theoryOptionsFor(module, entry);
  const lesson = currentLesson();
  const combined = `${body} ${evidence}`;

  if (evidence.trim().length >= 8) {
    positives.push("Du arbeitest bereits mit konkreten Wortsignalen aus dem Text und löst dich damit von blosser Nacherzählung.");
  } else {
    steps.push("Ergänze ein oder zwei Wörter aus dem Volltext-Wortlaut als präzisen Textanker.");
  }

  if (hasSemanticSignal(body, signals)) {
    positives.push("Deine Notiz enthält bereits eine deutende Bewegung: Du sagst nicht nur, was geschieht, sondern was die Passage funktional leistet.");
  } else {
    steps.push("Formuliere deutlicher, was die Stelle zeigt, andeutet oder bewirkt.");
  }

  if (hasSemanticSignal(body, summarySignals)) {
    cautions.push("An einigen Stellen rutscht die Antwort noch in Ablauf oder Nacherzählung. Fachlich stärker wird sie, wenn du Erzählweise und Wirkung statt nur das Geschehen erklärst.");
    steps.push("Achte darauf, nicht nur den Ablauf zu erzählen, sondern die sprachliche Wirkung zu erklären.");
  }

  if (note.theory.trim().length >= 20) {
    positives.push("Du verknüpfst die Passage schon mit einer Theorie-Linse.");
  } else if (relatedTheories.length) {
    steps.push(`Ziehe zusätzlich eine Theorie-Linse heran: ${relatedTheories.map((resource) => resource.shortTitle).join(", ")}.`);
  }

  if (module.lens && !hasSemanticSignal(body, tokenizeText(module.lens))) {
    steps.push(`Binde deine Beobachtung noch stärker an die Linse des Moduls: ${module.lens.toLowerCase()}.`);
  }

  if (hasSemanticSignal(combined, contextualSignals)) {
    positives.push("Die Antwort bindet die Passage schon an zentrale Figuren, Motive oder Konfliktlinien des Romans zurück.");
  } else if (relatedTheories.length) {
    steps.push("Schärfe den Roman-Kontext ausdrücklich: Benenne die Figur, das Motiv oder die Beziehung, die diese Passage strukturiert.");
  }

  if (hasSemanticSignal(combined, precisionSignals)) {
    positives.push("Du gehst teilweise schon an sprachliche oder erzählerische Präzision heran, statt nur allgemein zu urteilen.");
  } else {
    cautions.push("Die Deutung bleibt noch zu allgemein. Im Moment fehlen noch klar benannte Signale wie Wortwahl, Liste, Dialog, Perspektive, Kontrast oder Körperwahrnehmung.");
    steps.push("Arbeite nicht nur mit Wertungen. Benenne genauer Wortwahl, Liste, Perspektive, Kontrast, Geruch, Temperatur oder Körperreaktion.");
  }

  if (entry.relatedTheoryIds?.includes("archiv-biografie")) {
    const archiveTerms = ["archiv", "forschung", "portal", "edition", "quelle", "sekundärtext", "sekundaertext"];
    if (archiveTerms.some((term) => theory.includes(term))) {
      positives.push("Du behandelst die Passage bereits als Forschungseinstieg und vermeidest eine zu schnelle Gleichsetzung von Autorin und Figur.");
    }
  }

  if (!note.observation.trim() || !note.interpretation.trim()) {
    cautions.push("Die Grundstruktur der Antwort ist noch zu dünn. Eine tragfähige Deutung braucht mindestens Beobachtung, Textsignal und Folgerung.");
  }

  if (!steps.length) {
    steps.push("Die Notiz ist schon tragfähig. Schärfe im nächsten Schritt noch genauer, wie Textsignal, Romanmotiv und Deutung ineinandergreifen.");
  }

  const summary = positives.length
    ? "Die Notiz hat bereits eine belastbare Richtung, muss aber noch enger an Textsignal und Analysefunktion gebunden werden."
    : "Die Notiz ist im Ansatz da, braucht aber noch deutlich mehr Textnähe, Präzision und fachliche Zuspitzung.";

  return {
    summary,
    positives: positives.slice(0, 4),
    cautions: cautions.slice(0, 4),
    steps: steps.slice(0, 5)
  };
}

function pdfUrlForEntry(entry) {
  return `${pdfSource}#page=${entry.pageNumber || 1}&zoom=page-width`;
}

function renderSidebar() {
  return modulesForLesson().map((module) => `
    <button class="module-pill ${module.id === state.moduleId ? "is-active" : ""}" data-action="select-module" data-module-id="${module.id}">
      <span>${escapeHtml(module.title)}</span>
      <strong>${completion(module)}</strong>
    </button>
  `).join("");
}

function renderLessonRail() {
  return availableLessons().map((lesson) => {
    const progress = state.progress?.lessonProgress?.find((entry) => entry.id === lesson.id);
    const entryCount = Array.isArray(lesson.entryIds) ? lesson.entryIds.length : lesson.moduleIds.length;
    return `
      <button class="lesson-pill ${lesson.id === state.lessonId ? "is-active" : ""}" data-action="select-lesson" data-lesson-id="${lesson.id}" ${mode === "seb" || config.forcedLessonId ? "disabled" : ""}>
        <span>${escapeHtml(lesson.title)}</span>
        <small>${escapeHtml(progress ? `${progress.completedEntries}/${progress.totalEntries} Passagen` : `${entryCount} Passagen · ${pageRangeForLesson(lesson)}`)}</small>
      </button>
    `;
  }).join("");
}

function renderTheorySelector(module, entry) {
  return theoryOptionsFor(module, entry).map((resource) => `
    <button class="theory-pill ${resource.id === state.theoryId ? "is-active" : ""}" data-action="select-theory" data-theory-id="${resource.id}">
      <span>${escapeHtml(resource.shortTitle)}</span>
      <small>${escapeHtml(resource.sourceTitle)}</small>
    </button>
  `).join("");
}

function renderEntryTabs(module) {
  return module.entries.map((entry) => `
    <button class="entry-tab ${entry.id === state.entryId ? "is-active" : ""}" data-action="select-entry" data-entry-id="${entry.id}">
      ${escapeHtml(entry.title)}
    </button>
  `).join("");
}

function renderPassageNavigator(lesson = currentLesson()) {
  return entriesForLesson(lesson).map((entry) => {
    const module = entryIndex.get(entry.id)?.module;
    const focusTasks = focusTasksFor(entry);
    return `
    <button class="passage-card ${entry.id === state.entryId ? "is-active" : ""}" data-action="select-entry" data-entry-id="${entry.id}">
      <span class="passage-page">${escapeHtml(entry.pageHint)}</span>
      <strong>${escapeHtml(entry.passageLabel)}</strong>
      <small>${escapeHtml(module?.title || "")}</small>
      <span>${escapeHtml(taskPrompt(focusTasks[0]))}</span>
    </button>
  `;
  }).join("");
}

function renderSignalWords(entry) {
  const note = noteForEntry(entry.id);
  return entry.signalWords.map((word) => `
    <button class="signal-chip ${note.evidence.includes(word) ? "is-active" : ""}" data-action="toggle-signal" data-word="${escapeHtml(word)}">
      ${escapeHtml(word)}
    </button>
  `).join("");
}

function renderPromptList() {
  return starterPrompt.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderLessonMediaPanel(lesson = currentLesson()) {
  const media = Array.isArray(lesson?.chapterMedia) ? lesson.chapterMedia : [];
  if (!media.length) {
    return "";
  }

  return `
    <section class="lesson-media-panel">
      <div class="section-head">
        <strong>Medienauftakt dieser Lektion</strong>
        <span class="status-badge">${escapeHtml(`${media.length} Quelle${media.length === 1 ? "" : "n"}`)}</span>
      </div>
      <div class="lesson-media-grid">
        ${media.map((item) => `
          <article class="lesson-media-card">
            <div class="lesson-media-frame">
              <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt || item.title || "Historische Bildquelle")}">
            </div>
            <div class="lesson-media-copy">
              <div class="eyebrow">${escapeHtml(item.mediaLabel || "Kapitelauftakt")}</div>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.caption)}</p>
              ${item.openUrl || item.audioUrl ? `
                <div class="chip-row lesson-media-actions">
                  ${item.openUrl ? `<a class="button secondary" href="${escapeHtml(item.openUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.openLabel || "Medium öffnen")}</a>` : ""}
                  ${item.audioUrl ? `<a class="button secondary" href="${escapeHtml(item.audioUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.audioLabel || "Audio öffnen")}</a>` : ""}
                </div>
              ` : ""}
            </div>
            <div class="lesson-media-task">
              <strong>Arbeitsimpuls</strong>
              <p>${escapeHtml(item.focusPrompt)}</p>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderFocusQuestions(entry) {
  const focusAnswers = focusAnswersFor(entry);
  return focusTasksFor(entry).map((task, index) => renderTaskField({
    task,
    value: focusAnswers[index],
    dataset: { "note-array": "focusAnswers", index },
    label: responseLabel("Fokusauftrag", index, taskPrompt(task))
  })).join("");
}

function renderNotebookFeedbackMarkup(note, module, entry) {
  const feedback = feedbackFor(note, module, entry);
  return `
    <h3>Arbeitsfeedback</h3>
    <p class="feedback-summary">${escapeHtml(feedback.summary)}</p>
    <div class="feedback-columns">
      <div>
        <strong>Stärken</strong>
        <ul>${feedback.positives.length ? feedback.positives.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>Noch keine textnahe Stärke sichtbar.</li>"}</ul>
      </div>
      <div>
        <strong>Diagnose</strong>
        <ul>${feedback.cautions.length ? feedback.cautions.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>Keine akute Schwachstelle sichtbar; jetzt vor allem noch präziser absichern.</li>"}</ul>
      </div>
      <div>
        <strong>Nächste Schritte</strong>
        <ul>${feedback.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    </div>
  `;
}

function renderNotebook(entry) {
  const note = noteForEntry(entry.id);
  const theory = currentTheory();
  const documentation = documentationStatusForEntry(entry, theory);

  return `
    <section class="panel notebook">
      <div class="panel-head">
        <div>
          <div class="eyebrow">Notizbuch</div>
          <h2>${escapeHtml(entry.title)}</h2>
        </div>
        <button class="button secondary" data-action="export-notes">Markdown exportieren</button>
      </div>

      <div class="documentation-status-box ${documentation.missing.length ? "is-warning" : "is-complete"}">
        <strong data-doc-summary="entry">${escapeHtml(`Dokumentationsstand: ${documentation.completed}/${documentation.total}`)}</strong>
        <p data-doc-missing="entry">${documentation.missing.length
          ? escapeHtml(`Noch offen: ${documentation.missing.join(" · ")}`)
          : "Alle Fokusfragen, Leitfragen und Transferfragen sind schriftlich dokumentiert."
        }</p>
      </div>

      <form id="note-form" class="note-grid">
        <label>
          Beobachtung
          <textarea name="observation" placeholder="Was fällt an Raum, Figur, Sprache oder Stimmung auf?">${escapeHtml(note.observation)}</textarea>
        </label>
        <label>
          Signalwörter / Wortlaut
          <textarea name="evidence" placeholder="Kurze Wortgruppen aus dem integrierten Volltext">${escapeHtml(note.evidence)}</textarea>
        </label>
        <label>
          Deutung
          <textarea name="interpretation" placeholder="Was zeigt diese Stelle? Welche Wirkung entsteht?">${escapeHtml(note.interpretation)}</textarea>
        </label>
        <label>
          Theoriebezug
          <textarea name="theory" placeholder="Verbinde die Passage mit Milieu, Briefdynamik, Körper/Gewalt, Prozess oder Zusammenhang.">${escapeHtml(note.theory)}</textarea>
        </label>
        <label>
          Revision / nächster Schritt
          <textarea name="revision" placeholder="Was würdest du nach Feedback oder erneuter Lektüre noch schärfen?">${escapeHtml(note.revision)}</textarea>
        </label>
      </form>

      ${mode === "seb" ? "" : `
        <div class="feedback-box" data-live-note-feedback aria-live="polite">
          ${renderNotebookFeedbackMarkup(note, currentModule(), entry)}
        </div>
      `}
    </section>
  `;
}

function renderSebFeedbackPanel() {
  if (mode !== "seb") {
    return "";
  }

  const entry = currentEntry();
  const theory = currentTheory();
  const feedback = state.sebFeedback;

  if (state.sebFeedbackStatus === "loading" && !feedback) {
    return `
      <section class="panel seb-feedback-panel">
        <div class="panel-head">
          <div>
            <div class="eyebrow">Analytisches Fachfeedback</div>
            <h2>Diagnose wird aufgebaut</h2>
          </div>
        </div>
        <div class="empty-box">Die aktuelle Passage wird gerade im Hinblick auf Textbindung, Deutungstiefe, Theorieintegration und Revisionsreife ausgewertet.</div>
      </section>
    `;
  }

  if (state.sebFeedbackStatus === "error") {
    return `
      <section class="panel seb-feedback-panel">
        <div class="panel-head">
          <div>
            <div class="eyebrow">Analytisches Fachfeedback</div>
            <h2>Fachfeedback momentan nicht verfügbar</h2>
          </div>
          <button class="button secondary" data-action="refresh-seb-feedback">Erneut prüfen</button>
        </div>
        <div class="empty-box">${escapeHtml(state.sebFeedbackError || "Die Auswertung konnte nicht erstellt werden.")}</div>
      </section>
    `;
  }

  if (!feedback) {
    return "";
  }

  return `
    <section class="panel seb-feedback-panel">
      <div class="panel-head">
        <div>
          <div class="eyebrow">Analytisches Fachfeedback</div>
          <h2>${escapeHtml(feedback.heading)}</h2>
        </div>
        <div class="seb-feedback-actions">
          <span class="status-badge">${escapeHtml(`${feedback.overallScore}/100`)}</span>
          <button class="button secondary" data-action="refresh-seb-feedback">Neu auswerten</button>
        </div>
      </div>

      <div class="seb-feedback-summary">
        <p>${escapeHtml(feedback.summary)}</p>
        <div class="seb-feedback-meta">
          <span class="theory-tag">${escapeHtml(entry.passageLabel)}</span>
          <span class="theory-tag">${escapeHtml(theory.shortTitle)}</span>
          <span class="theory-tag">${escapeHtml(feedback.metadata.lessonTitle)}</span>
          ${state.sebFeedbackStatus === "refreshing" ? '<span class="theory-tag">aktualisiert …</span>' : ""}
        </div>
      </div>

      <div class="seb-profile-grid">
        ${feedback.profile.map((item) => `
          <article class="seb-profile-card">
            <div class="seb-profile-head">
              <strong>${escapeHtml(item.label)}</strong>
              <span class="status-badge">${escapeHtml(`${item.score}/100`)}</span>
            </div>
            <div class="eyebrow">${escapeHtml(item.level)}</div>
            <p>${escapeHtml(item.rationale)}</p>
          </article>
        `).join("")}
      </div>

      <div class="seb-feedback-columns">
        <article class="seb-feedback-card is-positive">
          <h3>Tragfähige Ansätze</h3>
          <ul class="question-list">
            ${feedback.strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>

        <article class="seb-feedback-card is-caution">
          <h3>Fachliche Schärfungszonen</h3>
          <ul class="question-list">
            ${feedback.cautions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>
      </div>

      <div class="seb-feedback-columns">
        <article class="seb-feedback-card">
          <h3>Konkrete Revisionsaufträge</h3>
          <ol class="question-list seb-feedback-steps">
            ${feedback.nextMoves.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ol>
        </article>

        <article class="seb-feedback-card">
          <h3>Weiterführende Rückfragen</h3>
          <ul class="question-list">
            ${feedback.prompts.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>
      </div>
    </section>
  `;
}

function renderPdfPanel(entry, module) {
  const lesson = currentLesson();
  return `
    <article class="panel pdf-panel">
      <div class="panel-head">
        <div>
          <div class="eyebrow">Text im Volltext</div>
          <h2>${escapeHtml(entry.passageLabel)}</h2>
        </div>
        <div class="pdf-head-actions">
          <span class="status-badge">${escapeHtml(entry.pageHint)}</span>
          <span class="status-badge">${escapeHtml(pageRangeForLesson(lesson))}</span>
          <a class="button secondary" href="${pdfUrlForEntry(entry)}" target="_blank" rel="noreferrer">Volltext separat öffnen</a>
        </div>
      </div>

      <div class="pdf-focus-box">
        <strong>Arbeitsfokus</strong>
        <p>${escapeHtml(module.briefing)}</p>
      </div>

      ${renderLessonMediaPanel(lesson)}

      <div class="lesson-passages-box">
        <strong>Relevante Passagen dieser Lektion</strong>
        <p>${escapeHtml(`${lesson.title} führt durch ${entriesForLesson(lesson).length} gezielt ausgewählte Passagen im Seitenkorridor ${pageRangeForLesson(lesson)}.`)}</p>
      </div>

      <div class="passage-nav">
        ${renderPassageNavigator(lesson)}
      </div>

      <div class="pdf-frame-wrap">
        <iframe class="pdf-frame" src="${pdfUrlForEntry(entry)}" title="Heidi Volltext"></iframe>
      </div>
    </article>
  `;
}

function renderTheoryPanel(module, entry) {
  const theory = currentTheory();
  const guidingTasks = guidingTasksFor(theory);
  const transferTasks = transferTasksFor(entry, theory);
  const theoryResponses = theoryResponseFor(entry, theory);
  const mediaMarkup = theory.mediaType === "pdf"
    ? `
      <div class="pdf-frame-wrap">
        <iframe class="pdf-frame" src="${escapeHtml(theory.embedUrl)}#page=1&zoom=page-width" title="${escapeHtml(theory.title)}"></iframe>
      </div>
      <p class="video-note">Der Sekundärtext ist direkt eingebettet und kann zusätzlich extern geöffnet werden.</p>
    `
    : theory.mediaType === "html"
      ? `
      <div class="pdf-frame-wrap">
        <iframe class="pdf-frame" src="${escapeHtml(theory.embedUrl)}" title="${escapeHtml(theory.title)}"></iframe>
      </div>
      <p class="video-note">Das historische Dossier ist direkt eingebettet; externe Quellen- und Audio-Links findest du zusätzlich im Dossier und über die Buttons.</p>
    `
    : `
      <div class="video-wrap">
        <video class="theory-video" controls preload="metadata">
          <source src="${escapeHtml(theory.embedUrl)}" type="video/mp4">
        </video>
      </div>
      <p class="video-note">
        Falls das Video im Browser nicht direkt lädt, kannst du es jederzeit über den externen Link öffnen.
      </p>
    `;

  return `
    <article class="panel theory-panel">
      <div class="panel-head">
        <div>
          <div class="eyebrow">Interdisziplinäre Linse</div>
          <h2>${escapeHtml(theory.title)}</h2>
        </div>
        <div class="chip-row">
          <a class="button secondary" href="${escapeHtml(theory.openUrl)}" target="_blank" rel="noreferrer">${theory.mediaType === "pdf" ? "PDF extern öffnen" : theory.mediaType === "html" ? "Quelle extern öffnen" : "Video extern öffnen"}</a>
          ${theory.audioUrl
            ? `<a class="button secondary" href="${escapeHtml(theory.audioUrl)}" target="_blank" rel="noreferrer">${escapeHtml(theory.audioLabel || "Audio extern öffnen")}</a>`
            : ""
          }
        </div>
      </div>

      <div class="theory-summary">
        <p>${escapeHtml(theory.summary)}</p>
        <div class="theory-tag-row">
          ${theory.keyIdeas.map((idea) => `<span class="theory-tag">${escapeHtml(idea)}</span>`).join("")}
        </div>
      </div>

      <div class="theory-grid">
        <div class="theory-card">
          <div class="section-head">
            <strong>Verbindliche Leitaufträge</strong>
            <span class="status-badge" data-doc-count="guiding">${escapeHtml(`${theoryResponses.guidingAnswers.filter((value) => trimmed(value)).length}/${guidingTasks.length}`)}</span>
          </div>
          <div class="question-task-list">
            ${guidingTasks.map((task, index) => renderTaskField({
              task,
              value: theoryResponses.guidingAnswers[index],
              dataset: { "note-theory-section": "guidingAnswers", index },
              label: responseLabel("Leitauftrag", index, taskPrompt(task))
            })).join("")}
          </div>
        </div>
        <div class="theory-card">
          <div class="section-head">
            <strong>Transfer zur Passage</strong>
            <span class="status-badge" data-doc-count="transfer">${escapeHtml(`${theoryResponses.transferAnswers.filter((value) => trimmed(value)).length}/${transferTasks.length}`)}</span>
          </div>
          <div class="question-task-list">
            ${transferTasks.map((task, index) => renderTaskField({
              task,
              value: theoryResponses.transferAnswers[index],
              dataset: { "note-theory-section": "transferAnswers", index },
              label: responseLabel("Transferauftrag", index, taskPrompt(task))
            })).join("")}
          </div>
        </div>
      </div>

      <div class="writing-frame-box">
        <strong>Schreibhilfe</strong>
        <p>${escapeHtml(theory.writingFrame)}</p>
      </div>

      <div class="video-card">
        ${mediaMarkup}
      </div>
    </article>
  `;
}

function renderResourceAssignmentsPanel() {
  const assignments = resourceAssignmentsForLesson();
  if (!assignments.length) {
    return "";
  }

  return `
    <article class="panel resource-assignment-panel">
      <div class="panel-head">
        <div>
          <div class="eyebrow">Materialaufträge</div>
          <h2>Podcast, Dossiers, Sekundärtexte und Theorie als Arbeitsstationen</h2>
        </div>
      </div>

      <div class="resource-assignment-grid">
        ${assignments.map((assignment) => {
          const { resource, title, summary, task } = assignment;
          const questionTasks = resourceQuestionTasksFor(assignment);
          const response = resourceResponseForAssignment(assignment);
          const documentation = documentationStatusForAssignment(assignment);
          return `
          <section class="resource-assignment-card">
            <div class="panel-head">
              <div>
                <div class="eyebrow">${escapeHtml(resource.sourceTitle)}</div>
                <h3>${escapeHtml(title)}</h3>
              </div>
              <div class="chip-row">
                <a class="button secondary" href="${escapeHtml(resource.openUrl)}" target="_blank" rel="noreferrer">${resource.mediaType === "pdf" ? "PDF extern öffnen" : resource.mediaType === "html" ? "Quelle extern öffnen" : "Medium extern öffnen"}</a>
                ${resource.audioUrl
                  ? `<a class="button secondary" href="${escapeHtml(resource.audioUrl)}" target="_blank" rel="noreferrer">${escapeHtml(resource.audioLabel || "Audio extern öffnen")}</a>`
                  : ""
                }
              </div>
            </div>

            <p>${escapeHtml(summary)}</p>

            <div class="documentation-status-box ${documentation.missing.length ? "is-warning" : "is-complete"}" data-doc-box="resource" data-resource-id="${resource.id}">
              <strong data-doc-summary="resource">${escapeHtml(`Dokumentationsstand: ${documentation.completed}/${documentation.total}`)}</strong>
              <p data-doc-missing="resource">${documentation.missing.length
                ? escapeHtml(`Noch offen: ${documentation.missing.join(" · ")}`)
                : "Der Materialauftrag ist vollständig schriftlich dokumentiert."
              }</p>
            </div>

            <div class="resource-task-box">
              <strong>Konkreter Arbeitsauftrag</strong>
              <p>${escapeHtml(task)}</p>
            </div>

            <div class="theory-grid">
              <div class="theory-card">
                <strong>Verbindliche Materialfragen</strong>
                <div class="question-task-list">
                  ${questionTasks.map((questionTask, index) => renderTaskPreview(questionTask, index, "Materialfrage")).join("")}
                </div>
              </div>
              <div class="theory-card">
                <strong>Warum dieses Material hier wichtig ist</strong>
                <p>${escapeHtml(resource.summary)}</p>
              </div>
            </div>

            <section class="structured-section">
              <div class="section-head">
                <strong>Arbeitsauftrag schriftlich beantworten</strong>
              </div>
              ${renderTaskField({
                task: resourceMainTaskFor({ ...assignment, resource, title, summary, task }),
                value: response.taskResponse,
                dataset: { "resource-id": resource.id, "resource-field": "taskResponse" },
                label: title
              })}
            </section>

            <section class="structured-section">
              <div class="section-head">
                <strong>Leitfragen schriftlich beantworten</strong>
                <span class="status-badge" data-doc-count="resource-questions" data-resource-id="${resource.id}">${escapeHtml(`${response.questionAnswers.filter((value) => trimmed(value)).length}/${questionTasks.length}`)}</span>
              </div>
              ${questionTasks.map((questionTask, index) => renderTaskField({
                task: questionTask,
                value: response.questionAnswers[index],
                dataset: { "resource-id": resource.id, "resource-field": "questionAnswers", index },
                label: responseLabel("Materialfrage", index, taskPrompt(questionTask))
              })).join("")}
            </section>

            <div class="video-card">
              ${resource.mediaType === "pdf"
                ? `<div class="pdf-frame-wrap"><iframe class="pdf-frame" src="${escapeHtml(resource.embedUrl)}#page=1&zoom=page-width" title="${escapeHtml(resource.title)}"></iframe></div>`
                : resource.mediaType === "html"
                  ? `<div class="pdf-frame-wrap"><iframe class="pdf-frame" src="${escapeHtml(resource.embedUrl)}" title="${escapeHtml(resource.title)}"></iframe></div>`
                  : `<div class="video-wrap"><video class="theory-video" controls preload="metadata"><source src="${escapeHtml(resource.embedUrl)}" type="video/mp4"></video></div>`
              }
            </div>
          </section>
        `;
        }).join("")}
      </div>
    </article>
  `;
}

function renderReviewList() {
  return state.peerReview.assignments.map((assignment) => `
    <button class="review-pill ${assignment.id === state.selectedReviewId ? "is-active" : ""}" data-action="select-review" data-review-id="${assignment.id}">
      <span>${escapeHtml(assignment.reviewee?.displayName || "Peer")}</span>
      <small>${escapeHtml(`${assignment.status} · ${assignment.reviewee?.lessonPortfolio?.completedEntries || 0}/${assignment.reviewee?.lessonPortfolio?.totalEntries || 0} Passagen`)}</small>
    </button>
  `).join("");
}

function renderCriterionFields(review) {
  return state.peerReview.criteria.map((criterion) => {
    const value = review.criteria.find((entry) => entry.id === criterion.id) || { id: criterion.id, level: "", comment: "" };
    return `
      <article class="criterion-card">
        <div>
          <strong>${escapeHtml(criterion.label)}</strong>
          <p>${escapeHtml(criterion.prompt)}</p>
        </div>
        <label>
          Einschätzung
          <select name="criterion-level" data-criterion-id="${criterion.id}">
            <option value="">bitte wählen</option>
            ${reviewLevels.map((level) => `<option value="${level.value}" ${value.level === level.value ? "selected" : ""}>${escapeHtml(level.label)}</option>`).join("")}
          </select>
        </label>
        <label>
          Kommentar
          <textarea name="criterion-comment" data-criterion-id="${criterion.id}" placeholder="Woran sieht die Person deine Einschätzung konkret im Text?">${escapeHtml(value.comment)}</textarea>
        </label>
      </article>
    `;
  }).join("");
}

function renderPeerPortfolio(review) {
  const entries = review.reviewee?.lessonPortfolio?.entries || [];
  if (!entries.length) {
    return '<div class="empty-box">Für diese Lektion liegt von dieser Person noch kein bearbeiteter Passagenausschnitt vor.</div>';
  }

  return entries.map((entry) => `
    <article class="peer-entry-card">
      <div class="peer-entry-head">
        <div>
          <div class="eyebrow">${escapeHtml(entry.pageHint)}</div>
          <h3>${escapeHtml(entry.title)}</h3>
        </div>
        <span class="status-badge">${escapeHtml(entry.passageLabel)}</span>
      </div>
      ${entry.observation ? `<p><strong>Beobachtung:</strong> ${escapeHtml(entry.observation)}</p>` : ""}
      ${entry.evidence ? `<p><strong>Textanker:</strong> ${escapeHtml(entry.evidence)}</p>` : ""}
      ${entry.interpretation ? `<p><strong>Deutung:</strong> ${escapeHtml(entry.interpretation)}</p>` : ""}
      ${entry.theory ? `<p><strong>Theoriebezug:</strong> ${escapeHtml(entry.theory)}</p>` : ""}
      ${entry.revision ? `<p><strong>Revision:</strong> ${escapeHtml(entry.revision)}</p>` : ""}
    </article>
  `).join("");
}

function renderPeerReviewPanel() {
  if (mode !== "open" || !state.peerReview?.enabled) {
    return "";
  }

  if (!state.peerReview.assignments?.length) {
    return `
      <section class="panel review-panel">
        <div class="panel-head">
          <div>
            <div class="eyebrow">Peer Review</div>
            <h2>Derzeit keine Zuweisungen</h2>
          </div>
        </div>
        <div class="empty-box">Sobald weitere Schüler*innen arbeiten oder Peer Review aktiviert ist, erscheinen hier deine Review-Aufträge.</div>
      </section>
    `;
  }

  const review = currentReviewAssignment();
  const reviewStatusLabel = {
    idle: "",
    saving: "speichert Review ...",
    saved: "Review gespeichert",
    error: "Review konnte nicht gespeichert werden"
  }[state.reviewSaveStatus] || "";

  return `
    <section class="panel review-panel">
      <div class="panel-head">
        <div>
          <div class="eyebrow">Peer Review</div>
          <h2>Zugewiesene Rückmeldungen</h2>
        </div>
        <span class="status-badge">${escapeHtml(`${state.peerReview.stats.completedAssignedCount}/${state.peerReview.stats.assignedCount} abgeschlossen`)}</span>
      </div>

      <div class="notice-box">
        <strong>Arbeitsrahmen</strong>
        <p>${escapeHtml(state.peerReview.instructions)}</p>
        <p>${escapeHtml(`Review-Lektion: ${lessonSets.find((lesson) => lesson.id === state.peerReview.lessonId)?.title || state.peerReview.lessonId}`)}</p>
      </div>

      <div class="review-layout">
        <aside class="review-sidebar">
          <div class="review-pill-list">
            ${renderReviewList()}
          </div>
        </aside>

        <div class="review-main">
          <div class="panel-head">
            <div>
              <div class="eyebrow">Peer-Arbeit</div>
              <h2>${escapeHtml(review.reviewee?.displayName || "Peer")}</h2>
            </div>
            <span class="status-badge">${escapeHtml(review.status)}</span>
          </div>

          <div class="review-meta-grid">
            <div class="status-card">
              <span class="eyebrow">Bearbeitete Passagen</span>
              <strong>${escapeHtml(`${review.reviewee?.lessonPortfolio?.completedEntries || 0}/${review.reviewee?.lessonPortfolio?.totalEntries || 0}`)}</strong>
            </div>
            <div class="status-card">
              <span class="eyebrow">Zuletzt aktualisiert</span>
              <strong>${escapeHtml(review.reviewee?.updatedAt ? new Date(review.reviewee.updatedAt).toLocaleString("de-CH") : "-")}</strong>
            </div>
          </div>

          <div class="peer-portfolio">
            ${renderPeerPortfolio(review)}
          </div>

          <form id="peer-review-form" class="review-form">
            <input type="hidden" name="reviewId" value="${review.id}">
            <div class="criteria-grid">
              ${renderCriterionFields(review)}
            </div>

            <label>
              Wichtiger Textanker aus der besprochenen Arbeit
              <textarea name="quotedEvidence" placeholder="Welche Formulierung oder welches Signalwort soll in der Überarbeitung unbedingt erhalten oder präzisiert werden?">${escapeHtml(review.quotedEvidence || "")}</textarea>
            </label>
            <label>
              Stärken
              <textarea name="strengths" placeholder="Was gelingt der Person textnah oder deutungsstark bereits gut?">${escapeHtml(review.strengths || "")}</textarea>
            </label>
            <label>
              Nächste Schritte
              <textarea name="nextSteps" placeholder="Welche konkrete Überarbeitung würdest du als Nächstes empfehlen?">${escapeHtml(review.nextSteps || "")}</textarea>
            </label>
            <label>
              Rückfrage
              <textarea name="question" placeholder="Welche Rückfrage hilft der Person, ihre Deutung weiter zu schärfen?">${escapeHtml(review.question || "")}</textarea>
            </label>

            <div class="row">
              <button type="submit" data-submit-status="draft">Entwurf speichern</button>
              <button type="submit" class="button secondary" data-submit-status="submitted">Review abschicken</button>
              ${reviewStatusLabel ? `<span class="inline-status">${escapeHtml(reviewStatusLabel)}</span>` : ""}
            </div>
          </form>
        </div>
      </div>
    </section>
  `;
}

function renderTopStatus() {
  const lesson = currentLesson();
  const progress = progressForCurrentLesson();
  const saveLabel = {
    idle: "bereit",
    saving: "speichert ...",
    saved: state.lastSavedAt ? `gespeichert · ${new Date(state.lastSavedAt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}` : "gespeichert",
    error: "Speicherfehler"
  }[state.saveStatus] || "bereit";

  return `
    <section class="status-strip">
      <div class="status-card">
        <span class="eyebrow">Parcours</span>
        <strong>Alle Lektionen</strong>
      </div>
      <div class="status-card">
        <span class="eyebrow">Bearbeitung</span>
        <strong>${escapeHtml(state.student?.displayName || "-")}</strong>
      </div>
      <div class="status-card">
        <span class="eyebrow">Aktive Lektion</span>
        <strong>${escapeHtml(lesson?.title || "-")}</strong>
      </div>
      <div class="status-card">
        <span class="eyebrow">Fortschritt</span>
        <strong>${escapeHtml(progress ? `${progress.completedEntries}/${progress.totalEntries}` : "-")}</strong>
      </div>
      <div class="status-card">
        <span class="eyebrow">Peer Reviews</span>
        <strong>${escapeHtml(state.peerReview?.stats ? `${state.peerReview.stats.completedAssignedCount}/${state.peerReview.stats.assignedCount}` : "-")}</strong>
      </div>
      <div class="status-card">
        <span class="eyebrow">Status</span>
        <strong>${escapeHtml(saveLabel)}</strong>
      </div>
    </section>
  `;
}

function renderProgressBox() {
  return `
    <div class="progress-box">
      ${state.progress?.lessonProgress?.map((lesson) => `
        <div class="progress-row">
          <span>${escapeHtml(lesson.title)}</span>
          <strong>${escapeHtml(`${lesson.completedEntries}/${lesson.totalEntries}`)}</strong>
        </div>
      `).join("") || ""}
    </div>
  `;
}

function replaceSlot(selector, markup) {
  const slot = document.querySelector(selector);
  if (!slot) {
    return false;
  }

  slot.innerHTML = markup;
  return true;
}

function updateTopStatusLive() {
  return replaceSlot("[data-top-status-slot]", renderTopStatus());
}

function updateProgressBoxLive() {
  return replaceSlot("[data-progress-slot]", renderProgressBox());
}

function updateParcoursExportPanelLive() {
  return replaceSlot("[data-export-slot]", renderParcoursExportPanel());
}

function updateSebFeedbackPanelLive() {
  return replaceSlot("[data-seb-feedback-slot]", renderSebFeedbackPanel());
}

function renderParcoursExportPanel() {
  const complete = isParcoursComplete();
  const answered = state.progress?.completedEntries || 0;
  const total = state.progress?.totalEntries || 0;

  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="eyebrow">Parcours-Export</div>
          <h2>${complete ? "Parcours abgeschlossen" : "Parcours dokumentieren"}</h2>
        </div>
        <button class="button secondary" data-action="export-notes">${complete ? "Fragen und Antworten exportieren" : "Zwischenstand exportieren"}</button>
      </div>
      <div class="notice-box">
        <strong>${complete ? "Alle Stationen sind bearbeitet." : "Export bereits jetzt möglich."}</strong>
        <p>${escapeHtml(`Der Export enthält alle Lektionen, Fokusfragen und die dazu eingetragenen Antworten. Aktuell sind ${answered} von ${total} Passagen bearbeitet.`)}</p>
      </div>
    </section>
  `;
}

function renderAudiobookPanel() {
  return `
    <section class="panel audiobook-panel">
      <div class="panel-head">
        <div>
          <div class="eyebrow">Hörbuch</div>
          <h2>Heidis Lehr- und Wanderjahre hören</h2>
        </div>
        <a class="button audiobook" href="${AUDIOBOOK_URL}" target="_blank" rel="noreferrer">Hörbuch in neuem Tab öffnen</a>
      </div>
      <p>Nutze das Hörbuch produktiv: Höre eine Passage, stoppe an einer auffälligen Stelle und sichere danach Beobachtung, Textanker und Deutung im Reader.</p>
      <audio class="audiobook-player" controls preload="none">
        <source src="${AUDIOBOOK_URL}" type="audio/mpeg">
      </audio>
    </section>
  `;
}

function render() {
  if (state.loading) {
    app.innerHTML = '<main class="reader-shell"><section class="panel"><h1>Lädt ...</h1><p>Arbeitsumgebung wird vorbereitet.</p></section></main>';
    return;
  }

  if (state.error && !state.ready) {
    app.innerHTML = `<main class="reader-shell"><section class="panel"><h1>Reader nicht verfügbar</h1><p>${escapeHtml(state.error)}</p></section></main>`;
    return;
  }

  ensureSelection();
  const module = currentModule();
  const entry = currentEntry();
  const lesson = currentLesson();

  app.innerHTML = `
    <main class="reader-shell">
      <section class="hero">
        <div>
          <div class="eyebrow">Johanna Spyri · Heidi · ${escapeHtml(modeLabel)}</div>
          <h1>Interaktive Lese- und Lernumgebung</h1>
          <p>
            ${mode === "seb"
              ? "Diese SEB-Fassung führt dich durch selbstständig bearbeitbare Lektionen mit integriertem Volltext, sofortigem Arbeitsfeedback, Forschungsdossiers und Filmwerkstatt."
              : "Die Einheit ist als autonomer Lernparcours gebaut. Links steuerst du Lektionen und Linsen, in der Mitte arbeitest du direkt im Volltext, rechts verbindest du Textbeobachtung, Forschung, Film, Überarbeitung und Peer Review."}
          </p>
        </div>
        <div class="hero-actions">
          <a class="button audiobook" href="#hoerbuch">Hörbuch starten</a>
          <span class="status-badge">${escapeHtml(modeLabel)}</span>
          <span class="status-badge">${lessonSets.length} Lektionen</span>
          <span class="status-badge">${escapeHtml(lesson.reviewFocus)}</span>
          ${mode === "open" ? '<a class="button secondary" href="/auth/logout">Abmelden</a>' : ""}
        </div>
      </section>

      <div id="hoerbuch">${renderAudiobookPanel()}</div>

      <div data-top-status-slot>${renderTopStatus()}</div>

      ${state.error ? `<section class="panel"><p>${escapeHtml(state.error)}</p></section>` : ""}

      <section class="layout">
        <aside class="panel sidebar">
          <div class="panel-head">
            <div>
              <div class="eyebrow">${escapeHtml(starterPrompt.title)}</div>
              <h2>Lernpfad</h2>
            </div>
          </div>
          <ul class="prompt-list">${renderPromptList()}</ul>

          <section class="lesson-box">
            <div class="eyebrow">Lernstationen</div>
            <div class="lesson-list">
              ${renderLessonRail()}
            </div>
            <div class="sidebar-task">
              <strong>${escapeHtml(lesson.title)}</strong>
              <p>${escapeHtml(mode === "seb" ? lesson.sebPrompt : lesson.summary)}</p>
              <p>${escapeHtml(`Seitenkorridor: ${pageRangeForLesson(lesson)} · ${entriesForLesson(lesson).length} Passagen`)}</p>
            </div>
          </section>

          <div data-progress-slot>${renderProgressBox()}</div>
          <div class="module-list">${renderSidebar()}</div>

          <div class="sidebar-task">
            <strong>${escapeHtml(module.title)}</strong>
            <p>${escapeHtml(module.task)}</p>
          </div>

          <section class="theory-sidebar">
            <div class="eyebrow">Interdisziplinäre Linsen</div>
            <div class="theory-pill-list">
              ${renderTheorySelector(module, entry)}
            </div>
          </section>
        </aside>

        ${renderPdfPanel(entry, module)}

        <section class="content-column">
          <article class="panel scene-panel">
            <div class="panel-head">
              <div>
                <div class="eyebrow">${escapeHtml(module.lens)}</div>
                <h2>${escapeHtml(entry.title)}</h2>
              </div>
              <span class="status-badge">${escapeHtml(entry.pageHint)}</span>
            </div>

            <div class="entry-tabs">${renderEntryTabs(module)}</div>
            <div class="scene-card">
              <h3>${escapeHtml(entry.passageLabel)}</h3>
              <p>${escapeHtml(entry.context)}</p>
              <div class="signal-grid">${renderSignalWords(entry)}</div>
              <div class="prompt-box">
                <div class="section-head">
                  <strong>Verbindliche Fokusaufträge</strong>
                  <span class="status-badge" data-doc-count="focus">${escapeHtml(`${focusAnswersFor(entry).filter((value) => trimmed(value)).length}/${focusTasksFor(entry).length}`)}</span>
                </div>
                ${renderFocusQuestions(entry)}
              </div>
              <div class="writing-frame-box">
                <strong>Satzstarter</strong>
                <p>${escapeHtml(entry.writingFrame)}</p>
              </div>
            </div>
          </article>

          ${renderTheoryPanel(module, entry)}
          ${renderResourceAssignmentsPanel()}
          ${renderNotebook(entry)}
          <div data-seb-feedback-slot>${renderSebFeedbackPanel()}</div>
          ${renderPeerReviewPanel()}
          <div data-export-slot>${renderParcoursExportPanel()}</div>
        </section>
      </section>
    </main>
  `;
}

function updateNoteField(field, value) {
  const entry = currentEntry();
  state.notes[entry.id] = {
    ...noteForEntry(entry.id),
    [field]: value
  };
  state.saveStatus = "idle";
}

function updateNoteArrayField(field, index, value) {
  const entry = currentEntry();
  const note = noteForEntry(entry.id);
  const nextValues = Array.isArray(note[field]) ? [...note[field]] : [];
  nextValues[index] = value;
  state.notes[entry.id] = {
    ...note,
    [field]: nextValues
  };
  state.saveStatus = "idle";
}

function updateTheoryAnswer(section, index, value) {
  const entry = currentEntry();
  const theory = currentTheory();
  const note = noteForEntry(entry.id);
  const stored = note.theoryResponses?.[theory.id] || {};
  const nextSection = Array.isArray(stored[section]) ? [...stored[section]] : [];
  nextSection[index] = value;

  state.notes[entry.id] = {
    ...note,
    theoryResponses: {
      ...(note.theoryResponses || {}),
      [theory.id]: {
        ...stored,
        [section]: nextSection
      }
    }
  };
  state.saveStatus = "idle";
}

function updateResourceResponse(resourceId, field, index, value) {
  const lesson = currentLesson();
  const key = resourceResponseKey(lesson.id, resourceId);
  const current = state.notes[key] || {};

  if (field === "questionAnswers") {
    const nextAnswers = Array.isArray(current.questionAnswers) ? [...current.questionAnswers] : [];
    nextAnswers[index] = value;
    state.notes[key] = {
      ...current,
      questionAnswers: nextAnswers
    };
  } else {
    state.notes[key] = {
      ...current,
      [field]: value
    };
  }

  state.saveStatus = "idle";
}

function updateLiveDocumentation() {
  const entry = currentEntry();
  const theory = currentTheory();
  if (entry && theory) {
    const focusAnswers = focusAnswersFor(entry);
    const theoryResponses = theoryResponseFor(entry, theory);
    const documentation = documentationStatusForEntry(entry, theory);
    const focusTasks = focusTasksFor(entry);
    const guidingTasks = guidingTasksFor(theory);
    const transferTasks = transferTasksFor(entry, theory);
    const summary = document.querySelector('[data-doc-summary="entry"]');
    const missing = document.querySelector('[data-doc-missing="entry"]');
    const focusCount = document.querySelector('[data-doc-count="focus"]');
    const guidingCount = document.querySelector('[data-doc-count="guiding"]');
    const transferCount = document.querySelector('[data-doc-count="transfer"]');
    const entryBox = summary?.closest(".documentation-status-box");

    if (summary) {
      summary.textContent = `Dokumentationsstand: ${documentation.completed}/${documentation.total}`;
    }

    if (missing) {
      missing.textContent = documentation.missing.length
        ? `Noch offen: ${documentation.missing.join(" · ")}`
        : "Alle Fokusfragen, Leitfragen und Transferfragen sind schriftlich dokumentiert.";
    }

    if (entryBox) {
      entryBox.classList.toggle("is-warning", Boolean(documentation.missing.length));
      entryBox.classList.toggle("is-complete", !documentation.missing.length);
    }

    if (focusCount) {
      focusCount.textContent = `${focusAnswers.filter((value) => trimmed(value)).length}/${focusTasks.length}`;
    }

    if (guidingCount) {
      guidingCount.textContent = `${theoryResponses.guidingAnswers.filter((value) => trimmed(value)).length}/${guidingTasks.length}`;
    }

    if (transferCount) {
      transferCount.textContent = `${theoryResponses.transferAnswers.filter((value) => trimmed(value)).length}/${transferTasks.length}`;
    }
  }

  for (const assignment of resourceAssignmentsForLesson()) {
    const documentation = documentationStatusForAssignment(assignment);
    const box = document.querySelector(`[data-doc-box="resource"][data-resource-id="${assignment.resourceId}"]`);
    const summary = box?.querySelector('[data-doc-summary="resource"]');
    const missing = box?.querySelector('[data-doc-missing="resource"]');
    const count = document.querySelector(`[data-doc-count="resource-questions"][data-resource-id="${assignment.resourceId}"]`);
    const response = resourceResponseForAssignment(assignment);

    if (summary) {
      summary.textContent = `Dokumentationsstand: ${documentation.completed}/${documentation.total}`;
    }

    if (missing) {
      missing.textContent = documentation.missing.length
        ? `Noch offen: ${documentation.missing.join(" · ")}`
        : "Der Materialauftrag ist vollständig schriftlich dokumentiert.";
    }

    if (box) {
      box.classList.toggle("is-warning", Boolean(documentation.missing.length));
      box.classList.toggle("is-complete", !documentation.missing.length);
    }

    if (count) {
      count.textContent = `${response.questionAnswers.filter((value) => trimmed(value)).length}/${resourceQuestionTasksFor(assignment).length}`;
    }
  }
}

function updateNotebookFeedbackLive() {
  if (mode === "seb") {
    return;
  }

  const entry = currentEntry();
  const module = currentModule();
  const feedbackBox = document.querySelector("[data-live-note-feedback]");
  if (!entry || !module || !feedbackBox) {
    return;
  }

  feedbackBox.innerHTML = renderNotebookFeedbackMarkup(noteForEntry(entry.id), module, entry);
}

function taskForInputElement(element) {
  const index = Number(element.dataset.index || 0);

  if (element.dataset.noteArray === "focusAnswers") {
    return focusTasksFor(currentEntry())[index] || null;
  }

  if (element.dataset.noteTheorySection === "guidingAnswers") {
    return guidingTasksFor(currentTheory())[index] || null;
  }

  if (element.dataset.noteTheorySection === "transferAnswers") {
    return transferTasksFor(currentEntry(), currentTheory())[index] || null;
  }

  if (element.dataset.resourceId) {
    const assignment = resourceAssignmentsForLesson().find((item) => item.resourceId === element.dataset.resourceId);
    if (!assignment) {
      return null;
    }

    if (element.dataset.resourceField === "taskResponse") {
      return resourceMainTaskFor(assignment);
    }

    if (element.dataset.resourceField === "questionAnswers") {
      return resourceQuestionTasksFor(assignment)[index] || null;
    }
  }

  return null;
}

function updateTaskFeedbackForElement(element) {
  const wrapper = element.closest(".question-answer-block");
  const feedbackBox = wrapper?.querySelector("[data-task-feedback]");
  const task = taskForInputElement(element);
  if (!wrapper || !feedbackBox || !task) {
    return;
  }

  const feedback = evaluateAnswer(element.value, task);
  feedbackBox.className = `task-feedback task-feedback--${feedback.level}`;
  feedbackBox.innerHTML = renderTaskFeedbackMarkup(task, feedback);
}

function updateReviewField(field, value) {
  const review = currentReviewAssignment();
  if (!review) {
    return;
  }

  review[field] = value;
  state.reviewSaveStatus = "idle";
}

function updateReviewCriterion(criterionId, field, value) {
  const review = currentReviewAssignment();
  if (!review) {
    return;
  }

  const current = review.criteria.find((entry) => entry.id === criterionId);
  if (current) {
    current[field] = value;
  }
  state.reviewSaveStatus = "idle";
}

async function submitReview(status) {
  const review = currentReviewAssignment();
  if (!review) {
    return;
  }

  state.reviewSaveStatus = "saving";
  render();

  try {
    const response = await fetch(`/reader-api/reviews/${review.id}`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status,
        criteria: review.criteria,
        quotedEvidence: review.quotedEvidence,
        strengths: review.strengths,
        nextSteps: review.nextSteps,
        question: review.question
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Peer Review konnte nicht gespeichert werden.");
    }

    const payload = await response.json();
    applyBootstrap(payload);
    state.reviewSaveStatus = "saved";
    render();
  } catch (error) {
    state.reviewSaveStatus = "error";
    state.error = error.message;
    render();
  }
}

function exportNotes() {
  const markdown = buildParcoursMarkdown({
    modeLabel,
    classroomName: state.classroom?.name || "-",
    studentName: state.student?.displayName || "-",
    complete: isParcoursComplete(),
    completedEntries: state.progress?.completedEntries || 0,
    totalEntries: state.progress?.totalEntries || 0,
    lessons: availableLessons().map((lesson) => ({
      title: lesson.title,
      summary: lesson.summary,
      reviewFocus: lesson.reviewFocus,
      pageRange: pageRangeForLesson(lesson),
      resources: resourceAssignmentsForLesson(lesson).map((assignment) => {
        const response = resourceResponseForAssignment(assignment, lesson);
        const documentation = documentationStatusForAssignment(assignment, lesson);
        const questionTasks = resourceQuestionTasksFor(assignment);

        return {
          title: assignment.title,
          sourceTitle: assignment.resource.sourceTitle,
          summary: assignment.summary,
          task: assignment.task,
          taskResponse: response.taskResponse,
          questions: questionTasks.map((questionTask, index) => ({
            prompt: taskPrompt(questionTask),
            answer: response.questionAnswers[index] || ""
          })),
          documentation
        };
      }),
      entries: entriesForLesson(lesson).map((entry) => {
        const note = noteForEntry(entry.id);
        const module = entryIndex.get(entry.id)?.module;
        const exportTheories = theoryOptionsFor(module, entry);
        const documentationTheory = exportTheories.find((resource) => resource.id === state.theoryId) || exportTheories[0];
        const focusTasks = focusTasksFor(entry);
        const theorySections = theoryIdsFor(module, entry)
          .map((theoryId) => theoryResources.find((resource) => resource.id === theoryId))
          .filter(Boolean)
          .map((theory) => {
            const stored = note.theoryResponses?.[theory.id] || {};
            const guidingTasks = guidingTasksFor(theory);
            const transferTasks = transferTasksFor(entry, theory);

            return {
              title: theory.title,
              sourceTitle: theory.sourceTitle,
              guidingQuestions: guidingTasks.map((questionTask, index) => ({
                prompt: taskPrompt(questionTask),
                answer: stored.guidingAnswers?.[index] || ""
              })),
              transferQuestions: transferTasks.map((transferTask, index) => ({
                prompt: taskPrompt(transferTask),
                answer: stored.transferAnswers?.[index] || ""
              }))
            };
          });

        return {
          title: entry.title,
          moduleTitle: module?.title || "-",
          pageHint: entry.pageHint,
          passageLabel: entry.passageLabel,
          context: entry.context,
          prompts: entry.prompts,
          signalWords: entry.signalWords,
          writingFrame: entry.writingFrame,
          focusAnswers: focusTasks.map((focusTask, index) => ({
            prompt: taskPrompt(focusTask),
            answer: note.focusAnswers?.[index] || ""
          })),
          theorySections,
          documentation: documentationTheory ? documentationStatusForEntry(entry, documentationTheory) : null,
          answers: {
            observation: note.observation || "-",
            evidence: note.evidence || "-",
            interpretation: note.interpretation || "-",
            theory: note.theory || "-",
            revision: note.revision || "-"
          }
        };
      })
    }))
  });

  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `die-reise-der-verlorenen-parcours-${mode}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  const action = target.dataset.action;

  if (action === "select-lesson" && !target.disabled) {
    state.lessonId = target.dataset.lessonId;
    ensureSelection();
    render();
    queueSave();
    queueSebFeedback();
  }

  if (action === "select-module") {
    state.moduleId = target.dataset.moduleId;
    state.entryId = currentModule().entries[0].id;
    ensureSelection();
    render();
    queueSave();
    queueSebFeedback();
  }

  if (action === "select-entry") {
    state.entryId = target.dataset.entryId;
    state.moduleId = entryIndex.get(target.dataset.entryId)?.module.id || state.moduleId;
    ensureSelection();
    render();
    queueSave();
    queueSebFeedback();
  }

  if (action === "select-theory") {
    state.theoryId = target.dataset.theoryId;
    render();
    queueSave();
    queueSebFeedback();
  }

  if (action === "toggle-signal") {
    const entry = currentEntry();
    const word = target.dataset.word;
    const note = noteForEntry(entry.id);
    const tokens = note.evidence
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);

    const nextTokens = tokens.includes(word)
      ? tokens.filter((token) => token !== word)
      : [...tokens, word];

    updateNoteField("evidence", nextTokens.join(", "));
    render();
    queueSave();
    queueSebFeedback();
  }

  if (action === "select-review") {
    state.selectedReviewId = target.dataset.reviewId;
    state.reviewSaveStatus = "idle";
    render();
  }

  if (action === "export-notes") {
    exportNotes();
  }

  if (action === "refresh-seb-feedback") {
    requestSebFeedback({ showLoading: true, force: true });
  }
});

document.addEventListener("input", (event) => {
  if (event.target.dataset.noteArray) {
    updateNoteArrayField(event.target.dataset.noteArray, Number(event.target.dataset.index || 0), event.target.value);
    updateTaskFeedbackForElement(event.target);
    queueSave();
    queueSebFeedback();
    updateLiveDocumentation();
    return;
  }

  if (event.target.dataset.noteTheorySection) {
    updateTheoryAnswer(event.target.dataset.noteTheorySection, Number(event.target.dataset.index || 0), event.target.value);
    updateTaskFeedbackForElement(event.target);
    queueSave();
    queueSebFeedback();
    updateLiveDocumentation();
    return;
  }

  const noteForm = event.target.closest("#note-form");
  if (noteForm) {
    updateNoteField(event.target.name, event.target.value);
    queueSave();
    queueSebFeedback();
    updateLiveDocumentation();
    updateNotebookFeedbackLive();
    return;
  }

  if (event.target.dataset.resourceId) {
    updateResourceResponse(
      event.target.dataset.resourceId,
      event.target.dataset.resourceField,
      Number(event.target.dataset.index || 0),
      event.target.value
    );
    updateTaskFeedbackForElement(event.target);
    queueSave();
    updateLiveDocumentation();
    return;
  }

  const reviewForm = event.target.closest("#peer-review-form");
  if (reviewForm) {
    if (event.target.name === "criterion-level") {
      updateReviewCriterion(event.target.dataset.criterionId, "level", event.target.value);
    } else if (event.target.name === "criterion-comment") {
      updateReviewCriterion(event.target.dataset.criterionId, "comment", event.target.value);
    } else {
      updateReviewField(event.target.name, event.target.value);
    }
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "peer-review-form") {
    return;
  }

  event.preventDefault();
  const submitter = event.submitter;
  const status = submitter?.dataset.submitStatus || "draft";
  submitReview(status);
});

async function init() {
  render();

  try {
    const payload = await fetchBootstrap();
    applyBootstrap(payload);
    state.ready = true;
    state.loading = false;
    state.error = "";
    ensureSelection();
    render();
    if (mode === "seb") {
      await requestSebFeedback({ showLoading: true, force: true });
    }
  } catch (error) {
    state.loading = false;
    state.ready = false;
    state.error = error.message;
    render();
  }
}

init();
