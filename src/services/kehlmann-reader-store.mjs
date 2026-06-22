import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getEntriesForLesson, getLessonSetsWithCounts, summarizeStudentWork } from "./kehlmann-reader-progress.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const dataDir = path.join(projectRoot, "data");
const readerStorePath = path.join(dataDir, "kehlmann-reader-store.json");
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabaseTable = process.env.SUPABASE_STORE_TABLE || "reader_store";
const supabaseStoreId = process.env.SUPABASE_STORE_ID || "heidi_spyri";

const defaultPeerReviewCriteria = [
  {
    id: "textnaehe",
    label: "Textnähe",
    prompt: "Arbeitet die Rückmeldung sichtbar an konkreten Stellen, Formulierungen oder Signalen des Textes?"
  },
  {
    id: "belegarbeit",
    label: "Belegarbeit",
    prompt: "Sind Beobachtung und Deutung mit Wortlaut, Signalwörtern oder klaren Verweisen gestützt?"
  },
  {
    id: "deutungsplausibilitaet",
    label: "Deutungsplausibilität",
    prompt: "Ist die Interpretation nachvollziehbar und über bloße Inhaltsangabe hinausgeführt?"
  },
  {
    id: "sprachliche_klarheit",
    label: "Sprachliche Klarheit",
    prompt: "Ist die Formulierung präzise, verständlich und gut weiterbearbeitbar?"
  },
  {
    id: "weiterarbeit",
    label: "Weiterarbeit",
    prompt: "Hilft das Feedback der anderen Person wirklich bei einer nächsten Überarbeitung?"
  }
];

const lessonCatalog = () => getLessonSetsWithCounts();
const defaultLessonIds = () => lessonCatalog().map((lesson) => lesson.id);
const defaultActiveLessonId = () => defaultLessonIds()[0];
const defaultPeerReviewLessonId = () => lessonCatalog().find((lesson) => lesson.id === "lesson-09-der-fall-vor-gericht")?.id || defaultLessonIds()[0];

let inMemoryReaderStore = null;

function hasSupabaseStore() {
  return Boolean(supabaseUrl && supabaseKey);
}

function supabaseEndpoint(query = "") {
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/rest/v1/${encodeURIComponent(supabaseTable)}${query}`;
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    ...extra
  };
}

function now() {
  return new Date().toISOString();
}

function normalizeCode(value = "") {
  return String(value).trim().toUpperCase();
}

function normalizeName(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
}

function makeId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

function defaultClassroom(timestamp) {
  return {
    id: "reader-class-9a",
    name: "Heidi 10A",
    code: "HEID-10A",
    lessonIds: defaultLessonIds(),
    activeSebLessonId: defaultActiveLessonId(),
    allowOpen: true,
    allowSeb: true,
    peerReviewEnabled: true,
    requiredPeerReviews: 2,
    peerReviewLessonId: defaultPeerReviewLessonId(),
    peerReviewVisibility: "assigned-only",
    peerReviewInstructions:
      "Arbeite textnah, entwicklungsorientiert und präzise. Nenne mindestens eine Stärke, eine konkrete Überarbeitung und eine Rückfrage zu Motiv, Figur, Perspektive oder Sprache.",
    peerReviewCriteria: structuredClone(defaultPeerReviewCriteria),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function defaultReaderStore() {
  const timestamp = now();
  return {
    classes: [defaultClassroom(timestamp)],
    students: [],
    work: [],
    reviews: []
  };
}

function normalizeClassroom(classroom) {
  const validLessonIds = new Set(defaultLessonIds());
  const normalizedLessonIds = Array.isArray(classroom.lessonIds)
    ? classroom.lessonIds.filter((lessonId) => validLessonIds.has(lessonId))
    : [];

  classroom.lessonIds = normalizedLessonIds.length ? normalizedLessonIds : defaultLessonIds();

  if (!validLessonIds.has(classroom.activeSebLessonId)) {
    classroom.activeSebLessonId = defaultActiveLessonId();
  }

  if (!validLessonIds.has(classroom.peerReviewLessonId)) {
    classroom.peerReviewLessonId = defaultPeerReviewLessonId();
  }

  if (!Array.isArray(classroom.peerReviewCriteria) || !classroom.peerReviewCriteria.length) {
    classroom.peerReviewCriteria = structuredClone(defaultPeerReviewCriteria);
  }

  return classroom;
}

function normalizeReaderStore(store) {
  store.classes = (store.classes || []).map((classroom) => normalizeClassroom(classroom));
  store.students = Array.isArray(store.students) ? store.students : [];
  store.work = Array.isArray(store.work) ? store.work : [];
  store.reviews = Array.isArray(store.reviews) ? store.reviews : [];
  return store;
}

async function ensureReaderStoreFile() {
  try {
    await fs.access(readerStorePath);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(readerStorePath, `${JSON.stringify(defaultReaderStore(), null, 2)}\n`);
  }
}

async function readSupabaseStore() {
  const query = `?id=eq.${encodeURIComponent(supabaseStoreId)}&select=payload`;
  const response = await fetch(supabaseEndpoint(query), {
    headers: supabaseHeaders()
  });

  if (!response.ok) {
    throw new Error(`Supabase Store konnte nicht gelesen werden (${response.status}).`);
  }

  const rows = await response.json();
  if (Array.isArray(rows) && rows[0]?.payload) {
    return normalizeReaderStore(rows[0].payload);
  }

  const initialStore = defaultReaderStore();
  await writeSupabaseStore(initialStore);
  return normalizeReaderStore(initialStore);
}

async function writeSupabaseStore(nextStore) {
  const response = await fetch(supabaseEndpoint("?on_conflict=id"), {
    method: "POST",
    headers: supabaseHeaders({
      Prefer: "resolution=merge-duplicates,return=minimal"
    }),
    body: JSON.stringify({
      id: supabaseStoreId,
      payload: nextStore,
      updated_at: now()
    })
  });

  if (!response.ok) {
    throw new Error(`Supabase Store konnte nicht geschrieben werden (${response.status}).`);
  }
}

export async function readReaderStore() {
  if (inMemoryReaderStore) {
    return structuredClone(inMemoryReaderStore);
  }

  if (hasSupabaseStore()) {
    inMemoryReaderStore = await readSupabaseStore();
    return structuredClone(inMemoryReaderStore);
  }

  await ensureReaderStoreFile();
  const raw = await fs.readFile(readerStorePath, "utf8");
  inMemoryReaderStore = normalizeReaderStore(JSON.parse(raw));
  return structuredClone(inMemoryReaderStore);
}

export async function writeReaderStore(nextStore) {
  inMemoryReaderStore = structuredClone(nextStore);
  if (hasSupabaseStore()) {
    await writeSupabaseStore(nextStore);
    return structuredClone(inMemoryReaderStore);
  }

  await fs.writeFile(readerStorePath, `${JSON.stringify(nextStore, null, 2)}\n`);
  return structuredClone(inMemoryReaderStore);
}

export async function updateReaderStore(mutator) {
  const store = await readReaderStore();
  const result = await mutator(store);
  await writeReaderStore(store);
  return result;
}

export function getClassroomByCode(store, code) {
  const normalized = normalizeCode(code);
  return store.classes.find((entry) => normalizeCode(entry.code) === normalized) || null;
}

export function getClassroomById(store, classId) {
  return store.classes.find((entry) => entry.id === classId) || null;
}

function eligibleClassroomsForMode(store, mode) {
  const flag = mode === "seb" ? "allowSeb" : "allowOpen";
  return store.classes
    .filter((classroom) => classroom[flag] !== false)
    .sort((left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime());
}

function resolveClassroomForMode(store, mode) {
  const eligible = eligibleClassroomsForMode(store, mode);

  if (!eligible.length) {
    throw new Error(mode === "seb"
      ? "Aktuell ist keine Klasse fuer die SEB-Version freigeschaltet."
      : "Aktuell ist keine Klasse fuer die offene Version freigeschaltet.");
  }

  if (eligible.length > 1) {
    throw new Error(mode === "seb"
      ? "Fuer die vereinfachte Anmeldung darf nur eine Klasse gleichzeitig fuer SEB freigeschaltet sein."
      : "Fuer die vereinfachte Anmeldung darf nur eine Klasse gleichzeitig fuer die offene Version freigeschaltet sein.");
  }

  return eligible[0];
}

export function getStudent(store, studentId) {
  return store.students.find((entry) => entry.id === studentId) || null;
}

export function getStudentWork(store, studentId) {
  return store.work.find((entry) => entry.studentId === studentId) || null;
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return `HEID-${Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")}`;
}

function createWork(studentId, classroom) {
  const timestamp = now();
  return {
    id: makeId("reader-work"),
    studentId,
    classId: classroom.id,
    selectedLessonId: classroom.activeSebLessonId || classroom.lessonIds[0],
    moduleId: null,
    entryId: null,
    theoryId: null,
    notes: {},
    lastMode: "open",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function classroomCriteria(classroom) {
  return classroom.peerReviewCriteria?.length ? classroom.peerReviewCriteria : structuredClone(defaultPeerReviewCriteria);
}

function sortStudentsForClass(store, classId) {
  return store.students
    .filter((student) => student.classId === classId)
    .sort((left, right) => left.displayName.localeCompare(right.displayName, "de"));
}

function reviewIdFor({ classId, lessonId, reviewerStudentId, revieweeStudentId }) {
  return `review-${classId}-${lessonId}-${reviewerStudentId}-${revieweeStudentId}`;
}

function defaultReviewRecord({ classroom, reviewerStudentId, revieweeStudentId }) {
  const lessonId = classroom.peerReviewLessonId;
  return {
    id: reviewIdFor({ classId: classroom.id, lessonId, reviewerStudentId, revieweeStudentId }),
    classId: classroom.id,
    lessonId,
    reviewerStudentId,
    revieweeStudentId,
    status: "assigned",
    criteria: classroomCriteria(classroom).map((criterion) => ({
      id: criterion.id,
      level: "",
      comment: ""
    })),
    quotedEvidence: "",
    strengths: "",
    nextSteps: "",
    question: "",
    createdAt: "",
    updatedAt: "",
    submittedAt: ""
  };
}

function findStoredReview(store, id) {
  return store.reviews.find((review) => review.id === id) || null;
}

function buildLessonPortfolio(work, lessonId) {
  const notes = work?.notes || {};
  const entries = getEntriesForLesson(lessonId).map((entry) => {
    const note = notes[entry.id] || {};
    return {
      id: entry.id,
      title: entry.title,
      pageHint: entry.pageHint,
      passageLabel: entry.passageLabel,
      prompts: entry.prompts,
      observation: note.observation || "",
      evidence: note.evidence || "",
      interpretation: note.interpretation || "",
      theory: note.theory || "",
      revision: note.revision || "",
      hasContent: Boolean(
        String(note.observation || "").trim() ||
        String(note.evidence || "").trim() ||
        String(note.interpretation || "").trim() ||
        String(note.theory || "").trim()
      )
    };
  });

  const visibleEntries = entries.filter((entry) => entry.hasContent);
  return {
    completedEntries: visibleEntries.length,
    totalEntries: entries.length,
    entries: visibleEntries
  };
}

function assignmentPairsForClass(store, classroom) {
  if (!classroom.peerReviewEnabled) {
    return [];
  }

  const students = sortStudentsForClass(store, classroom.id);
  if (students.length < 2) {
    return [];
  }

  const count = Math.max(0, Math.min(Number(classroom.requiredPeerReviews) || 0, students.length - 1));
  const lessonId = classroom.peerReviewLessonId || classroom.lessonIds[0];
  const pairs = [];

  for (let reviewerIndex = 0; reviewerIndex < students.length; reviewerIndex += 1) {
    const reviewer = students[reviewerIndex];
    for (let offset = 1; offset <= count; offset += 1) {
      const reviewee = students[(reviewerIndex + offset) % students.length];
      pairs.push({
        reviewerStudentId: reviewer.id,
        revieweeStudentId: reviewee.id,
        lessonId,
        id: reviewIdFor({
          classId: classroom.id,
          lessonId,
          reviewerStudentId: reviewer.id,
          revieweeStudentId: reviewee.id
        })
      });
    }
  }

  return pairs;
}

function buildPeerReviewAssignment(store, classroom, pair) {
  const reviewer = getStudent(store, pair.reviewerStudentId);
  const reviewee = getStudent(store, pair.revieweeStudentId);
  const revieweeWork = getStudentWork(store, pair.revieweeStudentId);
  const storedReview = findStoredReview(store, pair.id);
  const review = storedReview || defaultReviewRecord({
    classroom,
    reviewerStudentId: pair.reviewerStudentId,
    revieweeStudentId: pair.revieweeStudentId
  });

  return {
    id: pair.id,
    classId: classroom.id,
    lessonId: pair.lessonId,
    reviewerStudentId: pair.reviewerStudentId,
    revieweeStudentId: pair.revieweeStudentId,
    status: review.status || "assigned",
    criteria: review.criteria,
    quotedEvidence: review.quotedEvidence || "",
    strengths: review.strengths || "",
    nextSteps: review.nextSteps || "",
    question: review.question || "",
    updatedAt: review.updatedAt || "",
    submittedAt: review.submittedAt || "",
    reviewer: reviewer ? { id: reviewer.id, displayName: reviewer.displayName } : null,
    reviewee: reviewee && revieweeWork
      ? {
          id: reviewee.id,
          displayName: reviewee.displayName,
          lessonPortfolio: buildLessonPortfolio(revieweeWork, pair.lessonId),
          selectedLessonId: revieweeWork.selectedLessonId,
          updatedAt: revieweeWork.updatedAt
        }
      : null
  };
}

function assignmentsForStudent(store, classroom, studentId) {
  return assignmentPairsForClass(store, classroom)
    .filter((pair) => pair.reviewerStudentId === studentId)
    .map((pair) => buildPeerReviewAssignment(store, classroom, pair));
}

function reviewStatsForStudent(store, classroom, studentId) {
  const assigned = assignmentsForStudent(store, classroom, studentId);
  const received = assignmentPairsForClass(store, classroom)
    .filter((pair) => pair.revieweeStudentId === studentId)
    .map((pair) => buildPeerReviewAssignment(store, classroom, pair));

  return {
    assignedCount: assigned.length,
    completedAssignedCount: assigned.filter((review) => review.status === "submitted").length,
    receivedCount: received.length,
    receivedCompletedCount: received.filter((review) => review.status === "submitted").length
  };
}

function findAssignmentForReviewer(store, reviewerStudentId, reviewId) {
  const reviewer = getStudent(store, reviewerStudentId);
  const classroom = reviewer ? getClassroomById(store, reviewer.classId) : null;
  if (!reviewer || !classroom) {
    return null;
  }

  const assignment = assignmentsForStudent(store, classroom, reviewerStudentId)
    .find((review) => review.id === reviewId);

  if (!assignment) {
    return null;
  }

  return { reviewer, classroom, assignment };
}

function validateSubmittedReview(record, criteria) {
  const everyCriterionFilled = criteria.every((criterion) => {
    const current = record.criteria.find((entry) => entry.id === criterion.id);
    return current?.level;
  });

  if (!everyCriterionFilled) {
    throw new Error("Für ein abgeschicktes Peer Review müssen alle Kriterien eingeschätzt werden.");
  }

  if (!String(record.strengths || "").trim()) {
    throw new Error("Bitte benenne mindestens eine Stärke der besprochenen Arbeit.");
  }

  if (!String(record.nextSteps || "").trim()) {
    throw new Error("Bitte formuliere mindestens einen konkreten nächsten Überarbeitungsschritt.");
  }

  if (!String(record.question || "").trim()) {
    throw new Error("Bitte ergänze mindestens eine weiterführende Rückfrage.");
  }
}

export function createOrResumeStudent(store, { classCode, displayName, mode, lessonId }) {
  const classroom = classCode
    ? getClassroomByCode(store, classCode)
    : resolveClassroomForMode(store, mode);
  if (!classroom) {
    throw new Error("Klasse nicht gefunden.");
  }

  if (mode === "open" && classroom.allowOpen === false) {
    throw new Error("Diese Klasse ist aktuell nicht für die offene Version freigeschaltet.");
  }

  if (mode === "seb" && classroom.allowSeb === false) {
    throw new Error("Diese Klasse ist aktuell nicht für die SEB-Version freigeschaltet.");
  }

  const safeName = normalizeName(displayName);
  if (!safeName || safeName.length < 2) {
    throw new Error("Bitte gib einen klaren Namen oder ein Namenskürzel an.");
  }

  let student = store.students.find((entry) => (
    entry.classId === classroom.id &&
    normalizeName(entry.displayName).toLowerCase() === safeName.toLowerCase()
  ));

  const timestamp = now();
  if (!student) {
    student = {
      id: makeId("reader-student"),
      classId: classroom.id,
      displayName: safeName,
      createdAt: timestamp,
      lastSeenAt: timestamp
    };
    store.students.push(student);
  } else {
    student.lastSeenAt = timestamp;
  }

  let work = getStudentWork(store, student.id);
  if (!work) {
    work = createWork(student.id, classroom);
    store.work.push(work);
  }

  work.classId = classroom.id;
  work.lastMode = mode;
  work.updatedAt = timestamp;

  if (lessonId && classroom.lessonIds.includes(lessonId)) {
    work.selectedLessonId = lessonId;
  }

  return { classroom, student, work };
}

export function saveReaderProgress(store, studentId, payload) {
  const student = getStudent(store, studentId);
  const classroom = student ? getClassroomById(store, student.classId) : null;
  const work = getStudentWork(store, studentId);

  if (!student || !classroom || !work) {
    throw new Error("Reader-Sitzung nicht gefunden.");
  }

  student.lastSeenAt = now();
  work.selectedLessonId = classroom.lessonIds.includes(payload.lessonId) ? payload.lessonId : work.selectedLessonId;
  work.moduleId = payload.moduleId || work.moduleId;
  work.entryId = payload.entryId || work.entryId;
  work.theoryId = payload.theoryId || work.theoryId;
  work.lastMode = payload.mode || work.lastMode;
  work.notes = payload.notes || {};
  work.updatedAt = now();

  return { classroom, student, work };
}

export function savePeerReview(store, reviewerStudentId, reviewId, payload) {
  const resolved = findAssignmentForReviewer(store, reviewerStudentId, reviewId);
  if (!resolved) {
    throw new Error("Peer-Review-Zuweisung nicht gefunden.");
  }

  const { classroom, assignment } = resolved;
  const criteriaConfig = classroomCriteria(classroom);
  const timestamp = now();
  let record = findStoredReview(store, reviewId);

  if (!record) {
    record = defaultReviewRecord({
      classroom,
      reviewerStudentId: assignment.reviewerStudentId,
      revieweeStudentId: assignment.revieweeStudentId
    });
    record.createdAt = timestamp;
    store.reviews.push(record);
  }

  record.criteria = criteriaConfig.map((criterion) => {
    const current = payload.criteria?.find((entry) => entry.id === criterion.id)
      || assignment.criteria.find((entry) => entry.id === criterion.id)
      || { id: criterion.id, level: "", comment: "" };
    return {
      id: criterion.id,
      level: String(current.level || ""),
      comment: String(current.comment || "")
    };
  });
  record.quotedEvidence = String(payload.quotedEvidence || "");
  record.strengths = String(payload.strengths || "");
  record.nextSteps = String(payload.nextSteps || "");
  record.question = String(payload.question || "");
  record.updatedAt = timestamp;

  if (payload.status === "submitted") {
    validateSubmittedReview(record, criteriaConfig);
    record.status = "submitted";
    record.submittedAt = timestamp;
  } else {
    record.status = "draft";
  }

  return buildPeerReviewAssignment(store, classroom, assignment);
}

export function buildReaderBootstrap(store, studentId) {
  const student = getStudent(store, studentId);
  const classroom = student ? getClassroomById(store, student.classId) : null;
  const work = getStudentWork(store, studentId);

  if (!student || !classroom || !work) {
    return null;
  }

  return {
    student,
    classroom,
    work,
    progress: summarizeStudentWork(student, classroom, work).progress,
    peerReview: {
      enabled: Boolean(classroom.peerReviewEnabled),
      lessonId: classroom.peerReviewLessonId,
      visibility: classroom.peerReviewVisibility || "assigned-only",
      requiredPeerReviews: Number(classroom.requiredPeerReviews) || 0,
      instructions: classroom.peerReviewInstructions || "",
      criteria: classroomCriteria(classroom),
      assignments: assignmentsForStudent(store, classroom, student.id),
      stats: reviewStatsForStudent(store, classroom, student.id)
    }
  };
}

export function buildTeacherOverview(store) {
  const lessons = getLessonSetsWithCounts();

  return {
    lessons,
    reviewCriteria: structuredClone(defaultPeerReviewCriteria),
    classes: store.classes.map((classroom) => {
      const students = store.students
        .filter((student) => student.classId === classroom.id)
        .map((student) => {
          const summary = summarizeStudentWork(student, classroom, getStudentWork(store, student.id));
          return {
            ...summary,
            peerReview: reviewStatsForStudent(store, classroom, student.id)
          };
        })
        .sort((left, right) => right.progress.percent - left.progress.percent);

      const averageProgress = students.length
        ? Math.round(students.reduce((sum, student) => sum + student.progress.percent, 0) / students.length)
        : 0;

      const allAssignments = assignmentPairsForClass(store, classroom);
      const completedReviews = allAssignments
        .map((pair) => buildPeerReviewAssignment(store, classroom, pair))
        .filter((review) => review.status === "submitted").length;

      return {
        ...classroom,
        studentCount: students.length,
        averageProgress,
        students,
        peerReviewSummary: {
          enabled: Boolean(classroom.peerReviewEnabled),
          totalAssignments: allAssignments.length,
          completedReviews,
          pendingReviews: Math.max(allAssignments.length - completedReviews, 0)
        }
      };
    })
  };
}

export function createClassroom(store, { name }) {
  const safeName = normalizeName(name);
  if (!safeName) {
    throw new Error("Klassenname fehlt.");
  }

  const timestamp = now();
  const classroom = {
    ...defaultClassroom(timestamp),
    id: makeId("reader-class"),
    name: safeName,
    code: randomCode()
  };

  store.classes.push(classroom);
  return classroom;
}

export function updateClassroomSettings(store, classId, payload) {
  const classroom = getClassroomById(store, classId);
  if (!classroom) {
    throw new Error("Klasse nicht gefunden.");
  }

  if (payload.name) {
    classroom.name = normalizeName(payload.name);
  }

  if (Array.isArray(payload.lessonIds) && payload.lessonIds.length) {
    classroom.lessonIds = payload.lessonIds;
  }

  if (payload.activeSebLessonId && classroom.lessonIds.includes(payload.activeSebLessonId)) {
    classroom.activeSebLessonId = payload.activeSebLessonId;
  }

  if (typeof payload.allowOpen === "boolean") {
    classroom.allowOpen = payload.allowOpen;
  }

  if (typeof payload.allowSeb === "boolean") {
    classroom.allowSeb = payload.allowSeb;
  }

  if (typeof payload.peerReviewEnabled === "boolean") {
    classroom.peerReviewEnabled = payload.peerReviewEnabled;
  }

  if (payload.peerReviewLessonId && classroom.lessonIds.includes(payload.peerReviewLessonId)) {
    classroom.peerReviewLessonId = payload.peerReviewLessonId;
  }

  if (typeof payload.requiredPeerReviews === "number") {
    classroom.requiredPeerReviews = Math.max(0, Math.min(5, Math.round(payload.requiredPeerReviews)));
  }

  if (payload.peerReviewVisibility) {
    classroom.peerReviewVisibility = payload.peerReviewVisibility;
  }

  if (typeof payload.peerReviewInstructions === "string") {
    classroom.peerReviewInstructions = payload.peerReviewInstructions.trim();
  }

  classroom.updatedAt = now();
  return classroom;
}

export function regenerateClassroomCode(store, classId) {
  const classroom = getClassroomById(store, classId);
  if (!classroom) {
    throw new Error("Klasse nicht gefunden.");
  }

  classroom.code = randomCode();
  classroom.updatedAt = now();
  return classroom;
}
