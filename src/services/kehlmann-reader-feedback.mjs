import { lessonSets, readerModules, theoryResources } from "../../public/kehlmann-reader/data.js";

const lessonById = new Map(lessonSets.map((lesson) => [lesson.id, lesson]));
const moduleById = new Map(readerModules.map((module) => [module.id, module]));
const theoryById = new Map(theoryResources.map((resource) => [resource.id, resource]));

const analyticalSignals = [
  "zeigt",
  "verdeutlicht",
  "deutet",
  "wirkt",
  "macht sichtbar",
  "verdichtet",
  "kontrastiert",
  "spiegelt",
  "lenkt",
  "schärft"
];

const summarySignals = ["dann", "danach", "anschliessend", "später", "erzählt", "passiert"];
const precisionSignals = [
  "wort",
  "formulierung",
  "bild",
  "liste",
  "satz",
  "dialog",
  "blick",
  "geruch",
  "körper",
  "rhythmus",
  "perspektive"
];

function normalize(value = "") {
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(value = "") {
  return normalize(value)
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 || /^\d+$/.test(token));
}

function unique(items) {
  return [...new Set(items)];
}

function hasSignal(text, candidates) {
  const haystack = normalize(text);
  return candidates.some((candidate) => haystack.includes(normalize(candidate)));
}

function countHits(text, candidates) {
  const haystack = normalize(text);
  return unique(candidates).filter((candidate) => haystack.includes(normalize(candidate))).length;
}

function ratio(value, total) {
  return total ? value / total : 0;
}

function levelFor(score) {
  if (score >= 0.8) return "sehr stark";
  if (score >= 0.62) return "tragfähig";
  if (score >= 0.45) return "im Ansatz stark";
  return "noch deutlich zu schärfen";
}

function criterion(label, score, rationale) {
  return {
    label,
    score: Math.round(score * 100),
    level: levelFor(score),
    rationale
  };
}

function moduleAndEntry(moduleId, entryId) {
  const module = moduleById.get(moduleId) || readerModules[0];
  const entry = module.entries.find((candidate) => candidate.id === entryId) || module.entries[0];
  return { module, entry };
}

function collectExpectedTerms(module, entry, theory) {
  return unique([
    ...tokenize(module.lens),
    ...tokenize(module.task),
    ...tokenize(entry.context),
    ...entry.signalWords.flatMap((signal) => tokenize(signal)),
    ...entry.prompts.flatMap((prompt) => tokenize(prompt)),
    ...theory.keyIdeas.flatMap((idea) => tokenize(idea))
  ]);
}

export function evaluateReaderSebFeedback({ lessonId, moduleId, entryId, theoryId, note }) {
  const lesson = lessonById.get(lessonId) || lessonSets[0];
  const theory = theoryById.get(theoryId) || theoryResources[0];
  const { module, entry } = moduleAndEntry(moduleId, entryId);

  const observation = normalize(note?.observation);
  const evidence = normalize(note?.evidence);
  const interpretation = normalize(note?.interpretation);
  const theoryText = normalize(note?.theory);
  const revision = normalize(note?.revision);
  const combined = `${observation} ${evidence} ${interpretation} ${theoryText}`.trim();

  const expectedTerms = collectExpectedTerms(module, entry, theory);
  const signalHits = countHits(evidence || combined, entry.signalWords);
  const expectedHits = countHits(combined, expectedTerms);
  const analyticalHits = countHits(combined, analyticalSignals);
  const precisionHits = countHits(combined, precisionSignals);
  const summaryHits = countHits(combined, summarySignals);

  const textAnchoringScore = Math.min(1, (
    (evidence ? 0.4 : 0) +
    ratio(signalHits, Math.max(entry.signalWords.length, 1)) * 0.35 +
    (precisionHits > 0 ? 0.25 : 0)
  ));

  const interpretiveDepthScore = Math.min(1, (
    Math.min(analyticalHits / 3, 1) * 0.45 +
    (/(weil|wodurch|weshalb|dadurch|indem)/.test(combined) ? 0.25 : 0) +
    (/(während|zugleich|einerseits|andererseits|im gegensatz)/.test(combined) ? 0.2 : 0) +
    (summaryHits === 0 ? 0.1 : 0)
  ));

  const theoryIntegrationScore = Math.min(1, (
    (theoryText.length >= 20 ? 0.35 : 0) +
    ratio(countHits(theoryText || interpretation, theory.keyIdeas), Math.max(theory.keyIdeas.length, 1)) * 0.4 +
    (entry.relatedTheoryIds?.includes(theory.id) || module.relatedTheoryIds?.includes(theory.id) ? 0.25 : 0.05)
  ));

  const contextualFitScore = Math.min(1, (
    ratio(expectedHits, Math.max(expectedTerms.length, 1)) * 0.6 +
    (hasSignal(combined, tokenize(module.lens)) ? 0.2 : 0) +
    (hasSignal(combined, ["elli", "link", "grete", "bende", "arsen", "arsenik", "brief", "briefe", "prozess", "prozess", "gericht", "milieu", "symbiose", "obduktion", "mageninhalt", "haarprobe", "toxikologie", "methylalkohol"]) ? 0.2 : 0)
  ));

  const revisionScore = Math.min(1, (
    (revision.length >= 18 ? 0.55 : 0) +
    (/(präzis|schärf|ergänz|überarbeit|genauer|deutlicher)/.test(revision) ? 0.45 : 0)
  ));

  const overallScore = Math.round((
    textAnchoringScore * 0.3 +
    interpretiveDepthScore * 0.28 +
    theoryIntegrationScore * 0.2 +
    contextualFitScore * 0.14 +
    revisionScore * 0.08
  ) * 100);

  const strengths = [];
  const cautions = [];
  const nextMoves = [];

  if (textAnchoringScore >= 0.62) {
    strengths.push("Die Antwort arbeitet schon sichtbar mit Wortlaut, Signalwörtern oder klaren Textankern.");
  } else {
    cautions.push("Im Moment bleibt die Textbindung noch zu locker. Es fehlen klar markierte Wörter, Bilder oder Formulierungen aus der Passage.");
    nextMoves.push("Ergänze im Feld Textanker ein oder zwei kurze Wörter oder Formulierungen direkt aus dem Volltext.");
  }

  if (interpretiveDepthScore >= 0.62) {
    strengths.push("Du gehst über reine Inhaltsangabe hinaus und formulierst bereits eine nachvollziehbare Wirkung oder Deutung.");
  } else {
    cautions.push("Die Deutung bleibt noch zu sehr beim Nacherzählen. Fachlich stärker wird sie, wenn du erklärst, was die Passage leistet.");
    nextMoves.push("Formuliere mindestens einen Satz mit `zeigt`, `verdeutlicht`, `spiegelt` oder `macht sichtbar`.");
  }

  if (theoryIntegrationScore >= 0.62) {
    strengths.push("Der Theoriebezug ist schon mehr als ein Etikett und hilft bei der Auswertung der Passage.");
  } else {
    cautions.push("Die gewählte Theorie-Linse bleibt noch zu lose mit der Passage verbunden.");
    nextMoves.push(`Binde mindestens einen Begriff aus ${theory.shortTitle} ausdrücklich an ein Textsignal zurück.`);
  }

  if (contextualFitScore >= 0.62) {
    strengths.push("Die Antwort ordnet die Passage bereits gut in Figurenkonstellation, Motivik oder Konfliktlinien des Romans ein.");
  } else {
    cautions.push("Der grössere Roman-Zusammenhang bleibt noch zu blass. Figuren, Motive oder Konfliktachsen könnten klarer benannt werden.");
    nextMoves.push(`Binde deine Beobachtung stärker an die Modullinse zurück: ${(module.lens || module.title || "die aktuelle Lektion").toLowerCase()}.`);
  }

  if (revisionScore >= 0.55) {
    strengths.push("Die Revision zeigt schon, wie du an deiner Deutung weiterarbeiten würdest.");
  } else {
    nextMoves.push("Nutze das Revisionsfeld für einen konkreten nächsten Schritt statt für eine allgemeine Notiz.");
  }

  if (!strengths.length) {
    strengths.push("Der Ansatz ist erkennbar, besonders dort, wo du bereits versuchst, Beobachtung und Deutung zu verbinden.");
  }

  if (!cautions.length) {
    cautions.push("Die Antwort ist tragfähig. Die nächste Schärfung liegt vor allem in noch genauerer Wortwahl und Motivvernetzung.");
  }

  if (!nextMoves.length) {
    nextMoves.push("Schärfe im nächsten Schritt noch genauer, wie Textsignal, Romanmotiv und Deutung zusammenarbeiten.");
  }

  const profile = [
    criterion(
      "Textbindung",
      textAnchoringScore,
      "Prüft, ob die Antwort an Wortlaut, Bildsignalen oder konkreten Passagenelementen arbeitet."
    ),
    criterion(
      "Deutungstiefe",
      interpretiveDepthScore,
      "Prüft, ob aus Beobachtung eine Wirkungsaussage oder echte Interpretation entsteht."
    ),
    criterion(
      "Theorieintegration",
      theoryIntegrationScore,
      "Prüft, ob die gewählte Linse wirklich hilft, die Passage genauer zu lesen."
    ),
    criterion(
      "Roman-Kontext",
      contextualFitScore,
      "Prüft, ob Figuren, Motive und Konfliktachsen des Romans sinnvoll mitgedacht werden."
    )
  ];

  return {
    heading: "SEB-Auswertung zu deiner aktuellen Passage",
    overallScore,
    summary:
      overallScore >= 75
        ? "Die Antwort ist bereits tragfähig und klar lesbar. Die nächste Stufe liegt vor allem in noch präziserer Wortarbeit und motivischer Vernetzung."
        : "Die Antwort hat eine erkennbare Richtung, braucht aber noch engere Textbindung, klarere Deutung und einen bewussteren Rückgriff auf Romanmotive oder Theorie.",
    metadata: {
      lessonTitle: lesson.title,
      moduleTitle: module.title,
      entryTitle: entry.title,
      theoryTitle: theory.title
    },
    profile,
    strengths: strengths.slice(0, 4),
    cautions: cautions.slice(0, 4),
    nextMoves: nextMoves.slice(0, 5),
    prompts: [
      entry.prompts[0],
      `Welches einzelne Wort, Bild oder Detail aus "${entry.passageLabel}" trägt deine Deutung am stärksten?`,
      `Wie hilft dir ${theory.shortTitle.toLowerCase()} dabei, die Passage präziser statt allgemeiner zu lesen?`
    ].filter(Boolean)
  };
}
