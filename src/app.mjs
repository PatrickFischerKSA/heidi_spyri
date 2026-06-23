import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { theoryResources } from "../public/kehlmann-reader/data.js";
import { kehlmannReaderApiRouter } from "./routes/kehlmann-reader-api.mjs";
import { hasOpenAccess, isSafeExamBrowserRequest, parseCookies } from "./services/access.mjs";
import { getEntriesForLesson, getLessonSetById, getLessonSetsWithCounts } from "./services/kehlmann-reader-progress.mjs";
import {
  buildReaderBootstrap,
  createOrResumeStudent,
  readReaderStore,
  updateReaderStore
} from "./services/kehlmann-reader-store.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");
const readerDir = path.join(publicDir, "kehlmann-reader");
const teacherDir = path.join(publicDir, "kehlmann-teacher");
const jsDir = path.join(publicDir, "js");
const readerAssetDir = path.join(publicDir, "reader/assets");
const OPEN_COOKIE = "kehlmann_open_access";
const STUDENT_COOKIE = "kehlmann_reader_student";
const CLASS_COOKIE = "kehlmann_reader_class";
const NAME_COOKIE = "kehlmann_reader_name";
const MODE_COOKIE = "kehlmann_reader_mode";
const TEACHER_COOKIE = "kehlmann_teacher_access";
const SEB_CONFIG_KEY_HASH = process.env.SEB_CONFIG_KEY_HASH || process.env.KEHLMANN_SEB_CONFIG_KEY_HASH || "";
const READER_PDF_SOURCE = "/reader/assets/heidi-volltext.html";
const BACKGROUND_VIDEO = "/reader/assets/heidi-background.mp4";
const AUDIOBOOK_URL = "/reader/assets/heidi-hoerbuch.mp3";
const ASSET_VERSION = process.env.RENDER_GIT_COMMIT || String(Date.now());

function teacherRuntimeConfig() {
  return {
    openUrl: "/open",
    sebUrl: "/seb",
    teacherUrl: "/teacher",
    teacherEntryUrl: "/teacher-entry",
    hasSebConfigKeyHash: Boolean(SEB_CONFIG_KEY_HASH)
  };
}

function assetUrl(pathname) {
  return `${pathname}?v=${encodeURIComponent(ASSET_VERSION)}`;
}

function renderShellPage({ title, body, bodyClass = "" }) {
  return `
    <!doctype html>
    <html lang="de">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${title}</title>
        <style>
          :root {
            --bg: #f3efe7;
            --surface: rgba(255,255,255,0.12);
            --border: rgba(48,66,55,0.16);
            --text: #172119;
            --muted: #46514a;
            --accent: #b45c39;
            --forest: #314335;
            --shadow: 0 20px 60px rgba(30, 42, 36, 0.12);
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            font-family: "Avenir Next", "Segoe UI", sans-serif;
            color: var(--text);
            background: linear-gradient(180deg, #f4f0e6 0%, #ece6d7 100%);
            position: relative;
            overflow-x: hidden;
          }
          .site-background {
            position: fixed;
            inset: 0;
            overflow: hidden;
            z-index: 0;
            pointer-events: none;
            background: #263327;
          }
          .site-background-video {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            filter: blur(5px) saturate(0.92) contrast(1.12) brightness(0.72);
            transform: scale(1.03);
            opacity: 1;
          }
          .site-background::before {
            content: "";
            position: absolute;
            inset: -24px;
            background:
              linear-gradient(180deg, rgba(56, 50, 45, 0.18) 0%, rgba(34, 31, 28, 0.24) 100%);
            filter: blur(6px) saturate(0.94) contrast(1.14) brightness(0.74);
            transform: scale(1.02);
            opacity: 0.28;
          }
          .site-background::after {
            content: "";
            position: absolute;
            inset: 0;
            background:
              linear-gradient(90deg, rgba(247, 240, 230, 0.24) 0%, rgba(247, 240, 230, 0.08) 24%, rgba(38, 34, 31, 0.12) 70%, rgba(24, 28, 25, 0.24) 100%),
              radial-gradient(circle at 54% 18%, rgba(255, 248, 238, 0.01), rgba(255, 248, 238, 0.01) 14%, rgba(255, 248, 238, 0.12) 42%, rgba(214, 206, 192, 0.22) 100%),
              radial-gradient(circle at 22% 18%, rgba(180, 92, 57, 0.08), transparent 0 18%),
              radial-gradient(circle at 80% 14%, rgba(49, 67, 53, 0.12), transparent 0 20%);
          }
          .background-video-toggle {
            position: fixed;
            right: 18px;
            bottom: 18px;
            z-index: 10;
            border: 1px solid rgba(255,255,255,0.36);
            border-radius: 999px;
            padding: 10px 14px;
            color: #fffaf0;
            background: rgba(23, 33, 25, 0.78);
            box-shadow: 0 12px 34px rgba(20, 28, 23, 0.22);
            backdrop-filter: blur(12px);
            cursor: pointer;
          }
          .background-video-toggle:hover,
          .background-video-toggle:focus-visible {
            background: rgba(23, 33, 25, 0.9);
          }
          .page {
            max-width: 1120px;
            margin: 0 auto;
            padding: 28px 20px 48px;
            display: grid;
            gap: 20px;
            position: relative;
            z-index: 1;
          }
          .panel {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 28px;
            box-shadow: var(--shadow);
            padding: 24px;
            backdrop-filter: blur(14px);
          }
          body.login-page .page {
            min-height: 100vh;
            align-content: center;
          }
          body.login-page .panel {
            max-width: 980px;
            background: rgba(246, 248, 242, 0.88);
            border-color: rgba(49, 67, 53, 0.2);
          }
          body.login-page h1 {
            font-size: clamp(3rem, 7vw, 5.2rem);
          }
          body.login-page .notice {
            background: rgba(238, 228, 216, 0.9);
          }
          body.teacher-entry-page {
            background: #edf0ea;
          }
          body.teacher-entry-page .site-background {
            background: linear-gradient(180deg, rgba(223, 227, 219, 0.58) 0%, rgba(215, 220, 210, 0.56) 100%);
          }
          body.teacher-entry-page .site-background::before {
            opacity: 0.96;
            filter: blur(7px) saturate(0.88) contrast(1.1) brightness(0.78);
          }
          body.teacher-entry-page .site-background::after {
            background:
              linear-gradient(180deg, rgba(241, 244, 238, 0.42) 0%, rgba(229, 234, 225, 0.4) 100%),
              radial-gradient(circle at 18% 20%, rgba(180, 92, 57, 0.05), transparent 0 16%);
          }
          body.teacher-entry-page .page {
            max-width: 1320px;
            gap: 16px;
          }
          body.teacher-entry-page .panel {
            border-radius: 16px;
            box-shadow: none;
            padding: 20px;
            background: rgba(248, 249, 245, 0.96);
            backdrop-filter: none;
          }
          .eyebrow {
            text-transform: uppercase;
            letter-spacing: 0.12em;
            font-size: 12px;
            color: var(--muted);
            margin-bottom: 10px;
          }
          h1, h2 {
            margin: 0 0 12px;
            font-family: "Iowan Old Style", "Palatino Linotype", serif;
          }
          h1 {
            font-size: clamp(2rem, 5vw, 3.6rem);
            line-height: 0.95;
          }
          p, li {
            line-height: 1.6;
            color: var(--muted);
          }
          strong,
          b {
            color: var(--text);
          }
          .row {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
          }
          .button, button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border: none;
            border-radius: 999px;
            padding: 12px 18px;
            background: var(--forest);
            color: #f6f2ea;
            text-decoration: none;
            cursor: pointer;
          }
          .button.secondary, button.secondary {
            background: rgba(49,67,53,0.1);
            color: var(--forest);
          }
          .button.audiobook {
            background: #b45c39;
            color: #fffaf0;
            box-shadow: 0 12px 30px rgba(180, 92, 57, 0.22);
          }
          .audiobook-callout {
            margin-top: 16px;
            padding: 16px;
            border-radius: 22px;
            border: 1px solid rgba(180, 92, 57, 0.28);
            background: rgba(180, 92, 57, 0.12);
            display: grid;
            gap: 12px;
          }
          body.teacher-entry-page .button,
          body.teacher-entry-page button {
            border-radius: 12px;
            padding: 10px 14px;
          }
          body.teacher-entry-page .button.secondary,
          body.teacher-entry-page button.secondary {
            background: #e2e6dd;
            color: var(--text);
          }
          input, select {
            width: 100%;
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 12px 14px;
            font: inherit;
            margin: 10px 0 12px;
            background: rgba(255,255,255,0.78);
          }
          .notice {
            border-left: 4px solid var(--accent);
            padding: 14px;
            background: rgba(180,92,57,0.09);
            border-radius: 0 14px 14px 0;
            color: #62463d;
          }
          body.teacher-entry-page .notice {
            border-left-width: 5px;
            border-radius: 8px;
            background: #efe3d8;
          }
          .form-grid {
            display: grid;
            gap: 10px;
          }
          .small-list {
            margin: 0;
            padding-left: 18px;
          }
          .small-list li {
            color: #233028;
            font-weight: 520;
          }
          .small-list li::marker {
            color: rgba(49, 67, 53, 0.7);
          }
          .teacher-entry-layout {
            display: grid;
            gap: 20px;
            grid-template-columns: minmax(280px, 0.38fr) minmax(0, 1fr);
          }
          .teacher-entry-sidebar,
          .teacher-entry-viewer,
          .teacher-entry-passage-list {
            display: grid;
            gap: 12px;
          }
          .teacher-entry-resource-list {
            display: grid;
            gap: 12px;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          }
          .lesson-nav-card,
          .passage-nav-card,
          .resource-nav-card {
            display: grid;
            gap: 8px;
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 14px;
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(12px);
            text-decoration: none;
            color: var(--text);
          }
          body.teacher-entry-page .teacher-entry-layout {
            gap: 16px;
            grid-template-columns: 320px minmax(0, 1fr);
            align-items: start;
          }
          body.teacher-entry-page .teacher-entry-sidebar {
            position: sticky;
            top: 18px;
          }
          body.teacher-entry-page .lesson-nav-card,
          body.teacher-entry-page .passage-nav-card,
          body.teacher-entry-page .resource-nav-card {
            border-radius: 10px;
            padding: 12px 14px;
            background: #ffffff;
            backdrop-filter: none;
          }
          .lesson-nav-card.is-active,
          .passage-nav-card.is-active,
          .resource-nav-card.is-active {
            border-color: rgba(180, 92, 57, 0.45);
            background: rgba(180, 92, 57, 0.14);
          }
          body.teacher-entry-page .lesson-nav-card.is-active,
          body.teacher-entry-page .passage-nav-card.is-active,
          body.teacher-entry-page .resource-nav-card.is-active {
            background: #f0e3d7;
          }
          .meta-grid {
            display: grid;
            gap: 12px;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          }
          .meta-card {
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 14px;
            background: rgba(255,255,255,0.06);
            backdrop-filter: blur(12px);
          }
          body.teacher-entry-page .meta-card {
            border-radius: 10px;
            background: #ffffff;
            backdrop-filter: none;
          }
          .iframe-shell {
            min-height: 72vh;
            border: 1px solid var(--border);
            border-radius: 20px;
            overflow: hidden;
            background: rgba(255,255,255,0.03);
            backdrop-filter: blur(10px);
          }
          body.teacher-entry-page .iframe-shell {
            border-radius: 12px;
            background: #ffffff;
            backdrop-filter: none;
          }
          .iframe-shell iframe {
            width: 100%;
            min-height: 72vh;
            border: none;
          }
          .prompt-panel {
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 16px;
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(12px);
          }
          body.teacher-entry-page .prompt-panel {
            display: grid;
            gap: 12px;
            border-radius: 10px;
            border: 1px solid #d5dbd0;
            border-left: 6px solid var(--forest);
            padding: 18px;
            background: #ffffff;
            backdrop-filter: none;
          }
          .compact-task-list {
            display: grid;
            gap: 10px;
            margin-top: 14px;
          }
          .compact-task-card {
            display: grid;
            gap: 6px;
            border-left: 4px solid var(--accent);
            padding: 12px 14px;
            border-radius: 0 16px 16px 0;
            background: rgba(180,92,57,0.08);
          }
          body.teacher-entry-page .compact-task-list {
            gap: 8px;
            margin-top: 4px;
          }
          body.teacher-entry-page .compact-task-card {
            grid-template-columns: 140px minmax(0, 1fr);
            align-items: start;
            gap: 10px;
            border-left: none;
            border-radius: 8px;
            padding: 10px 12px;
            background: #f4f6f1;
          }
          body.teacher-entry-page .compact-task-card strong {
            color: var(--forest);
          }
          body.teacher-entry-page .compact-task-card p {
            margin: 0;
          }
          .resource-panel {
            display: grid;
            gap: 14px;
          }
          .lesson-media-panel {
            display: grid;
            gap: 14px;
          }
          .lesson-media-grid {
            display: grid;
            gap: 14px;
          }
          .lesson-media-card {
            display: grid;
            gap: 12px;
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 14px;
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(12px);
          }
          .lesson-media-frame {
            overflow: hidden;
            border-radius: 16px;
            border: 1px solid var(--border);
            background: linear-gradient(180deg, rgba(240, 234, 223, 0.1), rgba(230, 222, 205, 0.05));
            padding: 12px;
          }
          .lesson-media-frame img {
            display: block;
            width: 100%;
            height: 300px;
            object-fit: contain;
            object-position: center center;
          }
          .lesson-media-task {
            border-left: 4px solid var(--accent);
            padding: 12px 14px;
            border-radius: 0 14px 14px 0;
            background: rgba(180,92,57,0.09);
          }
          @media (max-width: 960px) {
            .teacher-entry-layout {
              grid-template-columns: 1fr;
            }
            .iframe-shell,
            .iframe-shell iframe {
              min-height: 58vh;
            }
          }
        </style>
      </head>
      <body class="${bodyClass}">
        <div class="site-background" aria-hidden="true">
          <video class="site-background-video" data-background-video autoplay muted loop playsinline>
            <source src="${assetUrl(BACKGROUND_VIDEO)}" type="video/mp4">
          </video>
        </div>
        <button class="background-video-toggle" type="button" data-background-video-toggle>Video stoppen</button>
        ${body}
        <script src="${assetUrl("/js/background-video.js")}"></script>
      </body>
    </html>
  `;
}

function lessonMeta(lessonId) {
  if (!lessonId) {
    return null;
  }

  return getLessonSetById(lessonId);
}

function renderLandingPage() {
  const lessons = getLessonSetsWithCounts();
  return renderShellPage({
    title: "Heidi Lernumgebung",
    body: `
      <main class="page">
        <section class="panel">
          <div class="eyebrow">Johanna Spyri</div>
          <h1>Heidi</h1>
          <p>
            Autonome Lese- und Lernumgebung mit integriertem Volltext, offener Anmeldung,
            Lehrer*innen-Dashboard, Peer Review und direktem
            Arbeitsfeedback. Die Einheit verbindet die Romanlektüre mit Archivfragen,
            Religion, Naturpädagogik, Stadt-Land-Kontrast, Bildgeschichte, Forschung und
            dem Dokumentarfilm <em>Heidis Alptraum</em> als interpretatorischer Erweiterung.
          </p>
          <div class="row">
            <a class="button" href="/open">Offene Version</a>
            <a class="button audiobook" href="${AUDIOBOOK_URL}" target="_blank" rel="noreferrer">Hörbuch starten</a>
            <a class="button secondary" href="/seb">SEB-Version</a>
            <a class="button secondary" href="/teacher-entry">Lehrer*inneneingang</a>
            <a class="button secondary" href="/teacher">Lehrer*innen-Dashboard</a>
          </div>
          <div class="audiobook-callout">
            <strong>Hörbuch zur Romanlektüre</strong>
            <p>Das vollständige Hörbuch ist als Arbeitsfassung integriert und kann parallel zum Volltext genutzt werden.</p>
            <a class="button audiobook" href="${AUDIOBOOK_URL}" target="_blank" rel="noreferrer">Hörbuch öffnen</a>
          </div>
        </section>
        <section class="panel">
          <div class="eyebrow">Autonome Lernpfade</div>
          <ul class="small-list">
            ${lessons.map((lesson) => `<li><strong>${lesson.title}:</strong> ${lesson.summary}</li>`).join("")}
          </ul>
        </section>
      </main>
    `
  });
}

function pageRangeForLesson(lesson) {
  const pageNumbers = getEntriesForLesson(lesson.id)
    .map((entry) => Number(entry.pageNumber || 0))
    .filter(Boolean);

  if (!pageNumbers.length) {
    return "-";
  }

  const first = Math.min(...pageNumbers);
  const last = Math.max(...pageNumbers);
  return first === last ? `S. ${first}` : `S. ${first}-${last}`;
}

function teacherEntryLessons() {
  const lessons = getLessonSetsWithCounts();
  return lessons.map((lesson) => ({
    ...lesson,
    pageRange: pageRangeForLesson(lesson),
    entries: getEntriesForLesson(lesson.id)
  }));
}

function resourcesForLesson(lesson) {
  const assignmentIds = Array.isArray(lesson?.resourceAssignments)
    ? lesson.resourceAssignments.map((assignment) => assignment.resourceId)
    : [];
  const ids = assignmentIds.length
    ? assignmentIds
    : (Array.isArray(lesson?.recommendedTheoryIds) ? lesson.recommendedTheoryIds : []);

  return ids
    .map((resourceId) => {
      const resource = theoryResources.find((entry) => entry.id === resourceId);
      if (!resource) {
        return null;
      }

      const assignment = lesson.resourceAssignments?.find((entry) => entry.resourceId === resourceId);
      return {
        resource,
        assignment
      };
    })
    .filter(Boolean);
}

function renderTeacherEntryPage({ lessonId, entryId } = {}) {
  const config = teacherRuntimeConfig();
  const lessons = teacherEntryLessons();
  const currentLesson = lessons.find((lesson) => lesson.id === lessonId) || lessons[0];
  const currentEntry = currentLesson.entries.find((entry) => entry.id === entryId) || currentLesson.entries[0];
  const pdfUrl = `${READER_PDF_SOURCE}#page=${currentEntry?.pageNumber || 1}&zoom=page-width`;
  const lessonResources = resourcesForLesson(currentLesson);
  const lessonMedia = Array.isArray(currentLesson.chapterMedia) ? currentLesson.chapterMedia : [];
  const selectedResource = lessonResources[0] || null;
  const selectedResourceMarkup = selectedResource
    ? selectedResource.resource.mediaType === "pdf"
      ? `<div class="iframe-shell"><iframe src="${selectedResource.resource.embedUrl}#page=1&zoom=page-width" title="${selectedResource.resource.title}"></iframe></div>`
      : selectedResource.resource.mediaType === "html"
        ? `<div class="iframe-shell"><iframe src="${selectedResource.resource.embedUrl}" title="${selectedResource.resource.title}"></iframe></div>`
      : `
        <div class="prompt-panel">
          <video controls preload="metadata" style="width:100%; border-radius:16px; background:#000;">
            <source src="${selectedResource.resource.embedUrl}" type="video/mp4">
          </video>
        </div>
      `
    : "";

  return renderShellPage({
    title: "Lehrer*inneneingang · Heidi",
    bodyClass: "teacher-entry-page",
    body: `
      <main class="page">
        <section class="panel">
          <div class="eyebrow">Lehrer*inneneingang</div>
          <h1>Steueransicht für Unterricht und Prüfung</h1>
          <p>
            Diese Übersicht zeigt alle Lektionen, Leitfragen, Materialien und Arbeitsaufträge direkt,
            als vollständigen Parcours für die Unterrichtsarbeit.
          </p>
          <div class="row">
            <a class="button" href="/">Zur Startseite</a>
            <a class="button secondary" href="/teacher">Zum Lehrer*innen-Dashboard</a>
            <a class="button secondary" href="/open/lesson/${currentLesson.id}">Diese Lektion im Reader öffnen</a>
          </div>
        </section>

        <section class="panel">
          <div class="eyebrow">Betriebsprotokoll</div>
          <h2>Namen eintragen, alle Lektionen bearbeiten</h2>
          <div class="meta-grid">
            <div class="meta-card">
              <strong>Offene Version</strong>
              <p>${config.openUrl}</p>
            </div>
            <div class="meta-card">
              <strong>SEB-Version</strong>
              <p>${config.sebUrl}</p>
            </div>
            <div class="meta-card">
              <strong>Anmeldung</strong>
              <p>Nur Name. Danach ist der vollständige Parcours geöffnet.</p>
            </div>
          </div>
          <div class="teacher-entry-resource-list">
            <article class="resource-nav-card">
              <strong>1. Öffnen</strong>
              <span>Schüler*innen öffnen <em>${config.openUrl}</em> und tragen ihren Namen ein.</span>
            </article>
            <article class="resource-nav-card">
              <strong>2. Arbeiten</strong>
              <span>Alle Lektionen sind verfügbar und sollen im Verlauf absolviert werden.</span>
            </article>
            <article class="resource-nav-card">
              <strong>3. Kontrollieren</strong>
              <span>Im Dashboard siehst du Fortschritt, Textanker, Theoriebezüge und Peer Reviews.</span>
            </article>
            <article class="resource-nav-card">
              <strong>4. SEB optional</strong>
              <span>Falls nötig, öffnen Schüler*innen <em>${config.sebUrl}</em> im Safe Exam Browser und tragen ebenfalls nur ihren Namen ein.</span>
            </article>
          </div>
        </section>

        <section class="teacher-entry-layout">
          <aside class="panel teacher-entry-sidebar">
            <div>
              <div class="eyebrow">Lektionen</div>
              <h2>Direkter Aufgabenüberblick</h2>
            </div>
            ${lessons.map((lesson) => `
              <a class="lesson-nav-card ${lesson.id === currentLesson.id ? "is-active" : ""}" href="/teacher-entry?lesson=${lesson.id}">
                <strong>${lesson.title}</strong>
                <span>${lesson.summary}</span>
                <span>${lesson.pageRange} · ${lesson.entryCount} Passagen</span>
              </a>
            `).join("")}
          </aside>

          <section class="panel teacher-entry-viewer">
            <div>
              <div class="eyebrow">${currentLesson.title}</div>
              <h2>${currentLesson.summary}</h2>
            </div>

            <div class="meta-grid">
              <div class="meta-card">
                <strong>Review-Fokus</strong>
                <p>${currentLesson.reviewFocus}</p>
              </div>
              <div class="meta-card">
                <strong>SEB-Arbeitsauftrag</strong>
                <p>${currentLesson.sebPrompt}</p>
              </div>
              <div class="meta-card">
                <strong>Seitenkorridor</strong>
                <p>${currentLesson.pageRange}</p>
              </div>
            </div>

            ${lessonMedia.length ? `
              <section class="lesson-media-panel">
                <div class="eyebrow">Medienauftakt dieser Lektion</div>
                <div class="lesson-media-grid">
                  ${lessonMedia.map((item) => `
                    <article class="lesson-media-card">
                      <div class="lesson-media-frame">
                        <img src="${item.src}" alt="${item.alt || item.title}">
                      </div>
                      <div>
                        <div class="eyebrow">${item.mediaLabel || "Kapitelauftakt"}</div>
                        <strong>${item.title}</strong>
                        <p>${item.caption}</p>
                        ${item.openUrl || item.audioUrl ? `
                          <div class="row">
                            ${item.openUrl ? `<a class="button secondary" href="${item.openUrl}" target="_blank" rel="noreferrer">${item.openLabel || "Medium öffnen"}</a>` : ""}
                            ${item.audioUrl ? `<a class="button secondary" href="${item.audioUrl}" target="_blank" rel="noreferrer">${item.audioLabel || "Audio öffnen"}</a>` : ""}
                          </div>
                        ` : ""}
                      </div>
                      <div class="lesson-media-task">
                        <strong>Arbeitsimpuls</strong>
                        <p>${item.focusPrompt}</p>
                      </div>
                    </article>
                  `).join("")}
                </div>
              </section>
            ` : ""}

            <div class="teacher-entry-passage-list">
              <div class="eyebrow">Passagen dieser Lektion</div>
              ${currentLesson.entries.map((entry) => `
                <a class="passage-nav-card ${entry.id === currentEntry.id ? "is-active" : ""}" href="/teacher-entry?lesson=${currentLesson.id}&entry=${entry.id}">
                  <strong>${entry.title}</strong>
                  <span>${entry.pageHint} · ${entry.passageLabel}</span>
                </a>
              `).join("")}
            </div>

            <div class="prompt-panel">
              <div class="eyebrow">Aktuelle Passage</div>
              <h2>${currentEntry.title}</h2>
              <p><strong>${currentEntry.pageHint}</strong> · ${currentEntry.passageLabel}</p>
              <p>${currentEntry.context}</p>
              <div class="notice">Im Lehrer*inneneingang erscheint nur der knappe Aufgabenüberblick. Die interaktiven Textfelder mit Sofortfeedback liegen ausschliesslich im Reader.</div>
              <div class="row">
                <a class="button secondary" href="/open/lesson/${currentLesson.id}" target="_blank" rel="noreferrer">Diese Lektion im Reader öffnen</a>
                <a class="button secondary" href="/seb/lesson/${currentLesson.id}" target="_blank" rel="noreferrer">SEB-Ansicht öffnen</a>
              </div>
              <div class="compact-task-list">
                ${(currentEntry.focusTasks || []).map((task, index) => `
                  <article class="compact-task-card">
                    <strong>Fokusauftrag ${index + 1}</strong>
                    <p>${task.prompt}</p>
                  </article>
                `).join("")}
              </div>
            </div>

            <div class="iframe-shell">
              <iframe src="${pdfUrl}" title="Heidi Volltext"></iframe>
            </div>

            ${lessonResources.length ? `
              <section class="resource-panel">
                <div>
                  <div class="eyebrow">Pflichtressourcen dieser Lektion</div>
                  <h2>Podcast, Dossiers, Sekundärtexte und Theorie integriert</h2>
                </div>
                <div class="teacher-entry-resource-list">
                  ${lessonResources.map(({ resource, assignment }) => `
                    <article class="resource-nav-card ${resource.id === selectedResource?.resource?.id ? "is-active" : ""}">
                      <strong>${assignment?.title || resource.title}</strong>
                      <span>${resource.sourceTitle}</span>
                      <span>${assignment?.summary || resource.summary}</span>
                      ${assignment?.task ? `<p><strong>Auftrag:</strong> ${assignment.task}</p>` : ""}
                      ${assignment?.questionTasks?.length ? `
                        <ul class="small-list">
                          ${assignment.questionTasks.map((questionTask) => `<li>${escapeHtml(questionTask.prompt || questionTask)}</li>`).join("")}
                        </ul>
                      ` : ""}
                      <div class="row">
                        <a class="button secondary" href="${resource.openUrl}" target="_blank" rel="noreferrer">${resource.mediaType === "pdf" ? "PDF extern öffnen" : resource.mediaType === "html" ? "Quelle extern öffnen" : "Video extern öffnen"}</a>
                        ${resource.audioUrl
                          ? `<a class="button secondary" href="${resource.audioUrl}" target="_blank" rel="noreferrer">${resource.audioLabel || "Audio extern öffnen"}</a>`
                          : ""
                        }
                      </div>
                    </article>
                  `).join("")}
                </div>
                ${selectedResourceMarkup}
              </section>
            ` : ""}
          </section>
        </section>
      </main>
    `
  });
}

function renderStudentAccessPage({ mode, lessonId, errorText = "" }) {
  const isOpen = mode === "open";
  const formAction = isOpen ? "/auth/open" : "/auth/seb";
  const title = isOpen ? "Heidi öffnen" : "SEB-Version öffnen";
  const heading = isOpen ? "Roman-Reader öffnen" : "SEB-Reader starten";

  return renderShellPage({
    title,
    bodyClass: "login-page",
    body: `
      <main class="page">
        <section class="panel">
          <div class="eyebrow">${isOpen ? "Offene Version" : "SEB-Version"}</div>
          <h1>${heading}</h1>
          <p>
            ${isOpen
              ? "Gib deinen Namen ein und arbeite dann durch alle Lektionen der Heidi-Lernumgebung."
              : "Diese Version läuft nur im Safe Exam Browser. Gib deinen Namen ein und arbeite durch alle Lektionen."}
          </p>
          <div class="notice">
            <strong>So funktioniert die Anmeldung:</strong>
            <br>1. Namen eintragen.
            <br>2. Auf ${isOpen ? "Öffnen" : "Starten"} klicken.
            <br>3. Alle Lektionen bearbeiten.
          </div>
          <div class="audiobook-callout">
            <strong>Hörbuch bereithalten</strong>
            <p>Du kannst den Roman zusätzlich hören und Textstellen danach im Reader schriftlich sichern.</p>
            <a class="button audiobook" href="${AUDIOBOOK_URL}" target="_blank" rel="noreferrer">Hörbuch starten</a>
          </div>
          ${errorText ? `<div class="notice"><strong>Hinweis:</strong> ${errorText}</div>` : ""}
          <form method="post" action="${formAction}" class="form-grid">
            <input type="hidden" name="lessonId" value="${lessonId || ""}">
            <label for="displayName">Name</label>
            <input id="displayName" name="displayName" type="text" autocomplete="name" placeholder="z. B. Nora Steiner">
            <div class="row">
              <button type="submit">${isOpen ? "Öffnen" : "Starten"}</button>
              <a class="button secondary" href="/">Zur Übersicht</a>
            </div>
          </form>
        </section>
      </main>
    `
  });
}

function renderSebBlockedPage() {
  return renderShellPage({
    title: "SEB erforderlich",
    body: `
      <main class="page">
        <section class="panel">
          <div class="eyebrow">SEB-Version</div>
          <h1>Zugriff nur über Safe Exam Browser</h1>
          <div class="notice">
            Diese Fassung akzeptiert nur Anfragen aus Safe Exam Browser.
            ${SEB_CONFIG_KEY_HASH ? " Zusätzlich ist serverseitig ein bestimmter SEB-Konfigurationsschlüssel hinterlegt." : ""}
          </div>
          <p>Starte das Tool direkt im konfigurierten SEB-Fenster oder nutze alternativ die offene Version mit Namen.</p>
          <div class="row">
            <a class="button secondary" href="/open">Offene Version</a>
            <a class="button secondary" href="/">Zur Übersicht</a>
          </div>
        </section>
      </main>
    `
  });
}

function renderTeacherPage() {
  const config = teacherRuntimeConfig();
  return `
    <!doctype html>
    <html lang="de">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Lehrer*innen-Dashboard · Heidi Lernumgebung</title>
        <link rel="stylesheet" href="${assetUrl("/kehlmann-teacher/styles.css")}">
      </head>
      <body>
        <div class="site-background" aria-hidden="true">
          <video class="site-background-video" data-background-video autoplay muted loop playsinline>
            <source src="${assetUrl(BACKGROUND_VIDEO)}" type="video/mp4">
          </video>
        </div>
        <button class="background-video-toggle" type="button" data-background-video-toggle>Video stoppen</button>
        <script>
          window.KEHLMANN_TEACHER_CONFIG = ${JSON.stringify(config)};
        </script>
        <script src="${assetUrl("/js/background-video.js")}"></script>
        <script type="module" src="${assetUrl("/kehlmann-teacher/app.js")}"></script>
      </body>
    </html>
  `;
}

function renderReaderPage(mode, lessonId) {
  const modeLabel = mode === "seb" ? "Safe Exam Browser" : "Offene Version";
  return `
    <!doctype html>
    <html lang="de">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Heidi Lernumgebung</title>
        <link rel="stylesheet" href="${assetUrl("/reader/styles.css")}">
      </head>
      <body>
        <div class="site-background" aria-hidden="true">
          <video class="site-background-video" data-background-video autoplay muted loop playsinline>
            <source src="${assetUrl(BACKGROUND_VIDEO)}" type="video/mp4">
          </video>
        </div>
        <button class="background-video-toggle" type="button" data-background-video-toggle>Video stoppen</button>
        <script>
          window.KEHLMANN_READER_MODE = "${mode}";
          window.KEHLMANN_READER_MODE_LABEL = "${modeLabel}";
          window.KEHLMANN_READER_CONFIG = ${JSON.stringify({ forcedLessonId: lessonId || null })};
        </script>
        <script src="${assetUrl("/js/background-video.js")}"></script>
        <script type="module" src="${assetUrl("/reader/app.js")}"></script>
      </body>
    </html>
  `;
}

function getCookies(request) {
  return parseCookies(request.headers.cookie || "");
}

function hasStudentSession(request) {
  const cookies = getCookies(request);
  return Boolean(cookies[STUDENT_COOKIE]);
}

function clearStudentCookies(response) {
  response.append("Set-Cookie", `${OPEN_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
  response.append("Set-Cookie", `${STUDENT_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
  response.append("Set-Cookie", `${CLASS_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
  response.append("Set-Cookie", `${NAME_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
  response.append("Set-Cookie", `${MODE_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

function setStudentCookies(response, classroom, student, includeOpenAccess = false, mode = "open") {
  if (includeOpenAccess) {
    response.append("Set-Cookie", `${OPEN_COOKIE}=1; HttpOnly; Path=/; Max-Age=28800; SameSite=Lax`);
  }
  response.append("Set-Cookie", `${STUDENT_COOKIE}=${encodeURIComponent(student.id)}; HttpOnly; Path=/; Max-Age=28800; SameSite=Lax`);
  response.append("Set-Cookie", `${CLASS_COOKIE}=${encodeURIComponent(classroom.id)}; HttpOnly; Path=/; Max-Age=28800; SameSite=Lax`);
  response.append("Set-Cookie", `${NAME_COOKIE}=${encodeURIComponent(student.displayName)}; HttpOnly; Path=/; Max-Age=28800; SameSite=Lax`);
  response.append("Set-Cookie", `${MODE_COOKIE}=${encodeURIComponent(mode)}; HttpOnly; Path=/; Max-Age=28800; SameSite=Lax`);
}

function hasTeacherAccess(request) {
  return getCookies(request)[TEACHER_COOKIE] === "1";
}

function lessonRedirect(mode, lessonId) {
  if (!lessonId) {
    return `/${mode}`;
  }
  return `/${mode}/lesson/${lessonId}`;
}

async function ensureValidStudentSession(request, response, mode, lessonId = "") {
  const cookies = getCookies(request);
  const studentId = cookies[STUDENT_COOKIE];

  if (studentId) {
    const store = await readReaderStore();
    if (buildReaderBootstrap(store, studentId)) {
      return true;
    }
  }

  if (!cookies[NAME_COOKIE]) {
    return false;
  }

  const access = await updateReaderStore(async (store) => (
    createOrResumeStudent(store, {
      displayName: cookies[NAME_COOKIE],
      mode,
      lessonId
    })
  ));

  setStudentCookies(response, access.classroom, access.student, mode === "open", mode);
  return true;
}

export function createApp() {
  const app = express();

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/reader-api", kehlmannReaderApiRouter);
  app.use("/js", express.static(jsDir));
  app.use("/reader/assets", express.static(readerAssetDir));
  app.use("/reader", express.static(readerDir));
  app.use("/kehlmann-teacher", express.static(teacherDir));

  app.get("/", (_request, response) => {
    response.send(renderLandingPage());
  });

  app.get("/teacher-entry", (request, response) => {
    response.send(renderTeacherEntryPage({
      lessonId: request.query.lesson,
      entryId: request.query.entry
    }));
  });

  app.post("/auth/open", async (request, response) => {
    const { displayName, lessonId } = request.body;

    try {
      const access = await updateReaderStore(async (store) => (
        createOrResumeStudent(store, {
          displayName,
          mode: "open",
          lessonId
        })
      ));

      setStudentCookies(response, access.classroom, access.student, true, "open");
      response.redirect(303, lessonRedirect("open", lessonId));
    } catch (error) {
      response.status(401).send(renderStudentAccessPage({
        mode: "open",
        lessonId,
        errorText: error.message
      }));
    }
  });

  app.post("/auth/seb", async (request, response) => {
    const { displayName, lessonId } = request.body;

    try {
      const access = await updateReaderStore(async (store) => (
        createOrResumeStudent(store, {
          displayName,
          mode: "seb",
          lessonId
        })
      ));

      setStudentCookies(response, access.classroom, access.student, false, "seb");
      response.redirect(303, lessonRedirect("seb", lessonId));
    } catch (error) {
      response.status(401).send(renderStudentAccessPage({
        mode: "seb",
        lessonId,
        errorText: error.message
      }));
    }
  });

  app.post("/auth/teacher", (request, response) => {
    const redirectTo = request.body.redirectTo === "/teacher-entry" ? "/teacher-entry" : "/teacher";
    response.setHeader("Set-Cookie", `${TEACHER_COOKIE}=1; HttpOnly; Path=/; Max-Age=28800; SameSite=Lax`);
    response.redirect(303, redirectTo);
  });

  app.get("/auth/logout", (_request, response) => {
    clearStudentCookies(response);
    response.redirect("/");
  });

  app.get("/auth/teacher/logout", (_request, response) => {
    response.redirect("/teacher");
  });

  app.get("/open", async (request, response) => {
    if (!hasOpenAccess(request, OPEN_COOKIE) || !hasStudentSession(request)) {
      response.send(renderStudentAccessPage({ mode: "open" }));
      return;
    }

    if (!(await ensureValidStudentSession(request, response, "open"))) {
      clearStudentCookies(response);
      response.redirect(303, "/open");
      return;
    }

    response.send(renderReaderPage("open"));
  });

  app.get("/open/lesson/:lessonId", async (request, response) => {
    if (!hasOpenAccess(request, OPEN_COOKIE) || !hasStudentSession(request)) {
      response.send(renderStudentAccessPage({ mode: "open", lessonId: request.params.lessonId }));
      return;
    }

    if (!(await ensureValidStudentSession(request, response, "open", request.params.lessonId))) {
      clearStudentCookies(response);
      response.redirect(303, `/open/lesson/${encodeURIComponent(request.params.lessonId)}`);
      return;
    }

    response.send(renderReaderPage("open", request.params.lessonId));
  });

  app.get("/seb", async (request, response) => {
    if (!isSafeExamBrowserRequest(request, SEB_CONFIG_KEY_HASH)) {
      response.status(403).send(renderSebBlockedPage());
      return;
    }

    if (!hasStudentSession(request)) {
      response.send(renderStudentAccessPage({ mode: "seb" }));
      return;
    }

    if (!(await ensureValidStudentSession(request, response, "seb"))) {
      clearStudentCookies(response);
      response.redirect(303, "/seb");
      return;
    }

    response.send(renderReaderPage("seb"));
  });

  app.get("/seb/lesson/:lessonId", async (request, response) => {
    if (!isSafeExamBrowserRequest(request, SEB_CONFIG_KEY_HASH)) {
      response.status(403).send(renderSebBlockedPage());
      return;
    }

    if (!hasStudentSession(request)) {
      response.send(renderStudentAccessPage({ mode: "seb", lessonId: request.params.lessonId }));
      return;
    }

    if (!(await ensureValidStudentSession(request, response, "seb", request.params.lessonId))) {
      clearStudentCookies(response);
      response.redirect(303, `/seb/lesson/${encodeURIComponent(request.params.lessonId)}`);
      return;
    }

    response.send(renderReaderPage("seb", request.params.lessonId));
  });

  app.get("/teacher", (request, response) => {
    response.setHeader("Set-Cookie", `${TEACHER_COOKIE}=1; HttpOnly; Path=/; Max-Age=28800; SameSite=Lax`);
    response.send(renderTeacherPage());
  });

  return app;
}
