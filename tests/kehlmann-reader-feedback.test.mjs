import test from "node:test";
import assert from "node:assert/strict";
import { evaluateReaderSebFeedback } from "../src/services/kehlmann-reader-feedback.mjs";

test("SEB feedback rewards textnahe and motivated Heidi analysis", () => {
  const feedback = evaluateReaderSebFeedback({
    lessonId: "lektion-06",
    moduleId: "modul-06",
    entryId: "frage-30",
    theoryId: "stadt-land",
    note: {
      observation:
        "Die Aufdeckung der Spukgeschichte verbindet Heidis nächtliches Umhergehen mit dem Heimweh und macht sichtbar, dass Frankfurt ihren Körper krank macht.",
      evidence: "spukhaften Vorgänge, Doktor, Heimweh, Heimreise",
      interpretation:
        "Die Passage zeigt und verdeutlicht, dass die Stadtordnung nicht einfach Bildung bringt, sondern Heidis Wahrnehmung, Schlaf und Gesundheit beschädigt.",
      theory:
        "Mit dem Dossier zu Frankfurt, Ordnung und Heimweh gelesen wird deutlich, dass Fenster, Hausordnung und medizinische Diagnose zusammenarbeiten.",
      revision: "Noch genauer am Gegensatz zwischen geöffnetem Fenster, geschlossenem Haus und Alpsehnsucht anbinden."
    }
  });

  assert.ok(feedback.overallScore >= 70);
  assert.match(feedback.summary, /tragfähig|erkennbare Richtung/i);
  assert.equal(feedback.profile.length, 4);
  assert.ok(feedback.strengths.some((item) => /Text|Theorie|Roman/i.test(item)));
});

test("SEB feedback flags vague summary without enough motif or text anchoring", () => {
  const feedback = evaluateReaderSebFeedback({
    lessonId: "lektion-03",
    moduleId: "modul-03",
    entryId: "frage-14",
    theoryId: "religion",
    note: {
      observation: "Die Stelle ist traurig und wichtig.",
      evidence: "",
      interpretation: "Dann ist alles schlimm und man merkt, dass es ein grosses Problem gibt.",
      theory: "Es geht um den Prozess.",
      revision: ""
    }
  });

  assert.ok(feedback.overallScore < 70);
  assert.ok(feedback.cautions.length >= 1);
  assert.ok(feedback.nextMoves.some((item) => /Textanker|Linse|Wortlaut|Modullinse/i.test(item)));
});
