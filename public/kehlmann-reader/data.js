const pdfPath = "/reader/assets/heidi-volltext.html";
const coverImg = "/reader/assets/heidi-cover.svg";
const authorImg = "/reader/assets/johanna-spyri-card.svg";

const fillerWords = new Set([
  "der",
  "die",
  "das",
  "und",
  "oder",
  "dass",
  "weil",
  "wird",
  "werden",
  "einer",
  "eine",
  "einem",
  "einen",
  "eines",
  "wie",
  "warum",
  "welche",
  "welcher",
  "welches",
  "wodurch",
  "woran",
  "wo",
  "hier",
  "dieser",
  "diese",
  "dieses",
  "deiner",
  "deine",
  "deinem",
  "deinen",
  "passage",
  "szene",
  "text",
  "stelle",
  "genau",
  "besonders",
  "mehr",
  "schon",
  "gerade",
  "doch",
  "noch"
]);

const theoryProfiles = {
  "archiv-biografie": {
    "label": "Archiv und Biografie",
    "aliases": [
      "spyri",
      "autorin",
      "biografie",
      "brief",
      "archiv",
      "nachlass",
      "familie",
      "tobias",
      "dete",
      "almöhi",
      "almoehi"
    ]
  },
  "spyris-werk-lesarten": {
    "label": "Spyri, Gesellschaft und Politik",
    "aliases": [
      "spyri",
      "johanna",
      "biografie",
      "frauenbiografie",
      "zürich",
      "zuerich",
      "politik",
      "liberal",
      "konservativ",
      "gesellschaft",
      "frauenrolle",
      "heidi figur",
      "rezeption",
      "lesarten"
    ]
  },
  "religion": {
    "label": "Religion und Gottvertrauen",
    "aliases": [
      "gott",
      "gebet",
      "grossmama",
      "grossmama",
      "grossmutter",
      "pfarrer",
      "religiös",
      "religioes",
      "vertrauen",
      "zweifel"
    ]
  },
  "natur-paedagogik": {
    "label": "Natur und Pädagogik",
    "aliases": [
      "natur",
      "alp",
      "alm",
      "berge",
      "weide",
      "geissen",
      "ziegen",
      "schule",
      "lesen",
      "griffel",
      "lernen",
      "grossvater",
      "grossvater"
    ]
  },
  "stadt-land": {
    "label": "Stadt und Heimweh",
    "aliases": [
      "frankfurt",
      "stadt",
      "fenster",
      "heimweh",
      "rottenmeier",
      "sesemann",
      "benimm",
      "hausordnung",
      "spuk",
      "doktor"
    ]
  },
  "figuren-beziehungen": {
    "label": "Figuren und Beziehungen",
    "aliases": [
      "heidi",
      "peter",
      "geissenpeter",
      "klara",
      "dete",
      "almöhi",
      "grossmutter",
      "sesemann",
      "sebastian",
      "tinette"
    ]
  },
  "koerper-gesundheit": {
    "label": "Körper und Gesundheit",
    "aliases": [
      "krank",
      "gesund",
      "körper",
      "koerper",
      "rollstuhl",
      "laufen",
      "schlaf",
      "essen",
      "brot",
      "medizin",
      "doktor"
    ]
  },
  "bilder-popularisierung": {
    "label": "Bilder und Popularisierung",
    "aliases": [
      "bild",
      "illustration",
      "heimat",
      "sjw",
      "popularisierung",
      "schweiz",
      "kanon",
      "medien",
      "film"
    ]
  },
  "film-alptraum": {
    "label": "Filmische Deutung",
    "aliases": [
      "film",
      "srf",
      "sternstunde",
      "alptraum",
      "anita hugi",
      "marthe keller",
      "stimme",
      "einstellung",
      "schnitt",
      "archiv"
    ]
  },
  "sprache-erzaehlen": {
    "label": "Sprache und Erzählen",
    "aliases": [
      "formulierung",
      "erzählen",
      "erzaehlen",
      "ton",
      "gespräch",
      "gespraech",
      "brief",
      "ausdrucksweise",
      "dialog"
    ]
  },
  "schuld-ordnung": {
    "label": "Schuld und Ordnung",
    "aliases": [
      "schuld",
      "geständnis",
      "gestaendnis",
      "untat",
      "bestrafung",
      "vergebung",
      "ordnung",
      "regel",
      "entschädigung",
      "entschaedigung"
    ]
  },
  "ki-trailer": {
    "label": "KI-Trailer und Verfremdung",
    "aliases": ["ki", "ai", "trailer", "cursed", "horror", "unheimlich", "verfremdung", "youtube", "karpi", "generiert", "bild", "schnitt", "musik"]
  }
};

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeMeaningful(value = "") {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token && token.length > 2 && !fillerWords.has(token));
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function aliasVariants(value = "") {
  const plain = normalizeText(value);
  if (!plain) {
    return [];
  }

  const variants = new Set([plain]);
  if (plain.includes("ä")) {
    variants.add(plain.replaceAll("ä", "ae"));
  }
  if (plain.includes("ö")) {
    variants.add(plain.replaceAll("ö", "oe"));
  }
  if (plain.includes("ü")) {
    variants.add(plain.replaceAll("ü", "ue"));
  }
  for (const item of [...variants]) {
    if (item.length > 5) {
      for (const suffix of ["en", "er", "e", "n", "s"]) {
        if (item.endsWith(suffix) && item.length - suffix.length >= 4) {
          variants.add(item.slice(0, -suffix.length));
        }
      }
    }
  }

  return [...variants];
}

function firstSentence(value = "") {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  const [sentence] = text.split(/(?<=[.!?])\s+/u);
  return sentence || text;
}

function capitalize(value = "") {
  const text = String(value || "").trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "";
}

function naturalJoin(items = []) {
  const parts = items.filter(Boolean);
  if (!parts.length) {
    return "";
  }
  if (parts.length === 1) {
    return parts[0];
  }
  if (parts.length === 2) {
    return `${parts[0]} und ${parts[1]}`;
  }
  return `${parts.slice(0, -1).join(", ")} und ${parts.at(-1)}`;
}

function operatorProfile(prompt = "") {
  const text = normalizeText(prompt);
  if (/^(warum|wie|erkläre|erklaere|erläutere|erlaeutere)/.test(text)) {
    return { label: "Erklären", sentenceCount: "3-4", action: "Erkläre die Beobachtung, sichere sie am Text und leite ihre Wirkung oder Funktion ab" };
  }
  if (/^(zeige|weise|ordne|vergleiche|verbinde)/.test(text)) {
    return { label: "Zeigen", sentenceCount: "3-4", action: "Zeige die Aussage an einem genauen Detail und führe sie zu einer Deutung weiter" };
  }
  if (/^(prüfe|pruefe|entscheide)/.test(text)) {
    return { label: "Prüfen", sentenceCount: "3-4", action: "Entscheide dich begründet und sichere deine Entscheidung am Text" };
  }
  if (/^(wo|wodurch|woran|welche|welcher|welches|nenne|benenne)/.test(text)) {
    return { label: "Benennen", sentenceCount: "2-3", action: "Benenne zuerst das Textsignal und erkläre dann knapp seine Funktion" };
  }
  return { label: "Ausarbeiten", sentenceCount: "3-4", action: "Arbeite die Frage in präzisen, textnahen Sätzen aus" };
}

function focusTerms(prompt = "", context = "", extras = []) {
  return unique([
    ...tokenizeMeaningful(prompt),
    ...tokenizeMeaningful(context),
    ...extras.flatMap((item) => tokenizeMeaningful(item))
  ]).slice(0, 6);
}

function conceptFromAliases(label, aliases = []) {
  const normalizedAliases = unique(
    aliases.flatMap((alias) => {
      return aliasVariants(alias).flatMap((variant) => unique([variant, ...variant.split(" ").filter((part) => part.length > 2)]));
    })
  );

  return {
    label,
    aliases: normalizedAliases
  };
}

function theoryConcepts(ids = []) {
  return ids
    .map((id) => theoryProfiles[id])
    .filter(Boolean)
    .map((profile) => conceptFromAliases(profile.label, profile.aliases));
}

function modelAnswerForTask({ prompt, context, signalWords = [], keyIdeas = [], writingFrame = "", relatedTheoryIds = [], taskTitle = "" }) {
  const sentence = firstSentence(context || writingFrame || taskTitle);
  const promptFocus = focusTerms(prompt, "", [...signalWords, ...keyIdeas, taskTitle]).slice(0, 3);
  const promptSentence = promptFocus.length
    ? `Im Zentrum der Frage stehen hier ${naturalJoin(promptFocus)}.`
    : "";
  const evidence = signalWords.length
    ? `Das sieht man an Signalen wie ${signalWords.slice(0, 2).map((word) => `"${word}"`).join(" und ")}.`
    : "";
  const theoryHint = relatedTheoryIds
    .map((id) => theoryProfiles[id]?.label)
    .filter(Boolean)
    .slice(0, 2);
  const focus = keyIdeas.length ? keyIdeas.slice(0, 2).join(" und ") : focusTerms(prompt, context, signalWords).slice(0, 2).join(" und ");
  const focusSentence = focus
    ? `Wichtig wird dabei besonders ${focus.toLowerCase()}.`
    : "";
  const finalSentence = theoryHint.length
    ? `So wird besonders ${theoryHint.join(" und ").toLowerCase()} sichtbar.`
    : focusSentence
      || "Dadurch wird die Funktion der Passage deutlich und nicht nur ihr Inhalt nacherzählt.";

  return unique([promptSentence, capitalize(sentence), evidence, finalSentence]).join(" ");
}

function instructionForTask(prompt, { signalWords = [], relatedTheoryIds = [], kind = "question" } = {}) {
  const operator = operatorProfile(prompt);
  const evidencePart = signalWords.length
    ? `Arbeite mit mindestens einem genauen Signalwort aus der Passage, zum Beispiel ${signalWords.slice(0, 2).map((word) => `"${word}"`).join(" oder ")}.`
    : "Arbeite mit mindestens einem genauen Textdetail oder Wortlaut aus der Passage.";
  const theoryPart = relatedTheoryIds.length
    ? `Verbinde deine Beobachtung am Schluss mit ${relatedTheoryIds.map((id) => theoryProfiles[id]?.label).filter(Boolean).slice(0, 2).join(" oder ")}.`
    : "Schliesse mit einer klaren Deutung oder Funktionsaussage.";
  const opening = kind === "transfer"
    ? "Beziehe Passage und Deutungslinse ausdrücklich aufeinander."
    : kind === "resource"
      ? "Nutze das Material als Leselinse und bleibe eng am Romanausschnitt."
      : operator.action;

  return `Antworte in ${operator.sentenceCount} Sätzen. ${opening}. ${evidencePart} ${theoryPart}`;
}

function checklistForTask(prompt, { signalWords = [], relatedTheoryIds = [] } = {}) {
  const operator = operatorProfile(prompt);
  return unique([
    `${operator.label}: ${capitalize(prompt.replace(/\?$/, ""))}.`,
    signalWords.length
      ? `Nenne mindestens ein Textsignal aus der Passage: ${signalWords.slice(0, 3).join(", ")}.`
      : "Nenne mindestens ein Textsignal oder eine genaue Beobachtung aus der Passage.",
    relatedTheoryIds.length
      ? `Verbinde deine Aussage mit ${relatedTheoryIds.map((id) => theoryProfiles[id]?.label).filter(Boolean).slice(0, 2).join(" oder ")}.`
      : "Formuliere am Schluss die Wirkung, Funktion oder Ambivalenz der Stelle."
  ]);
}

export function buildTask(prompt, options = {}) {
  const {
    context = "",
    signalWords = [],
    relatedTheoryIds = [],
    keyIdeas = [],
    writingFrame = "",
    kind = "question",
    taskTitle = ""
  } = options;
  const question = String(prompt || "").trim();
  const conceptTerms = focusTerms(question, context, [...signalWords, ...keyIdeas]);
  const concepts = unique([
    signalWords.length ? conceptFromAliases("Textsignal", signalWords) : null,
    ...theoryConcepts(relatedTheoryIds),
    conceptTerms.length ? conceptFromAliases("Fragekern", conceptTerms) : null
  ]);

  return {
    prompt: question,
    operatorLabel: operatorProfile(question).label,
    instruction: instructionForTask(question, { signalWords, relatedTheoryIds, kind }),
    checklist: checklistForTask(question, { signalWords, relatedTheoryIds }),
    modelAnswer: modelAnswerForTask({
      prompt: question,
      context,
      signalWords,
      keyIdeas,
      writingFrame,
      relatedTheoryIds,
      taskTitle
    }),
    concepts,
    synonymHints: unique(concepts.flatMap((concept) => concept.aliases)).slice(0, 10)
  };
}

export const theoryResources = [
  {
    "id": "archiv-biografie",
    "title": "Dossier: Johanna Spyri, Archiv und vorsichtige Biografie",
    "shortTitle": "Archiv",
    "sourceTitle": "Dossier: Johanna Spyri, Archiv und vorsichtige Biografie",
    "mediaType": "html",
    "openUrl": "/reader/assets/heidi-archiv-biografie.html",
    "embedUrl": "/reader/assets/heidi-archiv-biografie.html",
    "summary": "Spyri wird als Autorin historisch fassbar, aber nicht einfach durch Heidi erklärbar. Archivfragen helfen, biografische Kurzschlüsse zu vermeiden.",
    "keyIdeas": [
      "Autorin",
      "Archiv",
      "Nachlass",
      "Biografie"
    ],
    "questions": [
      "Wo wäre eine biografische Deutung hilfreich, wo wäre sie zu schnell?",
      "Welche Informationen über Familie, Herkunft oder Nachlass verändern deine Lektüre?"
    ],
    "transferPrompts": [
      "Nutze Archiv als Leselinse und sichere die Deutung an einer konkreten Romanstelle.",
      "Formuliere eine These, die ohne Archiv nicht sichtbar wäre."
    ],
    "writingFrame": "Mit der Leselinse Archiv wird sichtbar, dass ..."
  },
  {
    "id": "spyris-werk-lesarten",
    "title": "Forschungsdossier: Johanna Spyri und ihr Werk - Lesarten",
    "shortTitle": "Spyri",
    "sourceTitle": "SIKJM: Johanna Spyri und ihr Werk - Lesarten",
    "mediaType": "html",
    "openUrl": "/reader/assets/johanna-spyri-und-ihr-werk-lesarten.html",
    "embedUrl": "/reader/assets/johanna-spyri-und-ihr-werk-lesarten.html",
    "summary": "Der SIKJM-Band macht das Wechselspiel zwischen Johanna Spyri, Heidi, Frauenbiografie, Zürcher Politik, gesellschaftlichen Rollen und späterer Rezeption sichtbar.",
    "keyIdeas": [
      "Johanna Spyri",
      "Heidi als Figur",
      "Frauenbiografie",
      "Zürich",
      "Politik",
      "Rezeption"
    ],
    "questions": [
      "Wo schärft Spyris Biografie die Lektüre, ohne Heidi einfach mit Johanna gleichzusetzen?",
      "Welche gesellschaftlichen oder politischen Spannungen werden im Roman indirekt verhandelbar?",
      "Wie verändert die spätere Heidi-Rezeption den Blick auf den Roman?"
    ],
    "transferPrompts": [
      "Nutze das Forschungsdossier, um eine konkrete Romanstelle zwischen Text, Biografie und Gesellschaft zu lesen.",
      "Prüfe, ob Heidi eher biografische Spur, literarische Figur oder kulturelle Projektionsfläche ist.",
      "Formuliere eine These dazu, wie politische und gesellschaftliche Konflikte im Roman indirekt erscheinen."
    ],
    "writingFrame": "Mit der Leselinse Spyri/Gesellschaft wird sichtbar, dass ..."
  },
  {
    "id": "religion",
    "title": "Dossier: Religion, Grossmutter und Mehrfachadressierung",
    "shortTitle": "Religion",
    "sourceTitle": "Dossier: Religion, Grossmutter und Mehrfachadressierung",
    "mediaType": "html",
    "openUrl": "/reader/assets/heidi-religion-mehrfachadressierung.html",
    "embedUrl": "/reader/assets/heidi-religion-mehrfachadressierung.html",
    "summary": "Religiöse Passagen sprechen Kinder und erwachsene Mitlesende zugleich an und strukturieren Trost, Schuld, Dankbarkeit und Erziehung.",
    "keyIdeas": [
      "Gottvertrauen",
      "Zweifel",
      "Grossmama",
      "Pfarrer"
    ],
    "questions": [
      "Wie wird Religion als Trost, Erziehung oder Konfliktlösung eingesetzt?",
      "Welche Zweifel werden ernst genommen und welche werden erzählerisch geschlossen?"
    ],
    "transferPrompts": [
      "Nutze Religion als Leselinse und sichere die Deutung an einer konkreten Romanstelle.",
      "Formuliere eine These, die ohne Religion nicht sichtbar wäre."
    ],
    "writingFrame": "Mit der Leselinse Religion wird sichtbar, dass ..."
  },
  {
    "id": "natur-paedagogik",
    "title": "Dossier: Alp, Natur und Pädagogik",
    "shortTitle": "Natur",
    "sourceTitle": "Dossier: Alp, Natur und Pädagogik",
    "mediaType": "html",
    "openUrl": "/reader/assets/heidi-natur-paedagogik.html",
    "embedUrl": "/reader/assets/heidi-natur-paedagogik.html",
    "summary": "Die Alp ist Erfahrungsraum, Körperraum und Gegenmodell zur kontrollierten Schule. Natur wirkt im Roman aktiv auf Figuren.",
    "keyIdeas": [
      "Alp",
      "Körper",
      "Schule",
      "Erfahrung"
    ],
    "questions": [
      "Welche Naturdetails verändern Heidis Verhalten?",
      "Welches pädagogische Modell steht hinter Grossvater, Peter oder der Grossmama?"
    ],
    "transferPrompts": [
      "Nutze Natur als Leselinse und sichere die Deutung an einer konkreten Romanstelle.",
      "Formuliere eine These, die ohne Natur nicht sichtbar wäre."
    ],
    "writingFrame": "Mit der Leselinse Natur wird sichtbar, dass ..."
  },
  {
    "id": "figuren-beziehungen",
    "title": "Dossier: Figuren und Beziehungen",
    "shortTitle": "Beziehungen",
    "sourceTitle": "Dossier: Figuren und Beziehungen",
    "mediaType": "html",
    "openUrl": "/reader/assets/heidi-figuren-beziehungen.html",
    "embedUrl": "/reader/assets/heidi-figuren-beziehungen.html",
    "summary": "Beziehungen sind in Heidi kein Beiwerk: Nähe, Eifersucht, Fürsorge und Bevormundung verschieben die Ordnung zwischen Kindern und Erwachsenen.",
    "keyIdeas": [
      "Heidi",
      "Peter",
      "Klara",
      "Grossvater",
      "Fürsorge"
    ],
    "questions": [
      "Welche Beziehung verändert sich in der aktuellen Szene?",
      "Wer gewinnt oder verliert Handlungsspielraum?"
    ],
    "transferPrompts": [
      "Nutze Figurenbeziehungen als Leselinse und sichere die Deutung an einer konkreten Romanstelle.",
      "Formuliere eine These, die ohne Beziehungsanalyse nicht sichtbar wäre."
    ],
    "writingFrame": "Mit der Leselinse Figurenbeziehungen wird sichtbar, dass ..."
  },
  {
    "id": "stadt-land",
    "title": "Dossier: Frankfurt, Ordnung und Heimweh",
    "shortTitle": "Stadt",
    "sourceTitle": "Dossier: Frankfurt, Ordnung und Heimweh",
    "mediaType": "html",
    "openUrl": "/reader/assets/heidi-stadt-land.html",
    "embedUrl": "/reader/assets/heidi-stadt-land.html",
    "summary": "Frankfurt zeigt Hausordnung, soziale Rollen, Unterricht und Medizin. Heimweh wird dadurch als seelische, körperliche und räumliche Krise lesbar.",
    "keyIdeas": [
      "Frankfurt",
      "Fenster",
      "Heimweh",
      "Hausordnung"
    ],
    "questions": [
      "Welche Regeln machen Heidi fremd?",
      "Wie unterscheiden sich medizinische, soziale und erzählerische Erklärung des Heimwehs?"
    ],
    "transferPrompts": [
      "Nutze Stadt als Leselinse und sichere die Deutung an einer konkreten Romanstelle.",
      "Formuliere eine These, die ohne Stadt nicht sichtbar wäre."
    ],
    "writingFrame": "Mit der Leselinse Stadt wird sichtbar, dass ..."
  },
  {
    "id": "koerper-gesundheit",
    "title": "Dossier: Körper, Krankheit und Heilung",
    "shortTitle": "Körper",
    "sourceTitle": "Dossier: Körper, Krankheit und Heilung",
    "mediaType": "html",
    "openUrl": "/reader/assets/heidi-stadt-land.html",
    "embedUrl": "/reader/assets/heidi-stadt-land.html",
    "summary": "Krankheit, Essen, Schlaf, Bewegung, Rollstuhl und Laufen verbinden Körperfragen mit sozialer Ordnung und Hoffnung.",
    "keyIdeas": [
      "Krankheit",
      "Rollstuhl",
      "Laufen",
      "Essen"
    ],
    "questions": [
      "Welche Körperzeichen sind erzählerisch entscheidend?",
      "Wo wird Heilung plausibel, symbolisch oder problematisch?"
    ],
    "transferPrompts": [
      "Nutze Körper als Leselinse und sichere die Deutung an einer konkreten Romanstelle.",
      "Formuliere eine These, die ohne Körper nicht sichtbar wäre."
    ],
    "writingFrame": "Mit der Leselinse Körper wird sichtbar, dass ..."
  },
  {
    "id": "sprache-erzaehlen",
    "title": "Dossier: Sprache und Erzählen",
    "shortTitle": "Sprache",
    "sourceTitle": "Dossier: Sprache und Erzählen",
    "mediaType": "html",
    "openUrl": "/reader/assets/heidi-sprache-erzaehlen.html",
    "embedUrl": "/reader/assets/heidi-sprache-erzaehlen.html",
    "summary": "Dialoge, Anreden, Missverständnisse und Erzählerkommentare zeigen soziale Ordnung und erzeugen Komik, Kritik oder Nähe.",
    "keyIdeas": [
      "Dialog",
      "Anrede",
      "Missverständnis",
      "Erzählstimme"
    ],
    "questions": [
      "Welche Formulierung trägt die Deutung?",
      "Wie steuert die Erzählstimme unseren Blick auf Heidi oder die Erwachsenen?"
    ],
    "transferPrompts": [
      "Nutze Sprache als Leselinse und sichere die Deutung an einer konkreten Romanstelle.",
      "Formuliere eine These, die ohne genaue Wortlautbeobachtung nicht sichtbar wäre."
    ],
    "writingFrame": "Mit der Leselinse Sprache wird sichtbar, dass ..."
  },
  {
    "id": "schuld-ordnung",
    "title": "Dossier: Schuld und Ordnung",
    "shortTitle": "Schuld",
    "sourceTitle": "Dossier: Schuld und Ordnung",
    "mediaType": "html",
    "openUrl": "/reader/assets/heidi-schuld-ordnung.html",
    "embedUrl": "/reader/assets/heidi-schuld-ordnung.html",
    "summary": "Peters Tat, Geständnis und Wiedergutmachung zeigen, wie der Roman Schuld versteht, sozial einordnet und am Schluss beruhigt.",
    "keyIdeas": [
      "Schuld",
      "Geständnis",
      "Vergebung",
      "Wiedergutmachung"
    ],
    "questions": [
      "Welche Motive führen zur Schuld?",
      "Wie unterscheidet der Roman zwischen Verstehen, Entschuldigen und Wiedergutmachen?"
    ],
    "transferPrompts": [
      "Nutze Schuld und Ordnung als Leselinse und sichere die Deutung an einer konkreten Romanstelle.",
      "Formuliere eine These, die den Schluss nicht nur harmonisch, sondern kritisch liest."
    ],
    "writingFrame": "Mit der Leselinse Schuld und Ordnung wird sichtbar, dass ..."
  },
  {
    "id": "bilder-popularisierung",
    "title": "Dossier: Bilder, Heimat und Popularisierung",
    "shortTitle": "Bilder",
    "sourceTitle": "Dossier: Bilder, Heimat und Popularisierung",
    "mediaType": "html",
    "openUrl": "/reader/assets/heidi-bilder-popularisierung.html",
    "embedUrl": "/reader/assets/heidi-bilder-popularisierung.html",
    "summary": "Illustrationen, Schulhefte und spätere Medien formen Heidi zu einer Heimat- und Schweizfigur, die über den Roman hinaus wirkt.",
    "keyIdeas": [
      "Illustration",
      "Heimat",
      "Schweiz",
      "Medien"
    ],
    "questions": [
      "Welche inneren Bilder erzeugt der Roman selbst?",
      "Wie verändert Popularisierung die Deutung von Heimat?"
    ],
    "transferPrompts": [
      "Nutze Bilder als Leselinse und sichere die Deutung an einer konkreten Romanstelle.",
      "Formuliere eine These, die ohne Bilder nicht sichtbar wäre."
    ],
    "writingFrame": "Mit der Leselinse Bilder wird sichtbar, dass ..."
  },
  {
    "id": "film-alptraum",
    "title": "Filmwerkstatt: Heidis Alptraum",
    "shortTitle": "Film",
    "sourceTitle": "Filmwerkstatt: Heidis Alptraum",
    "mediaType": "html",
    "openUrl": "/reader/assets/heidi-film-alptraum.html",
    "embedUrl": "/reader/assets/heidi-film-alptraum.html",
    "summary": "Anita Hugis Dokumentarfilm wird als interpretatorische Erweiterung genutzt: Er fragt nach Spyri, Mythos, Bildgeschichte und der Schattenseite des Heidi-Erfolgs.",
    "keyIdeas": [
      "Film",
      "SRF",
      "Alptraum",
      "Archiv"
    ],
    "questions": [
      "Welche Romanstelle liest du nach dem Film anders?",
      "Wie arbeitet der Film mit Stimme, Landschaft, Archiv oder Pop-Ikone?"
    ],
    "transferPrompts": [
      "Nutze Film als Leselinse und sichere die Deutung an einer konkreten Romanstelle.",
      "Formuliere eine These, die ohne Film nicht sichtbar wäre."
    ],
    "writingFrame": "Mit der Leselinse Film wird sichtbar, dass ..."
  },
  {
    "id": "material-craft",
    "title": "Materialstation: Craft-Links und SRF-Hinweis",
    "shortTitle": "Material",
    "sourceTitle": "Materialstation: Craft-Links und SRF-Hinweis",
    "mediaType": "html",
    "openUrl": "/reader/assets/heidi-material-craft.html",
    "embedUrl": "/reader/assets/heidi-material-craft.html",
    "summary": "Die Craft-Materialien werden in Thesen, Beobachtungsfragen und Vergleichsaufträge übersetzt, statt nur verlinkt zu werden.",
    "keyIdeas": [
      "Craft",
      "SRF",
      "Material",
      "These"
    ],
    "questions": [
      "Welcher konkrete Materialimpuls führt zu einer neuen Romanthese?",
      "Wie wird aus einem Link eine genaue Beobachtungsaufgabe?"
    ],
    "transferPrompts": [
      "Nutze Material als Leselinse und sichere die Deutung an einer konkreten Romanstelle.",
      "Formuliere eine These, die ohne Material nicht sichtbar wäre."
    ],
    "writingFrame": "Mit der Leselinse Material wird sichtbar, dass ...",
    "externalLinks": [
      {
        "label": "Craft: Johanna Spyri: Heidi",
        "url": "https://s.craft.me/QfI3FNe41YGWUI"
      },
      {
        "label": "Craft: SRF-Hinweis vom 27.11.2022",
        "url": "https://s.craft.me/RMkak7X9xxvPQp"
      }
    ]
  },
  {
    "id": "studienkompass",
    "title": "Studienkompass: Heidi und mehr",
    "shortTitle": "Forschung",
    "sourceTitle": "Studienkompass: Heidi und mehr",
    "mediaType": "html",
    "openUrl": "/reader/assets/heidi-studienkompass.html",
    "embedUrl": "/reader/assets/heidi-studienkompass.html",
    "summary": "Der Open-Access-Band liefert Forschungsachsen zu Archiv, Religion, Bildgeschichte, Alp, Popularisierung, Übersetzung und Medien.",
    "keyIdeas": [
      "Forschung",
      "Open Access",
      "De Gruyter",
      "Leselinse"
    ],
    "questions": [
      "Welche Forschungsachse hilft bei deiner aktuellen Frage?",
      "Wie verändert Forschung deine erste Leseintuition?"
    ],
    "transferPrompts": [
      "Nutze Forschung als Leselinse und sichere die Deutung an einer konkreten Romanstelle.",
      "Formuliere eine These, die ohne Forschung nicht sichtbar wäre."
    ],
    "writingFrame": "Mit der Leselinse Forschung wird sichtbar, dass ..."
  },
  {
    "id": "ki-trailer",
    "title": "KI-Trailer-Werkstatt: CURSED HEIDI",
    "shortTitle": "KI-Trailer",
    "sourceTitle": "YouTube: CURSED HEIDI | AI-generated movie trailer, Karpi",
    "mediaType": "html",
    "openUrl": "/reader/assets/heidi-ki-trailer-cursed.html",
    "embedUrl": "/reader/assets/heidi-ki-trailer-cursed.html",
    "summary": "Der KI-generierte Trailer verfremdet Heidi zur Horrorfigur. Dadurch werden Popularisierung, Bildklischees, Alpenästhetik und kulturelle Erwartung an Kindheit produktiv sichtbar.",
    "keyIdeas": [
      "KI-Ästhetik",
      "Horror",
      "Verfremdung",
      "Heidi-Ikone",
      "Medienkritik"
    ],
    "questions": [
      "Welche Romanmotive übernimmt der Trailer, und welche dreht er gegen die Vorlage?",
      "Wie erzeugen Bild, Musik und Schnitt eine unheimliche Heidi?",
      "Welche Spuren der KI-Generierung beeinflussen deine Deutung?"
    ],
    "transferPrompts": [
      "Vergleiche eine konkrete Romanstelle mit einer Einstellung oder Sequenz aus dem Trailer.",
      "Erkläre, was der Trailer über die Stabilität oder Zerbrechlichkeit der Heidi-Ikone zeigt.",
      "Prüfe, ob die Verfremdung eine Kritik an Heimatkitsch, eine Parodie oder vor allem ein Effektspiel ist."
    ],
    "writingFrame": "Der KI-Trailer macht an Heidi sichtbar, dass kulturelle Bilder von Kindheit und Heimat ...",
    "externalLinks": [
      {
        "label": "YouTube: CURSED HEIDI | AI-generated movie trailer",
        "url": "https://www.youtube.com/watch?v=0A2-Af5JEWU"
      }
    ]
  }
];

const rawReaderModules = [
  {
    "id": "modul-01",
    "title": "Ankunft auf der Alp",
    "summary": "Heidi wird vom sozialen Problemfall zur Figur der alpinen Neuordnung.",
    "entries": [
      {
        "id": "frage-01",
        "title": "Frage 1",
        "passageLabel": "Leitfrage 1",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 1,
        "context": "Schildern Sie den Aufstieg von Maienfeld zur Alp! Wer ist Dete? Wer ist Heidi? Warum ist diese so warm angezogen?",
        "signalWords": [
          "Heidi",
          "Dete"
        ],
        "relatedTheoryIds": [
          "archiv-biografie",
          "figuren-beziehungen"
        ],
        "prompts": [
          "Schildern Sie den Aufstieg von Maienfeld zur Alp! Wer ist Dete? Wer ist Heidi? Warum ist diese so warm angezogen?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-02",
        "title": "Frage 2",
        "passageLabel": "Leitfrage 2",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 2,
        "context": "Erläutern Sie das Gespräch zwischen Barbel und Dete? In welchem Verhältnis stehen die beiden zueinander?",
        "signalWords": [
          "Dete"
        ],
        "relatedTheoryIds": [
          "archiv-biografie",
          "figuren-beziehungen"
        ],
        "prompts": [
          "Erläutern Sie das Gespräch zwischen Barbel und Dete? In welchem Verhältnis stehen die beiden zueinander?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-03",
        "title": "Frage 3",
        "passageLabel": "Leitfrage 3",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 3,
        "context": "Erklären Sie den familiären und sozialen Hintergrund von Dete, Almöhi und Heidi! Wer war Tobias?",
        "signalWords": [
          "Heidi",
          "Dete",
          "Almöhi"
        ],
        "relatedTheoryIds": [
          "archiv-biografie",
          "figuren-beziehungen"
        ],
        "prompts": [
          "Erklären Sie den familiären und sozialen Hintergrund von Dete, Almöhi und Heidi! Wer war Tobias?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-04",
        "title": "Frage 4",
        "passageLabel": "Leitfrage 4",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 4,
        "context": "Fassen Sie die Geschichte von Almöhi zusammen! Warum lebt er alleine auf der Alp? Beschreiben Sie seinen Charakter!",
        "signalWords": [
          "Almöhi"
        ],
        "relatedTheoryIds": [
          "archiv-biografie",
          "figuren-beziehungen"
        ],
        "prompts": [
          "Fassen Sie die Geschichte von Almöhi zusammen! Warum lebt er alleine auf der Alp? Beschreiben Sie seinen Charakter!"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-05",
        "title": "Frage 5",
        "passageLabel": "Leitfrage 5",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 5,
        "context": "Warum will Dete Heidi loswerden? Schildern Sie die Ankunftsszene und den Abschied von Heidi und Dete! Wie reagiert Heidi auf die Natur?",
        "signalWords": [
          "Heidi",
          "Dete"
        ],
        "relatedTheoryIds": [
          "archiv-biografie",
          "figuren-beziehungen"
        ],
        "prompts": [
          "Warum will Dete Heidi loswerden? Schildern Sie die Ankunftsszene und den Abschied von Heidi und Dete! Wie reagiert Heidi auf die Natur?"
        ],
        "focusTasks": []
      }
    ]
  },
  {
    "id": "modul-02",
    "title": "Grossvater, Peter und Natur",
    "summary": "Natur, Tiere und Schule zeigen konkurrierende Erziehungsmodelle.",
    "entries": [
      {
        "id": "frage-06",
        "title": "Frage 6",
        "passageLabel": "Leitfrage 6",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 6,
        "context": "Wer ist Geissenpeter? Charakterisieren Sie ihn. Welche Aufgaben erledigt er? Warum arbeitet er so viel?",
        "signalWords": [
          "Geissenpeter",
          "Peter"
        ],
        "relatedTheoryIds": [
          "natur-paedagogik",
          "sprache-erzaehlen"
        ],
        "prompts": [
          "Wer ist Geissenpeter? Charakterisieren Sie ihn. Welche Aufgaben erledigt er? Warum arbeitet er so viel?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-07",
        "title": "Frage 7",
        "passageLabel": "Leitfrage 7",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 7,
        "context": "Was bewirkt Heidis Anwesenheit bei Almöhi? Wie richtet sich Heidi ein? Welche Charakterzüge zeigt Heidi? Wie reagiert Almöhi darauf?",
        "signalWords": [
          "Heidi",
          "Almöhi"
        ],
        "relatedTheoryIds": [
          "natur-paedagogik",
          "sprache-erzaehlen"
        ],
        "prompts": [
          "Was bewirkt Heidis Anwesenheit bei Almöhi? Wie richtet sich Heidi ein? Welche Charakterzüge zeigt Heidi? Wie reagiert Almöhi darauf?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-08",
        "title": "Frage 8",
        "passageLabel": "Leitfrage 8",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 8,
        "context": "Wie wird die Natur beschrieben? Wie geht Geissenpeter mit den Tieren um? Wo setzt ihm Heidi Grenzen? Wie gehen die beiden miteinander um? Beschreiben Sie den Gesprächston.",
        "signalWords": [
          "Heidi",
          "Geissenpeter",
          "Peter"
        ],
        "relatedTheoryIds": [
          "natur-paedagogik",
          "sprache-erzaehlen"
        ],
        "prompts": [
          "Wie wird die Natur beschrieben? Wie geht Geissenpeter mit den Tieren um? Wo setzt ihm Heidi Grenzen? Wie gehen die beiden miteinander um? Beschreiben Sie den Gesprächston."
        ],
        "focusTasks": []
      },
      {
        "id": "frage-09",
        "title": "Frage 9",
        "passageLabel": "Leitfrage 9",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 9,
        "context": "Was hat es zu bedeuten, dass Geissenpeter behauptet, die Berge hätten keine Namen?",
        "signalWords": [
          "Geissenpeter",
          "Peter"
        ],
        "relatedTheoryIds": [
          "natur-paedagogik",
          "sprache-erzaehlen"
        ],
        "prompts": [
          "Was hat es zu bedeuten, dass Geissenpeter behauptet, die Berge hätten keine Namen?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-10",
        "title": "Frage 10",
        "passageLabel": "Leitfrage 10",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 10,
        "context": "Wie spricht Almöhi Geissenpeter an? Was hat es mit dem militärischen Unterton auf sich?",
        "signalWords": [
          "Almöhi",
          "Geissenpeter",
          "Peter"
        ],
        "relatedTheoryIds": [
          "natur-paedagogik",
          "sprache-erzaehlen"
        ],
        "prompts": [
          "Wie spricht Almöhi Geissenpeter an? Was hat es mit dem militärischen Unterton auf sich?"
        ],
        "focusTasks": []
      }
    ]
  },
  {
    "id": "modul-03",
    "title": "Grossmutter, Pfarrer und Weggang",
    "summary": "Religion, Fürsorge und sozialer Druck treiben den Ortswechsel an.",
    "entries": [
      {
        "id": "frage-11",
        "title": "Frage 11",
        "passageLabel": "Leitfrage 11",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 11,
        "context": "Interpretieren Sie die Formulierung «am Griffel nagen». Inwiefern beschreibt sie Geissenpeters Verhältnis zur Schule?",
        "signalWords": [
          "Geissenpeter",
          "Peter"
        ],
        "relatedTheoryIds": [
          "religion",
          "figuren-beziehungen"
        ],
        "prompts": [
          "Interpretieren Sie die Formulierung «am Griffel nagen». Inwiefern beschreibt sie Geissenpeters Verhältnis zur Schule?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-12",
        "title": "Frage 12",
        "passageLabel": "Leitfrage 12",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 12,
        "context": "Wie erlebt Heidi den Winter? Wie verläuft der Besuch bei der Grossmutter? Was tut Almöhi? Inwiefern ist diese Entwicklung aussergewöhnlich?",
        "signalWords": [
          "Heidi",
          "Almöhi",
          "Grossmutter"
        ],
        "relatedTheoryIds": [
          "religion",
          "figuren-beziehungen"
        ],
        "prompts": [
          "Wie erlebt Heidi den Winter? Wie verläuft der Besuch bei der Grossmutter? Was tut Almöhi? Inwiefern ist diese Entwicklung aussergewöhnlich?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-13",
        "title": "Frage 13",
        "passageLabel": "Leitfrage 13",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 13,
        "context": "Beschreiben Sie die Beziehung zwischen Heidi und der Grossmutter.",
        "signalWords": [
          "Heidi",
          "Grossmutter"
        ],
        "relatedTheoryIds": [
          "religion",
          "figuren-beziehungen"
        ],
        "prompts": [
          "Beschreiben Sie die Beziehung zwischen Heidi und der Grossmutter."
        ],
        "focusTasks": []
      },
      {
        "id": "frage-14",
        "title": "Frage 14",
        "passageLabel": "Leitfrage 14",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 14,
        "context": "Kommentieren Sie das Gespräch des Pfarrers mit Almöhi! Worum geht es? Wie reagiert der Almöhi darauf?",
        "signalWords": [
          "Almöhi",
          "Pfarrer"
        ],
        "relatedTheoryIds": [
          "religion",
          "figuren-beziehungen"
        ],
        "prompts": [
          "Kommentieren Sie das Gespräch des Pfarrers mit Almöhi! Worum geht es? Wie reagiert der Almöhi darauf?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-15",
        "title": "Frage 15",
        "passageLabel": "Leitfrage 15",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 15,
        "context": "Warum kommt Dete zu Besuch? Wie reagiert Almöhi? Welche Folgen hat dies für Heidi? Wie reagiert sie darauf? Was lässt sich aus der Ausdrucksweise von Heidi schliessen?",
        "signalWords": [
          "Heidi",
          "Dete",
          "Almöhi"
        ],
        "relatedTheoryIds": [
          "religion",
          "figuren-beziehungen"
        ],
        "prompts": [
          "Warum kommt Dete zu Besuch? Wie reagiert Almöhi? Welche Folgen hat dies für Heidi? Wie reagiert sie darauf? Was lässt sich aus der Ausdrucksweise von Heidi schliessen?"
        ],
        "focusTasks": []
      }
    ]
  },
  {
    "id": "modul-04",
    "title": "Frankfurt als Gegenwelt",
    "summary": "Frankfurt macht Hausordnung, Stand und Fremdheit sichtbar.",
    "entries": [
      {
        "id": "frage-16",
        "title": "Frage 16",
        "passageLabel": "Leitfrage 16",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 16,
        "context": "Schildern Sie Heidis Ankunft in Frankfurt! Charakterisieren Sie Fräulein Rottenmeier! Warum reagiert sie schlecht auf Heidi?",
        "signalWords": [
          "Heidi",
          "Frankfurt",
          "Rottenmeier"
        ],
        "relatedTheoryIds": [
          "stadt-land",
          "koerper-gesundheit"
        ],
        "prompts": [
          "Schildern Sie Heidis Ankunft in Frankfurt! Charakterisieren Sie Fräulein Rottenmeier! Warum reagiert sie schlecht auf Heidi?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-17",
        "title": "Frage 17",
        "passageLabel": "Leitfrage 17",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 17,
        "context": "Wie geht Heidi mit so viel Ablehnung um? Welche Benimmregeln werden von ihr verlangt?",
        "signalWords": [
          "Heidi"
        ],
        "relatedTheoryIds": [
          "stadt-land",
          "koerper-gesundheit"
        ],
        "prompts": [
          "Wie geht Heidi mit so viel Ablehnung um? Welche Benimmregeln werden von ihr verlangt?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-18",
        "title": "Frage 18",
        "passageLabel": "Leitfrage 18",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 18,
        "context": "Beschreiben Sie Sebastian und Tinette! Welche Rolle spielen sie und welche Beziehung hat Heidi zu den beiden?",
        "signalWords": [
          "Heidi",
          "Sebastian",
          "Tinette"
        ],
        "relatedTheoryIds": [
          "stadt-land",
          "koerper-gesundheit"
        ],
        "prompts": [
          "Beschreiben Sie Sebastian und Tinette! Welche Rolle spielen sie und welche Beziehung hat Heidi zu den beiden?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-19",
        "title": "Frage 19",
        "passageLabel": "Leitfrage 19",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 19,
        "context": "Wie nimmt Heidi die Stadt wahr? Warum will sie die Fenster öffnen?",
        "signalWords": [
          "Heidi"
        ],
        "relatedTheoryIds": [
          "stadt-land",
          "koerper-gesundheit"
        ],
        "prompts": [
          "Wie nimmt Heidi die Stadt wahr? Warum will sie die Fenster öffnen?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-20",
        "title": "Frage 20",
        "passageLabel": "Leitfrage 20",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 20,
        "context": "Wie geht der Schulunterricht mit dem Herrn Kandidaten vonstatten? Fassen Sie die pädagogischen Überlegungen von Fräulein Rottenmeier zusammen!",
        "signalWords": [
          "Rottenmeier"
        ],
        "relatedTheoryIds": [
          "stadt-land",
          "koerper-gesundheit"
        ],
        "prompts": [
          "Wie geht der Schulunterricht mit dem Herrn Kandidaten vonstatten? Fassen Sie die pädagogischen Überlegungen von Fräulein Rottenmeier zusammen!"
        ],
        "focusTasks": []
      }
    ]
  },
  {
    "id": "modul-05",
    "title": "Katzen, Unterricht und Missverstehen",
    "summary": "Komik und Konflikt zeigen, wie sehr Heidi missverstanden wird.",
    "entries": [
      {
        "id": "frage-21",
        "title": "Frage 21",
        "passageLabel": "Leitfrage 21",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 21,
        "context": "Warum ergreift Heidi die Flucht? Kommentieren Sie die Reaktion von Fräulein Rottenmeier!",
        "signalWords": [
          "Heidi",
          "Rottenmeier"
        ],
        "relatedTheoryIds": [
          "stadt-land",
          "sprache-erzaehlen"
        ],
        "prompts": [
          "Warum ergreift Heidi die Flucht? Kommentieren Sie die Reaktion von Fräulein Rottenmeier!"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-22",
        "title": "Frage 22",
        "passageLabel": "Leitfrage 22",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 22,
        "context": "Fassen Sie Heidis langen Streifzug durch Frankfurt zusammen! Beschreiben Sie den Jungen mit der Drehorgel! Wohin bringt er ihn? Wohin führt der Türmer Heidi?",
        "signalWords": [
          "Heidi",
          "Frankfurt"
        ],
        "relatedTheoryIds": [
          "stadt-land",
          "sprache-erzaehlen"
        ],
        "prompts": [
          "Fassen Sie Heidis langen Streifzug durch Frankfurt zusammen! Beschreiben Sie den Jungen mit der Drehorgel! Wohin bringt er ihn? Wohin führt der Türmer Heidi?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-23",
        "title": "Frage 23",
        "passageLabel": "Leitfrage 23",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 23,
        "context": "Woher kriegt Heidi die Kätzchen? Welche Probleme bringt dies mit sich? Wie reagiert Fräulein Rottenmeier? Wie hilft Sebastian?",
        "signalWords": [
          "Heidi",
          "Rottenmeier",
          "Sebastian"
        ],
        "relatedTheoryIds": [
          "stadt-land",
          "sprache-erzaehlen"
        ],
        "prompts": [
          "Woher kriegt Heidi die Kätzchen? Welche Probleme bringt dies mit sich? Wie reagiert Fräulein Rottenmeier? Wie hilft Sebastian?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-24",
        "title": "Frage 24",
        "passageLabel": "Leitfrage 24",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 24,
        "context": "Welchen Auftritt hat der Junge mit der Drehorgel im Hause Sesemann? Wie kommen noch mehr Katzen hinzu?",
        "signalWords": [
          "Sesemann"
        ],
        "relatedTheoryIds": [
          "stadt-land",
          "sprache-erzaehlen"
        ],
        "prompts": [
          "Welchen Auftritt hat der Junge mit der Drehorgel im Hause Sesemann? Wie kommen noch mehr Katzen hinzu?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-25",
        "title": "Frage 25",
        "passageLabel": "Leitfrage 25",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 25,
        "context": "Wie versucht Fräulein Rottenmeier Heidi zu bestrafen? Mit welchem Erfolg? Erklären Sie, inwiefern Fräulein Rottenmeier Heidi nicht versteht und von ihr Dankbarkeit verlangt für etwas, das sie gar nicht will! Warum will Heidi nach Hause gehen?",
        "signalWords": [
          "Heidi",
          "Rottenmeier"
        ],
        "relatedTheoryIds": [
          "stadt-land",
          "sprache-erzaehlen"
        ],
        "prompts": [
          "Wie versucht Fräulein Rottenmeier Heidi zu bestrafen? Mit welchem Erfolg? Erklären Sie, inwiefern Fräulein Rottenmeier Heidi nicht versteht und von ihr Dankbarkeit verlangt für etwas, das sie gar nicht will! Warum will Heidi nach Hause gehen?"
        ],
        "focusTasks": []
      }
    ]
  },
  {
    "id": "modul-06",
    "title": "Heimweh, Spuk und Heimkehr",
    "summary": "Heimweh wird körperlich, räumlich und medizinisch lesbar.",
    "entries": [
      {
        "id": "frage-26",
        "title": "Frage 26",
        "passageLabel": "Leitfrage 26",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 26,
        "context": "Was hat es mit dem gebunkerten alten Brot und dem Hut auf sich?",
        "signalWords": [
          "Heidi",
          "Erzählung"
        ],
        "relatedTheoryIds": [
          "stadt-land",
          "koerper-gesundheit"
        ],
        "prompts": [
          "Was hat es mit dem gebunkerten alten Brot und dem Hut auf sich?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-27",
        "title": "Frage 27",
        "passageLabel": "Leitfrage 27",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 27,
        "context": "Wie reagiert Herr Sesemann auf die Missstimmung in seinem Haus? Wer ergreift für wen Partei? Wie äussert sich Fräulein Rottenmeier? Welchen Bericht erstattet der Kandidat? Was berichtet Klara?",
        "signalWords": [
          "Rottenmeier",
          "Sesemann",
          "Klara"
        ],
        "relatedTheoryIds": [
          "stadt-land",
          "koerper-gesundheit"
        ],
        "prompts": [
          "Wie reagiert Herr Sesemann auf die Missstimmung in seinem Haus? Wer ergreift für wen Partei? Wie äussert sich Fräulein Rottenmeier? Welchen Bericht erstattet der Kandidat? Was berichtet Klara?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-28",
        "title": "Frage 28",
        "passageLabel": "Leitfrage 28",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 28,
        "context": "Schildern Sie die Ankunft der Grossmama. Wie versteht sich Heidi mit ihr? Wie schafft sie es, Heidis Vertrauen zu gewinnen? Kommentieren Sie die Gespräche über Religion. Erläutern Sie Heidis Zweifel an Gott. Wie lernt Heidi doch noch lesen?",
        "signalWords": [
          "Heidi"
        ],
        "relatedTheoryIds": [
          "stadt-land",
          "koerper-gesundheit"
        ],
        "prompts": [
          "Schildern Sie die Ankunft der Grossmama. Wie versteht sich Heidi mit ihr? Wie schafft sie es, Heidis Vertrauen zu gewinnen? Kommentieren Sie die Gespräche über Religion. Erläutern Sie Heidis Zweifel an Gott. Wie lernt Heidi doch noch lesen?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-29",
        "title": "Frage 29",
        "passageLabel": "Leitfrage 29",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 29,
        "context": "Was hat es mit den spukhaften Vorgängen im Hause Sesemann auf sich? Was berichtet Sebastian? Wie handelt Fräulein Rottenmeier?",
        "signalWords": [
          "Rottenmeier",
          "Sesemann",
          "Sebastian"
        ],
        "relatedTheoryIds": [
          "stadt-land",
          "koerper-gesundheit"
        ],
        "prompts": [
          "Was hat es mit den spukhaften Vorgängen im Hause Sesemann auf sich? Was berichtet Sebastian? Wie handelt Fräulein Rottenmeier?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-30",
        "title": "Frage 30",
        "passageLabel": "Leitfrage 30",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 30,
        "context": "Wie deckt der Doktor die Spukgeschichte auf? Wie diagnostiziert er das Heimweh? Analysieren Sie die medizinische Argumentation!",
        "signalWords": [
          "Doktor"
        ],
        "relatedTheoryIds": [
          "stadt-land",
          "koerper-gesundheit"
        ],
        "prompts": [
          "Wie deckt der Doktor die Spukgeschichte auf? Wie diagnostiziert er das Heimweh? Analysieren Sie die medizinische Argumentation!"
        ],
        "focusTasks": []
      }
    ]
  },
  {
    "id": "modul-07",
    "title": "Der Doktor und das gelernte Heidi",
    "summary": "Heidi wendet Gelerntes auf Trauer, Trost und Beziehung an.",
    "entries": [
      {
        "id": "frage-31",
        "title": "Frage 31",
        "passageLabel": "Leitfrage 31",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 31,
        "context": "Wie wird Heidis Heimreise organisiert? Wie reagieren Fräulein Rottenmeier, Dete und Klara? Welche Aufgabe übernimmt Sebastian? Schildern Sie den Abschied von Frankfurt! Wie nimmt Heidi am Schluss Abschied von Sebastian? Was steht im Brief von Sesemann an den Almöhi?",
        "signalWords": [
          "Heidi",
          "Dete",
          "Almöhi",
          "Frankfurt",
          "Rottenmeier"
        ],
        "relatedTheoryIds": [
          "religion",
          "koerper-gesundheit"
        ],
        "prompts": [
          "Wie wird Heidis Heimreise organisiert? Wie reagieren Fräulein Rottenmeier, Dete und Klara? Welche Aufgabe übernimmt Sebastian? Schildern Sie den Abschied von Frankfurt! Wie nimmt Heidi am Schluss Abschied von Sebastian? Was steht im Brief von Sesemann an den Almöhi?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-32",
        "title": "Frage 32",
        "passageLabel": "Leitfrage 32",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 32,
        "context": "Wie lebt sich Heidi wieder ein? Wie verlaufen die Wiedersehen? Welche Bilanz des Frankfurt-Aufenthalt wird gezogen?",
        "signalWords": [
          "Heidi",
          "Frankfurt"
        ],
        "relatedTheoryIds": [
          "religion",
          "koerper-gesundheit"
        ],
        "prompts": [
          "Wie lebt sich Heidi wieder ein? Wie verlaufen die Wiedersehen? Welche Bilanz des Frankfurt-Aufenthalt wird gezogen?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-33",
        "title": "Frage 33",
        "passageLabel": "Leitfrage 33",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 33,
        "context": "Kommentieren Sie das Gespräch von Almöhi mit dem Pfarrer! Was folgt daraus?",
        "signalWords": [
          "Almöhi",
          "Pfarrer"
        ],
        "relatedTheoryIds": [
          "religion",
          "koerper-gesundheit"
        ],
        "prompts": [
          "Kommentieren Sie das Gespräch von Almöhi mit dem Pfarrer! Was folgt daraus?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-34",
        "title": "Frage 34",
        "passageLabel": "Leitfrage 34",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 34,
        "context": "Welchen Schicksalsschlag hat der Doktor in der Zwischenzeit erlebt?",
        "signalWords": [
          "Doktor"
        ],
        "relatedTheoryIds": [
          "religion",
          "koerper-gesundheit"
        ],
        "prompts": [
          "Welchen Schicksalsschlag hat der Doktor in der Zwischenzeit erlebt?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-35",
        "title": "Frage 35",
        "passageLabel": "Leitfrage 35",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 35,
        "context": "Wie geht es Klara? Warum kann sie die versprochene Schweizreise nicht antreten?",
        "signalWords": [
          "Klara"
        ],
        "relatedTheoryIds": [
          "religion",
          "koerper-gesundheit"
        ],
        "prompts": [
          "Wie geht es Klara? Warum kann sie die versprochene Schweizreise nicht antreten?"
        ],
        "focusTasks": []
      }
    ]
  },
  {
    "id": "modul-08",
    "title": "Schule, Peter und Klaras Reise",
    "summary": "Lesenlernen und Besuchsplanung verbinden Pädagogik mit Eifersucht.",
    "entries": [
      {
        "id": "frage-36",
        "title": "Frage 36",
        "passageLabel": "Leitfrage 36",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 36,
        "context": "Wie reagieren Klara und Sebastian auf die Reise des Doktors? Wie versucht Fräulein Rottenmeier Klaras Kontaktaufnahme zu behindern?",
        "signalWords": [
          "Rottenmeier",
          "Klara",
          "Doktor",
          "Sebastian"
        ],
        "relatedTheoryIds": [
          "natur-paedagogik",
          "figuren-beziehungen"
        ],
        "prompts": [
          "Wie reagieren Klara und Sebastian auf die Reise des Doktors? Wie versucht Fräulein Rottenmeier Klaras Kontaktaufnahme zu behindern?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-37",
        "title": "Frage 37",
        "passageLabel": "Leitfrage 37",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 37,
        "context": "Beschreiben Sie das Wiedersehen mit dem Doktor und seine Beziehung zu Heidi. Interpretieren Sie die Geschenke von Klara und der Grossmama.",
        "signalWords": [
          "Heidi",
          "Klara",
          "Doktor"
        ],
        "relatedTheoryIds": [
          "natur-paedagogik",
          "figuren-beziehungen"
        ],
        "prompts": [
          "Beschreiben Sie das Wiedersehen mit dem Doktor und seine Beziehung zu Heidi. Interpretieren Sie die Geschenke von Klara und der Grossmama."
        ],
        "focusTasks": []
      },
      {
        "id": "frage-38",
        "title": "Frage 38",
        "passageLabel": "Leitfrage 38",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 38,
        "context": "Wie schafft es Heidi, den Doktor seine Trauer etwas vergessen zu lassen? Interpretieren Sie das Gedicht und dessen religiöses Programm. Wie halten Heidi und der Doktor Geissenpeter bei Laune?",
        "signalWords": [
          "Heidi",
          "Geissenpeter",
          "Doktor",
          "Peter"
        ],
        "relatedTheoryIds": [
          "natur-paedagogik",
          "figuren-beziehungen"
        ],
        "prompts": [
          "Wie schafft es Heidi, den Doktor seine Trauer etwas vergessen zu lassen? Interpretieren Sie das Gedicht und dessen religiöses Programm. Wie halten Heidi und der Doktor Geissenpeter bei Laune?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-39",
        "title": "Frage 39",
        "passageLabel": "Leitfrage 39",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 39,
        "context": "Wie nehmen der Doktor und Heidi Abschied? Interpretieren Sie die Emotionen!",
        "signalWords": [
          "Heidi",
          "Doktor"
        ],
        "relatedTheoryIds": [
          "natur-paedagogik",
          "figuren-beziehungen"
        ],
        "prompts": [
          "Wie nehmen der Doktor und Heidi Abschied? Interpretieren Sie die Emotionen!"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-40",
        "title": "Frage 40",
        "passageLabel": "Leitfrage 40",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 40,
        "context": "Inwiefern löst Almöhi im Winter sein Versprechen ein? Wo wohnt er mit Heidi? Wie verläuft Heidis Schulweg? Welchen Eindruck macht das auf Geissenpeter?",
        "signalWords": [
          "Heidi",
          "Almöhi",
          "Geissenpeter",
          "Peter"
        ],
        "relatedTheoryIds": [
          "natur-paedagogik",
          "figuren-beziehungen"
        ],
        "prompts": [
          "Inwiefern löst Almöhi im Winter sein Versprechen ein? Wo wohnt er mit Heidi? Wie verläuft Heidis Schulweg? Welchen Eindruck macht das auf Geissenpeter?"
        ],
        "focusTasks": []
      }
    ]
  },
  {
    "id": "modul-09",
    "title": "Klara auf der Alp",
    "summary": "Klaras Aufenthalt macht Pflege, Behinderung und Fortschritt verhandelbar.",
    "entries": [
      {
        "id": "frage-41",
        "title": "Frage 41",
        "passageLabel": "Leitfrage 41",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 41,
        "context": "Wie bringt Heidi Peter das Lesen bei? Welches pädagogische Konzept verbirgt sich dahinter? Wie wirksam ist diese Methode?",
        "signalWords": [
          "Heidi",
          "Peter"
        ],
        "relatedTheoryIds": [
          "koerper-gesundheit",
          "stadt-land"
        ],
        "prompts": [
          "Wie bringt Heidi Peter das Lesen bei? Welches pädagogische Konzept verbirgt sich dahinter? Wie wirksam ist diese Methode?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-42",
        "title": "Frage 42",
        "passageLabel": "Leitfrage 42",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 42,
        "context": "Interpretieren Sie Klaras Brief an Heidi! Wie soll die Reise geplant werden? Wie soll Klara auf die Alp vorbereitet werden?",
        "signalWords": [
          "Heidi",
          "Klara"
        ],
        "relatedTheoryIds": [
          "koerper-gesundheit",
          "stadt-land"
        ],
        "prompts": [
          "Interpretieren Sie Klaras Brief an Heidi! Wie soll die Reise geplant werden? Wie soll Klara auf die Alp vorbereitet werden?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-43",
        "title": "Frage 43",
        "passageLabel": "Leitfrage 43",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 43,
        "context": "Erklären Sie Geissenpeters unwirsche Reaktion auf die Ankunft der Gäste aus Frankfurt. Inwiefern fühlt er sich von den fremden Gästen bedroht?",
        "signalWords": [
          "Geissenpeter",
          "Frankfurt",
          "Peter"
        ],
        "relatedTheoryIds": [
          "koerper-gesundheit",
          "stadt-land"
        ],
        "prompts": [
          "Erklären Sie Geissenpeters unwirsche Reaktion auf die Ankunft der Gäste aus Frankfurt. Inwiefern fühlt er sich von den fremden Gästen bedroht?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-44",
        "title": "Frage 44",
        "passageLabel": "Leitfrage 44",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 44,
        "context": "Schildern Sie die Ankunft der Sesemanns! Erklären Sie, woher der Almöhi weiss, wie man kranke Menschen pflegt! Was hat dies mit seiner Vergangenheit zu tun? Welche Argumentation schiebt er vor?",
        "signalWords": [
          "Almöhi",
          "Sesemann"
        ],
        "relatedTheoryIds": [
          "koerper-gesundheit",
          "stadt-land"
        ],
        "prompts": [
          "Schildern Sie die Ankunft der Sesemanns! Erklären Sie, woher der Almöhi weiss, wie man kranke Menschen pflegt! Was hat dies mit seiner Vergangenheit zu tun? Welche Argumentation schiebt er vor?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-45",
        "title": "Frage 45",
        "passageLabel": "Leitfrage 45",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 45,
        "context": "Wie reflektiert Klara ihre körperliche Behinderung? Wie kommt es dazu, dass Klara auf der Alp übernachtet? Wie verbringen die beiden Freundinnen die Zeit auf der Alp? Wie kommunizieren sie mit der Grossmutter, die nach Bad Ragaz zurückgekehrt ist? Welche Fortschritte macht Klara?",
        "signalWords": [
          "Grossmutter",
          "Klara"
        ],
        "relatedTheoryIds": [
          "koerper-gesundheit",
          "stadt-land"
        ],
        "prompts": [
          "Wie reflektiert Klara ihre körperliche Behinderung? Wie kommt es dazu, dass Klara auf der Alp übernachtet? Wie verbringen die beiden Freundinnen die Zeit auf der Alp? Wie kommunizieren sie mit der Grossmutter, die nach Bad Ragaz zurückgekehrt ist? Welche Fortschritte macht Klara?"
        ],
        "focusTasks": []
      }
    ]
  },
  {
    "id": "modul-10",
    "title": "Schuld, Wiedergutmachung und Schluss",
    "summary": "Peters Schuld wird gestanden, umgedeutet und sozial beigelegt.",
    "entries": [
      {
        "id": "frage-46",
        "title": "Frage 46",
        "passageLabel": "Leitfrage 46",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 46,
        "context": "Erläutern Sie Peters merkwürdiges Verhalten! Erklären Sie, warum er Klaras Rollstuhl den Berg hinuntergestossen hat!",
        "signalWords": [
          "Klara",
          "Peter"
        ],
        "relatedTheoryIds": [
          "schuld-ordnung",
          "religion"
        ],
        "prompts": [
          "Erläutern Sie Peters merkwürdiges Verhalten! Erklären Sie, warum er Klaras Rollstuhl den Berg hinuntergestossen hat!"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-47",
        "title": "Frage 47",
        "passageLabel": "Leitfrage 47",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 47,
        "context": "Wie lernt Klara in dieser misslichen Situation laufen?",
        "signalWords": [
          "Klara"
        ],
        "relatedTheoryIds": [
          "schuld-ordnung",
          "religion"
        ],
        "prompts": [
          "Wie lernt Klara in dieser misslichen Situation laufen?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-48",
        "title": "Frage 48",
        "passageLabel": "Leitfrage 48",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 48,
        "context": "Wie nehmen die Leute im Dörfli die Zerstörungsaktion wahr? Wie reagiert Peter darauf? Kommentieren Sie die Begegnung von Peter mit Herrn Sesemann?",
        "signalWords": [
          "Sesemann",
          "Peter"
        ],
        "relatedTheoryIds": [
          "schuld-ordnung",
          "religion"
        ],
        "prompts": [
          "Wie nehmen die Leute im Dörfli die Zerstörungsaktion wahr? Wie reagiert Peter darauf? Kommentieren Sie die Begegnung von Peter mit Herrn Sesemann?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-49",
        "title": "Frage 49",
        "passageLabel": "Leitfrage 49",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 49,
        "context": "Wie kommt es zum Geständnis? Wie wird die Sache beigelegt? Wie wird Peters Untat positiv interpretiert?",
        "signalWords": [
          "Peter"
        ],
        "relatedTheoryIds": [
          "schuld-ordnung",
          "religion"
        ],
        "prompts": [
          "Wie kommt es zum Geständnis? Wie wird die Sache beigelegt? Wie wird Peters Untat positiv interpretiert?"
        ],
        "focusTasks": []
      },
      {
        "id": "frage-50",
        "title": "Frage 50",
        "passageLabel": "Leitfrage 50",
        "pageHint": "Volltext im linken Lesefenster",
        "pageNumber": 50,
        "context": "Warum bekommt Peter am Ende noch Geld von Herrn Sesemann? Welche Regelung trifft Sesemann? Warum lehnt Almöhi eine Entschädigung ab? Was will er stattdessen für Heidi? Was wünscht sich Heidi? Kommentieren Sie das Gespräch zwischen den beiden Grossmüttern.",
        "signalWords": [
          "Heidi",
          "Almöhi",
          "Sesemann",
          "Peter"
        ],
        "relatedTheoryIds": [
          "schuld-ordnung",
          "religion"
        ],
        "prompts": [
          "Warum bekommt Peter am Ende noch Geld von Herrn Sesemann? Welche Regelung trifft Sesemann? Warum lehnt Almöhi eine Entschädigung ab? Was will er stattdessen für Heidi? Was wünscht sich Heidi? Kommentieren Sie das Gespräch zwischen den beiden Grossmüttern."
        ],
        "focusTasks": []
      }
    ]
  }
];

export const readerModules = rawReaderModules.map((module) => ({ ...module, entries: module.entries.map((entry) => ({ ...entry, focusTasks: entry.prompts.map((prompt) => buildTask(prompt, { context: entry.context, signalWords: entry.signalWords, relatedTheoryIds: entry.relatedTheoryIds, kind: "focus", taskTitle: entry.title })) })) }));

export const lessonSets = [
  {
    "id": "lektion-01",
    "title": "Ankunft auf der Alp",
    "summary": "Heidi wird vom sozialen Problemfall zur Figur der alpinen Neuordnung.",
    "moduleIds": [
      "modul-01"
    ],
    "entryIds": [
      "frage-01",
      "frage-02",
      "frage-03",
      "frage-04",
      "frage-05"
    ],
    "reviewFocus": "Textnahe Antwort mit Beobachtung, Beleg und Deutung; keine reine Inhaltsnacherzählung.",
    "sebPrompt": "Bearbeite die Leitfragen dieser Lektion präzise am Volltext und nutze mindestens eine Leselinse.",
    "recommendedTheoryIds": [
      "archiv-biografie",
      "spyris-werk-lesarten",
      "natur-paedagogik"
    ],
    "resourceAssignments": [
      {
        "resourceId": "archiv-biografie",
        "title": "Archiv und Biografie: Dete, Herkunft, Vormundschaft",
        "summary": "Das Archivmaterial hilft, Heidis Ausgangslage nicht als Märchenanfang, sondern als soziale Verschiebung zu lesen.",
        "task": "Erkläre, wie Dete im ersten Kapitel zwischen Fürsorge, Eigennutz und sozialem Druck positioniert wird. Belege deine Deutung an der Übergabe Heidis.",
        "questionTasks": [
          "Welche biografische oder historische Information macht Heidis Abgabe verständlicher?",
          "Wie verändert diese Information deinen Blick auf Dete?",
          "Welche Romanformulierung zeigt, dass Heidi zunächst über sie verfügt wird?"
        ],
        "taskGuide": "Eine tragfähige Antwort zeigt Dete nicht einfach als herzlos, sondern als Figur zwischen Erwerbsdruck, Familienpflicht und Abwehr von Verantwortung. Entscheidend ist, dass Heidi als Kind weitergereicht wird, während Erwachsene über ihren Aufenthaltsort entscheiden.",
        "answerGuides": [
          "Wichtig ist die soziale Lage: Dete sucht Arbeit in Frankfurt und gibt die Verantwortung an den Grossvater zurück. Dadurch wird Heidis Abgabe als ökonomisch und familiär bedingte Verschiebung lesbar.",
          "Diese Information verändert den Blick auf Dete, weil sie ambivalent erscheint: eigennützig und rücksichtslos gegenüber Heidi, aber zugleich von Arbeitsdruck und sozialem Aufstiegswunsch geprägt.",
          "Als Romanformulierung ist aussagekräftig, dass Dete sagt, das Kind müsse beim Grossvater bleiben. Diese Formulierung zeigt, dass über Heidi verfügt wird: Sie entscheidet nicht selbst, sondern wird als Zuständigkeit zwischen Erwachsenen verschoben."
        ]
      },
      {
        "resourceId": "spyris-werk-lesarten",
        "title": "Spyri und Heidi: Biografische Projektion vorsichtig prüfen",
        "summary": "Das Forschungsdossier macht deutlich, dass Heidi biografische Spuren aufnehmen kann, aber nicht einfach mit Johanna Spyri gleichgesetzt werden darf.",
        "task": "Prüfe den Anfang des Romans als Wechselspiel zwischen Autorinbiografie und literarischer Figur: Wo wirkt Heidi wie eine biografische Spur, wo ist sie klar erzählerisch gebaut?",
        "questionTasks": [
          "Welche Information aus dem Dossier verhindert eine einfache Gleichung Johanna gleich Heidi?",
          "Welche Eigenschaft Heidis könnte trotzdem auf Spyris Selbst- oder Wunschbild verweisen?",
          "Welche Textstelle zeigt, dass Heidi zuerst als literarische Figur und nicht als Privatperson funktioniert?"
        ],
        "taskGuide": "Eine sorgfältige Antwort hält zwei Bewegungen auseinander: Das Dossier erlaubt biografische Bezüge zu Vitalität, Heimweh und weiblicher Lebensbegrenzung, aber der Roman formt Heidi als offene Kinderfigur, die mehr ist als ein verschlüsseltes Selbstporträt.",
        "answerGuides": [
          "Das Dossier betont die unsichere Archivlage und die Gefahr biografischer Kurzschlüsse. Heidi kann Spuren von Spyri aufnehmen, bleibt aber eine literarisch gestaltete Figur.",
          "Heidis Vitalität, Naturbindung und Heimweh können als Wunsch- oder Erinnerungsfigur Spyris gelesen werden. Wichtig ist, diese Deutung als Möglichkeit und nicht als Beweis zu formulieren.",
          "Schon der Anfang mit Aufstieg, Kleidung, Dete und Dorfgerede baut Heidi als soziale und erzählerische Figur. Sie wird in Konflikte hineingestellt, die über private Biografie hinausgehen."
        ]
      },
      {
        "resourceId": "natur-paedagogik",
        "title": "Naturpädagogik: Ankunft auf der Alp",
        "summary": "Das Naturdossier zeigt, dass die Alp von Beginn an ein Erfahrungsraum ist, der Heidis Wahrnehmung und Verhalten verändert.",
        "task": "Untersuche Heidis erste Reaktion auf die Alp: Welche Naturdetails wirken nicht nur dekorativ, sondern eröffnen eine neue Lebensform?",
        "questionTasks": [
          "Welche Sinneseindrücke prägen Heidis Ankunft?",
          "Wie unterscheidet sich die Alp vom sozialen Druck im Tal?",
          "Welche konkrete Textstelle zeigt Heidis körperliche oder seelische Entlastung?"
        ],
        "taskGuide": "Die Antwort sollte zeigen, dass die Alp nicht Kulisse ist. Luft, Licht, Weite, Tiere und Bewegung eröffnen Heidi einen Erfahrungsraum, der dem Gerede und der sozialen Kontrolle im Tal entgegengesetzt ist.",
        "answerGuides": [
          "Heidis Ankunft wird durch Sinneseindrücke wie Wärme, Duft, Licht, Höhe, Bewegung und den Kontakt zu den Geissen geprägt. Diese Eindrücke machen die Alp körperlich erfahrbar.",
          "Die Alp unterscheidet sich vom sozialen Druck im Tal, weil Heidi dort nicht nur besprochen und verschoben wird. Auf der Alp kann sie schauen, laufen und reagieren; der Raum gibt ihr Handlungsspielraum zurück.",
          "Eine konkrete Textstelle zur körperlichen oder seelischen Entlastung kann zeigen, wie Heidi sich von Kleidern befreit, mit Peter und den Geissen geht oder auf die Höhe reagiert. Entscheidend ist die Verbindung von Körperentlastung und neuer Freiheit."
        ]
      }
    ]
  },
  {
    "id": "lektion-02",
    "title": "Grossvater, Peter und Natur",
    "summary": "Natur, Tiere und Schule zeigen konkurrierende Erziehungsmodelle.",
    "moduleIds": [
      "modul-02"
    ],
    "entryIds": [
      "frage-06",
      "frage-07",
      "frage-08",
      "frage-09",
      "frage-10"
    ],
    "reviewFocus": "Textnahe Antwort mit Beobachtung, Beleg und Deutung; keine reine Inhaltsnacherzählung.",
    "sebPrompt": "Bearbeite die Leitfragen dieser Lektion präzise am Volltext und nutze mindestens eine Leselinse.",
    "recommendedTheoryIds": [
      "natur-paedagogik",
      "figuren-beziehungen"
    ],
    "resourceAssignments": [
      {
        "resourceId": "natur-paedagogik",
        "title": "Naturpädagogik: Lernen mit Tieren und Gelände",
        "summary": "Das Material macht sichtbar, dass Lernen auf der Alp über Beobachtung, Bewegung, Verantwortung und Grenzen geschieht.",
        "task": "Vergleiche Peters Umgang mit den Geissen mit Heidis Blick auf Tiere und Landschaft. Zeige, welches Erziehungsmodell daraus entsteht.",
        "questionTasks": [
          "Welche Regeln lernt Heidi nicht aus einem Buch, sondern aus der Situation?",
          "Wie korrigiert Heidi Peters Verhalten gegenüber den Tieren?",
          "Was leistet die Natur in dieser Lektion pädagogisch?"
        ],
        "taskGuide": "Eine gute Antwort arbeitet heraus, dass Lernen hier praktisch, situativ und körpernah geschieht. Heidi lernt an Gelände, Tieren und Beziehungen; zugleich wirkt sie selbst erzieherisch auf Peter ein.",
        "answerGuides": [
          "Heidi lernt Rücksicht auf Tiere, Orientierung im Gelände, gemeinsames Essen und Grenzen im Umgang mit Gefahr. Diese Regeln entstehen aus Erfahrung, nicht aus Unterricht.",
          "Heidi korrigiert Peters Verhalten gegenüber den Tieren, indem sie widerspricht, wenn er grob mit den Geissen umgeht. Weil sie die Tiere als empfindsame Wesen wahrnimmt, begrenzt sie seine Härte.",
          "Die Natur stiftet Erfahrungen, fordert Verantwortung und macht Folgen unmittelbar sichtbar. Sie ist deshalb ein pädagogischer Raum, nicht bloss eine schöne Umgebung."
        ]
      },
      {
        "resourceId": "figuren-beziehungen",
        "title": "Figurenbeziehungen: Grossvater, Peter, Heidi",
        "summary": "Die Beziehungskonstellation zeigt, wie Heidi zwischen dem verschlossenen Grossvater und dem eigensinnigen Peter vermittelt.",
        "task": "Beschreibe, wie Heidi Beziehungen stiftet, ohne sie bewusst zu planen. Arbeite mit je einem Textsignal zu Grossvater und Peter.",
        "questionTasks": [
          "Wie verändert Heidi die Atmosphäre beim Grossvater?",
          "Worin bleibt Peter eigenständig oder widerständig?",
          "Welche Rolle spielt Heidis Direktheit im Umgang mit beiden?"
        ],
        "taskGuide": "Die Antwort sollte Heidi als Beziehungskraft beschreiben: Sie plant keine Erziehung, verändert aber durch Vertrauen, Neugier und Direktheit die sozialen Abstände zwischen den Figuren.",
        "answerGuides": [
          "Beim Grossvater löst Heidi Verschlossenheit, Misstrauen und Härte teilweise auf. Ihre Unbefangenheit ermöglicht Nähe, ohne dass der Grossvater sofort grundsätzlich verändert wäre.",
          "Peter bleibt eigenständig, weil er seine Gewohnheiten, Eifersucht und grobe Direktheit behält. Heidi überformt ihn nicht vollständig.",
          "Heidis Direktheit vermeidet taktisches Verhalten. Gerade weil sie offen fragt, vertraut und widerspricht, geraten Grossvater und Peter in Bewegung."
        ]
      }
    ]
  },
  {
    "id": "lektion-03",
    "title": "Grossmutter, Pfarrer und Weggang",
    "summary": "Religion, Fürsorge und sozialer Druck treiben den Ortswechsel an.",
    "moduleIds": [
      "modul-03"
    ],
    "entryIds": [
      "frage-11",
      "frage-12",
      "frage-13",
      "frage-14",
      "frage-15"
    ],
    "reviewFocus": "Textnahe Antwort mit Beobachtung, Beleg und Deutung; keine reine Inhaltsnacherzählung.",
    "sebPrompt": "Bearbeite die Leitfragen dieser Lektion präzise am Volltext und nutze mindestens eine Leselinse.",
    "recommendedTheoryIds": [
      "religion",
      "archiv-biografie"
    ],
    "resourceAssignments": [
      {
        "resourceId": "religion",
        "title": "Religion und Fürsorge: Grossmutter und Pfarrer",
        "summary": "Das Religionsdossier hilft zu unterscheiden, wo der Roman Trost, Pflicht, Schuld und Gottvertrauen miteinander verbindet.",
        "task": "Untersuche, wie religiöse Sprache im Umfeld der Grossmutter wirkt: Tröstet sie, ordnet sie, fordert sie oder setzt sie unter Druck?",
        "questionTasks": [
          "Welche religiösen Wörter oder Motive fallen in der Szene auf?",
          "Wie reagiert Heidi auf die Grossmutter?",
          "Wo wird Religion zur sozialen Erwartung an den Grossvater?"
        ],
        "taskGuide": "Die Antwort sollte Religion doppelt lesen: als Trost und als soziale Norm. Bei der Grossmutter wirkt sie fürsorglich, beim Grossvater wird sie auch zur Forderung nach Rückkehr in die Gemeinschaft.",
        "answerGuides": [
          "Als religiöse Wörter oder Motive fallen Gottvertrauen, Gebet, Trost, Sünde, Busse oder kirchliche Gemeinschaft auf. Sie verbinden private Not mit moralischer Ordnung.",
          "Heidi reagiert aufmerksam und mitleidig. Sie nimmt die Bedürftigkeit der Grossmutter ernst und verbindet Zuhören mit konkreter Fürsorge.",
          "Beim Grossvater erscheint Religion dort als Erwartung, wo Pfarrer, Dorf oder Grossmutter seine Rückkehr, Versöhnung oder Verantwortung einfordern."
        ]
      },
      {
        "resourceId": "archiv-biografie",
        "title": "Archiv und Biografie: Weggeben, Behalten, Verantworten",
        "summary": "Das Archivmaterial öffnet den Blick auf Familienordnung, Vormundschaft und die Frage, wer für ein Kind zuständig ist.",
        "task": "Zeige, wie der Roman Heidis Weggang vorbereitet: Welche Interessen, Pflichten und Ausweichbewegungen treffen aufeinander?",
        "questionTasks": [
          "Welche Verantwortung wird an wen abgegeben?",
          "Wie begründet Dete ihr Handeln?",
          "Welche Textstelle macht sichtbar, dass Heidi selbst kaum gefragt wird?"
        ],
        "taskGuide": "Eine präzise Antwort zeigt, wie der Roman Zuständigkeit verhandelt: Dete gibt Verantwortung ab, der Grossvater soll sie übernehmen, und Heidi bleibt in dieser Ordnung zunächst Objekt der Entscheidung.",
        "answerGuides": [
          "Die Verantwortung wird von Dete an den Grossvater abgegeben; zugleich verweist Dete auf dessen Verwandtschaftspflicht. Die Sorge um Heidi wird dadurch als Last weitergereicht.",
          "Dete begründet ihr Handeln mit der Arbeitsmöglichkeit in Frankfurt und damit, dass der Grossvater nun seinen Teil tun müsse. Das klingt praktisch, aber auch abwehrend.",
          "Geeignet sind Formulierungen, in denen Dete sagt, Heidi müsse dort bleiben, oder in denen Erwachsene über sie sprechen, während Heidi selbst kaum zu Wort kommt."
        ]
      }
    ]
  },
  {
    "id": "lektion-04",
    "title": "Frankfurt als Gegenwelt",
    "summary": "Frankfurt macht Hausordnung, Stand und Fremdheit sichtbar.",
    "moduleIds": [
      "modul-04"
    ],
    "entryIds": [
      "frage-16",
      "frage-17",
      "frage-18",
      "frage-19",
      "frage-20"
    ],
    "reviewFocus": "Textnahe Antwort mit Beobachtung, Beleg und Deutung; keine reine Inhaltsnacherzählung.",
    "sebPrompt": "Bearbeite die Leitfragen dieser Lektion präzise am Volltext und nutze mindestens eine Leselinse.",
    "recommendedTheoryIds": [
      "stadt-land",
      "spyris-werk-lesarten",
      "koerper-gesundheit"
    ],
    "resourceAssignments": [
      {
        "resourceId": "stadt-land",
        "title": "Stadt und Land: Frankfurt als Gegenwelt",
        "summary": "Das Stadt-Land-Dossier zeigt Frankfurt nicht nur als Ort, sondern als Ordnungssystem aus Räumen, Regeln und Blicken.",
        "task": "Analysiere, wie Frankfurt Heidis Bewegungen und Sprache verändert. Arbeite mit einem Raumdetail und einer Verhaltensregel.",
        "questionTasks": [
          "Welche Regel wirkt für Heidi besonders fremd?",
          "Wie wird der Innenraum im Vergleich zur Alp beschrieben?",
          "Welche Wirkung hat Frau Rottenmeiers Ordnung auf Heidi?"
        ],
        "taskGuide": "Die Antwort sollte Frankfurt als Gegenraum zur Alp beschreiben: Enge, Hausordnung, Aufsicht und soziale Etikette begrenzen Heidis Bewegung und verändern ihre Sprache und ihr Verhalten.",
        "answerGuides": [
          "Besonders fremd wirken Regeln zu Sitzen, Sprechen, Essen, Lernen oder Gehorsam. Entscheidend ist, dass Heidi diese Regeln nicht aus ihrer bisherigen Erfahrung ableiten kann.",
          "Der Innenraum in Frankfurt wird im Vergleich zur Alp als geschlossen, kontrolliert und sozial codiert erfahrbar. Die Alp erscheint dagegen weit, beweglich und sinnlich; der Kontrast ist räumlich und pädagogisch.",
          "Frau Rottenmeiers Ordnung beschämt und diszipliniert Heidi. Sie macht aus Heidis Lebendigkeit ein Problem und verstärkt ihre Fremdheit."
        ]
      },
      {
        "resourceId": "spyris-werk-lesarten",
        "title": "Gesellschaft und Politik: Zürichs Ordnung im Spiegel Frankfurts",
        "summary": "Der SIKJM-Band zeigt Spyris Umfeld als politisch und gesellschaftlich konfliktgeladen; Frankfurt kann deshalb als literarischer Raum von Macht, Anpassung und Normierung gelesen werden.",
        "task": "Vergleiche die Frankfurter Hausordnung mit den gesellschaftlichen Ordnungsfragen aus dem Dossier: Wie zeigt der Roman Macht, Anpassung und Ausschluss, ohne offen politisch zu argumentieren?",
        "questionTasks": [
          "Welche politische oder gesellschaftliche Spannung aus dem Dossier passt als Hintergrund zur Frankfurter Ordnung?",
          "Wie wird Heidi in Frankfurt zur Aussenseiterin eines Regel- und Standessystems?",
          "Warum ist es wichtig, Politik hier indirekt und nicht als platte Allegorie zu lesen?"
        ],
        "taskGuide": "Eine gute Antwort verbindet Frankfurts Hausordnung mit dem Dossier zu Zürich, Liberalismus, konservativem Milieu und weiblicher Öffentlichkeit. Sie behauptet nicht, Frankfurt sei einfach Zürich, sondern zeigt, wie der Roman gesellschaftliche Macht in Alltag, Räumen und Benimmregeln übersetzt.",
        "answerGuides": [
          "Passend sind die Spannungen zwischen politischer Macht, gesellschaftlicher Zugehörigkeit, Anpassungsdruck und weiblicher Zurückhaltung. Das Dossier zeigt, dass Spyri solche Konflikte kannte, auch wenn sie nicht offen politisch schrieb.",
          "Heidi wird zur Aussenseiterin, weil sie die Codes von Stand, Bildung, Dienstbotenordnung und städtischem Benehmen nicht beherrscht. Ihre Fremdheit macht das System sichtbar.",
          "Politik darf hier nicht als Eins-zu-eins-Schlüssel gelesen werden. Überzeugend ist eine indirekte Deutung: Der Roman verwandelt gesellschaftliche Konflikte in Szenen von Raum, Sprache und Erziehung."
        ]
      },
      {
        "resourceId": "koerper-gesundheit",
        "title": "Körper und Gesundheit: Eingesperrte Bewegung",
        "summary": "Das Gesundheitsmaterial macht sichtbar, dass Heidis Anpassungsprobleme körperlich lesbar werden.",
        "task": "Erkläre, wie der Roman Heidis Körper als Reaktionsfläche auf die Frankfurter Ordnung nutzt.",
        "questionTasks": [
          "Welche körperlichen Signale zeigen Heidis Unbehagen?",
          "Wie hängt Heidis Gesundheit mit Raum und Bewegung zusammen?",
          "Warum ist Krankheit hier mehr als ein medizinisches Problem?"
        ],
        "taskGuide": "Eine gute Antwort erklärt Heidis Körper als Anzeige eines unpassenden Lebensraums. Krankheit ist im Roman nicht nur medizinisch, sondern Ausdruck von Heimweh, Enge und Beziehungslosigkeit.",
        "answerGuides": [
          "Signale sind Müdigkeit, Schlafwandeln, Appetitlosigkeit, Traurigkeit, Unruhe oder körperliche Schwäche. Sie zeigen, dass Heidi sich nicht einfach anpasst.",
          "Heidis Gesundheit hängt an Bewegung, Luft, Natur und vertrauten Beziehungen. Wenn diese fehlen, wird ihr Körper zum Ort der Störung.",
          "Krankheit ist hier mehr als ein medizinisches Problem, weil sie auf eine falsche soziale und räumliche Ordnung verweist. Der medizinische Befund führt deshalb zu einer Lebensentscheidung: Heidi muss zurück auf die Alp."
        ]
      }
    ]
  },
  {
    "id": "lektion-05",
    "title": "Katzen, Unterricht und Missverstehen",
    "summary": "Komik und Konflikt zeigen, wie sehr Heidi missverstanden wird.",
    "moduleIds": [
      "modul-05"
    ],
    "entryIds": [
      "frage-21",
      "frage-22",
      "frage-23",
      "frage-24",
      "frage-25"
    ],
    "reviewFocus": "Textnahe Antwort mit Beobachtung, Beleg und Deutung; keine reine Inhaltsnacherzählung.",
    "sebPrompt": "Bearbeite die Leitfragen dieser Lektion präzise am Volltext und nutze mindestens eine Leselinse.",
    "recommendedTheoryIds": [
      "stadt-land",
      "sprache-erzaehlen"
    ],
    "resourceAssignments": [
      {
        "resourceId": "stadt-land",
        "title": "Stadt und Land: Missverständnisse in Frankfurt",
        "summary": "Das Stadt-Land-Material hilft, die komischen Szenen als Zusammenstoss verschiedener Lebensordnungen zu lesen.",
        "task": "Deute eine komische Szene nicht nur als lustigen Zwischenfall, sondern als Hinweis auf unvereinbare Regeln.",
        "questionTasks": [
          "Welche Regel versteht Heidi anders als die Erwachsenen?",
          "Wie wird Komik aus räumlicher oder sozialer Fremdheit erzeugt?",
          "Was verrät die Szene über Frankfurts Erziehungsideal?"
        ],
        "taskGuide": "Die Antwort sollte eine komische Szene als Regelkonflikt deuten. Der Witz entsteht nicht zufällig, sondern aus Heidis wörtlichem, alpinem oder kindlichem Verständnis einer städtischen Ordnung.",
        "answerGuides": [
          "Heidi versteht Anrede, Benehmen, Besitz, Essen oder Dienstbotenregeln anders als die Erwachsenen. Gerade diese Verschiebung erzeugt den Konflikt.",
          "Komik entsteht aus räumlicher und sozialer Fremdheit, weil Heidi die Codes des Hauses nicht kennt und Räume oder Gegenstände anders nutzt, als Frankfurt es erwartet.",
          "Frankfurt erscheint als Erziehungsideal der Kontrolle, Höflichkeit und Hierarchie. Die komische Szene macht dieses Ideal zugleich sichtbar und fragwürdig."
        ]
      },
      {
        "resourceId": "sprache-erzaehlen",
        "title": "Sprache und Erzählen: Komik des Missverstehens",
        "summary": "Das Sprachmaterial lenkt den Blick auf Dialogführung, Benennungen und die Erzählweise komischer Eskalationen.",
        "task": "Untersuche, wie Sprache Missverständnisse produziert oder verschärft. Belege deine Antwort an einem Dialogmoment.",
        "questionTasks": [
          "Welche Wörter oder Anreden markieren soziale Distanz?",
          "Wie reagiert die Erzählstimme auf Heidis Missverstehen?",
          "Wo kippt Komik in Kritik an der Umgebung?"
        ],
        "taskGuide": "Eine starke Antwort arbeitet am Wortlaut: Namen, Anreden und Dialoge zeigen, wer Macht besitzt. Heidis Missverstehen ist komisch, legt aber zugleich die Künstlichkeit der Frankfurter Ordnung frei.",
        "answerGuides": [
          "Anreden wie Fräulein, Herr, Dienerrollen oder formelle Namen markieren Abstand. Auch Korrekturen an Heidis Sprache können soziale Distanz zeigen.",
          "Die Erzählstimme lässt Heidis Missverstehen oft verständlich wirken und entlarvt dadurch eher die Umgebung als das Kind. Der Humor bleibt nicht neutral.",
          "Komik kippt in Kritik, wenn Heidis Fehler die Starrheit, Kälte oder Unverhältnismässigkeit der Hausordnung sichtbar machen."
        ]
      }
    ]
  },
  {
    "id": "lektion-06",
    "title": "Heimweh, Spuk und Heimkehr",
    "summary": "Heimweh wird körperlich, räumlich und medizinisch lesbar.",
    "moduleIds": [
      "modul-06"
    ],
    "entryIds": [
      "frage-26",
      "frage-27",
      "frage-28",
      "frage-29",
      "frage-30"
    ],
    "reviewFocus": "Textnahe Antwort mit Beobachtung, Beleg und Deutung; keine reine Inhaltsnacherzählung.",
    "sebPrompt": "Bearbeite die Leitfragen dieser Lektion präzise am Volltext und nutze mindestens eine Leselinse.",
    "recommendedTheoryIds": [
      "stadt-land",
      "spyris-werk-lesarten",
      "koerper-gesundheit"
    ],
    "resourceAssignments": [
      {
        "resourceId": "stadt-land",
        "title": "Stadt und Land: Heimweh als Raumkonflikt",
        "summary": "Das Material zeigt Heimweh als Folge räumlicher Entwurzelung und nicht als blosse Laune.",
        "task": "Zeige, wie der Roman Heidis Heimweh über Fenster, Wege, Zimmer und Erinnerungen erzählt.",
        "questionTasks": [
          "Welche Raumdetails machen Heidis Heimweh sichtbar?",
          "Wie unterscheidet sich Heidis Sehnsucht von blosser Unzufriedenheit?",
          "Welche Textstelle verbindet Frankfurt direkt mit der Alp?"
        ],
        "taskGuide": "Die Antwort sollte Heimweh als Raumkonflikt deuten: Fenster, Zimmer, geschlossene Wege und Erinnerungsbilder zeigen, dass Heidi nicht nur etwas vermisst, sondern aus ihrem Lebensraum herausgelöst ist.",
        "answerGuides": [
          "Fenster, Treppen, Zimmer, geschlossene Türen oder fehlende Aussicht können Heidis Heimweh sichtbar machen. Räume wirken wie Hindernisse.",
          "Heidis Sehnsucht ist tiefer als schlechte Laune: Sie betrifft Körper, Schlaf, Sprache und Lebensvertrauen. Sie verliert einen Teil ihrer selbst.",
          "Eine Textstelle verbindet Frankfurt direkt mit der Alp, wenn Heidi nach Bergen, Himmel, Geissen, Grossvater oder dem Dörfli fragt oder Frankfurt mit fehlender Aussicht kontrastiert wird."
        ]
      },
      {
        "resourceId": "spyris-werk-lesarten",
        "title": "Heimweh und Frauenbiografie: Heidi als innere Gegenfigur",
        "summary": "Das Dossier legt nahe, Heimweh nicht nur als Kindermotiv, sondern auch als Spur weiblicher Lebensbegrenzung, Sehnsucht und Selbstentwurf zu lesen.",
        "task": "Deute Heidis Heimweh als Schnittstelle zwischen Romanhandlung und Spyris Frauenbiografie: Welche Sehnsucht wird körperlich erzählt, ohne autobiografisch bewiesen werden zu müssen?",
        "questionTasks": [
          "Welche Verbindung zwischen Heidis Heimweh und Spyris Lebenssituation stellt das Dossier als Deutungsmöglichkeit bereit?",
          "Wie zeigt der Roman Heimweh körperlich statt nur psychologisch?",
          "Warum bleibt diese biografische Deutung trotz starker Hinweise vorsichtig?"
        ],
        "taskGuide": "Die Antwort sollte Heimweh als literarische Form innerer Unfreiheit lesen: Heidi reagiert körperlich auf falsche Räume. Das Dossier erlaubt, diese Figur mit Spyris weiblicher Lebens- und Schreibsituation zu verbinden, ohne daraus eine direkte Autobiografie zu machen.",
        "answerGuides": [
          "Das Dossier verbindet Heidi mit Vitalität, Übersensibilität und Heimweh als möglichen biografischen Spuren. Diese Spuren können Spyris Wunsch nach Natur, Bewegung und Entlastung spiegeln.",
          "Heimweh erscheint im Schlafwandeln, in Schwäche, Traurigkeit, Blicken aus dem Fenster und körperlicher Unruhe. Der Körper sagt, was Heidi in Frankfurt nicht angemessen aussprechen kann.",
          "Diese biografische Deutung bleibt trotz starker Hinweise vorsichtig, weil keine Stelle beweist, dass Spyri sich selbst direkt erzählt. Tragfähig wird sie erst, wenn sie am Romantext zeigt, wie Biografie in literarische Form verwandelt wird."
        ]
      },
      {
        "resourceId": "koerper-gesundheit",
        "title": "Körper und Gesundheit: Spuk, Schlaf, Diagnose",
        "summary": "Das Gesundheitsmaterial macht verständlich, warum der Spuk medizinisch, psychisch und sozial gelesen werden kann.",
        "task": "Deute die Spukepisode als Körpersprache: Was kann Heidi nicht sagen, was ihr Körper aber sichtbar macht?",
        "questionTasks": [
          "Welche Symptome werden beobachtet?",
          "Wie deutet der Doktor Heidis Zustand?",
          "Warum führt die Diagnose zur Heimkehr statt zu strengerer Erziehung?"
        ],
        "taskGuide": "Die Antwort sollte die Spukepisode als verdichtetes Zeichen lesen: Was als Geistererscheinung beginnt, wird zur Diagnose von Heimweh, Überforderung und falscher Umgebung.",
        "answerGuides": [
          "Als Symptome werden Schlafwandeln, nächtliches Umhergehen, Blässe, Unruhe oder Schwäche beobachtet. Das scheinbar Unheimliche hat körperliche Zeichen.",
          "Der Doktor deutet Heidis Zustand als Heimweh und seelische Belastung, nicht als Ungehorsam. Damit verschiebt er die Bewertung der Symptome.",
          "Die Diagnose führt zur Heimkehr statt zu strengerer Erziehung, weil mehr Disziplin Heidis Problem verschärfen würde. Heilung bedeutet Rückkehr in den passenden Lebensraum."
        ]
      }
    ]
  },
  {
    "id": "lektion-07",
    "title": "Der Doktor und das gelernte Heidi",
    "summary": "Heidi wendet Gelerntes auf Trauer, Trost und Beziehung an.",
    "moduleIds": [
      "modul-07"
    ],
    "entryIds": [
      "frage-31",
      "frage-32",
      "frage-33",
      "frage-34",
      "frage-35"
    ],
    "reviewFocus": "Textnahe Antwort mit Beobachtung, Beleg und Deutung; keine reine Inhaltsnacherzählung.",
    "sebPrompt": "Bearbeite die Leitfragen dieser Lektion präzise am Volltext und nutze mindestens eine Leselinse.",
    "recommendedTheoryIds": [
      "religion",
      "koerper-gesundheit"
    ],
    "resourceAssignments": [
      {
        "resourceId": "religion",
        "title": "Religion und Trost: Gelerntes anwenden",
        "summary": "Das Religionsdossier zeigt, wie Heidi religiöse Sprache nicht nur übernimmt, sondern im Umgang mit Trauer praktisch einsetzt.",
        "task": "Untersuche, wie Heidi Trost spendet: Wiederholt sie Gelerntes oder verändert sie es durch ihre Beziehung zum Doktor?",
        "questionTasks": [
          "Welche religiöse Vorstellung gibt Heidi weiter?",
          "Warum wirkt ihre Rede auf den Doktor anders als eine Unterrichtsantwort?",
          "Welche Grenze hat diese Form von Trost?"
        ],
        "taskGuide": "Eine gute Antwort zeigt, dass Heidi religiöse Sprache in Beziehung übersetzt. Sie wiederholt nicht bloss Gelerntes, sondern spricht aus eigener Erfahrung von Verlust, Hoffnung und Vertrauen.",
        "answerGuides": [
          "Heidi gibt die Vorstellung weiter, dass Vertrauen, Gebet oder göttliche Führung auch in Trauer tragen können. Entscheidend ist der Bezug zur konkreten Not des Doktors.",
          "Ihre Rede wirkt anders, weil sie nicht prüfungsartig spricht, sondern persönlich Anteil nimmt. Der Doktor hört eine Beziehungsgeste, keine Lektion.",
          "Die Grenze liegt darin, dass religiöser Trost Verlust nicht aufhebt. Er kann deuten und begleiten, aber die Trauer des Doktors nicht einfach beseitigen."
        ]
      },
      {
        "resourceId": "koerper-gesundheit",
        "title": "Körper und Gesundheit: Trauer, Müdigkeit, Genesung",
        "summary": "Das Gesundheitsmaterial hilft, seelische Belastung und körperliche Zeichen zusammenzulesen.",
        "task": "Vergleiche Heidis frühere Krankheit mit der Trauer des Doktors: Wie verbindet der Roman Körper, Verlust und Heilung?",
        "questionTasks": [
          "Welche Zeichen von Erschöpfung oder Trauer werden sichtbar?",
          "Wie reagiert Heidi auf den leidenden Erwachsenen?",
          "Welche Rolle spielt die Alp als möglicher Heilraum?"
        ],
        "taskGuide": "Die Antwort sollte Heidis Krankheit und die Trauer des Doktors parallel lesen: Beide Zustände werden körperlich sichtbar, beide brauchen Beziehung und einen Raum, der nicht nur verwaltet, sondern heilt.",
        "answerGuides": [
          "Sichtbar werden Müdigkeit, Rückzug, Niedergeschlagenheit, körperliche Schwäche oder fehlende Lebensfreude. Trauer erscheint nicht nur innerlich.",
          "Heidi reagiert mit Nähe, Aufmerksamkeit und Sprache. Sie sieht den Doktor nicht als Autorität, sondern als trauernden Menschen.",
          "Die Alp spielt als möglicher Heilraum eine Rolle, weil sie Bewegung, Luft, Beziehung und Einfachheit verbindet. Sie ersetzt Medizin nicht vollständig, erweitert aber den Heilungsbegriff."
        ]
      }
    ]
  },
  {
    "id": "lektion-08",
    "title": "Schule, Peter und Klaras Reise",
    "summary": "Lesenlernen und Besuchsplanung verbinden Pädagogik mit Eifersucht.",
    "moduleIds": [
      "modul-08"
    ],
    "entryIds": [
      "frage-36",
      "frage-37",
      "frage-38",
      "frage-39",
      "frage-40"
    ],
    "reviewFocus": "Textnahe Antwort mit Beobachtung, Beleg und Deutung; keine reine Inhaltsnacherzählung.",
    "sebPrompt": "Bearbeite die Leitfragen dieser Lektion präzise am Volltext und nutze mindestens eine Leselinse.",
    "recommendedTheoryIds": [
      "natur-paedagogik",
      "figuren-beziehungen"
    ],
    "resourceAssignments": [
      {
        "resourceId": "natur-paedagogik",
        "title": "Naturpädagogik: Lesenlernen und Erfahrungslernen",
        "summary": "Das Material hilft, schulisches Lernen und Lernen durch Erfahrung nicht gegeneinander auszuspielen, sondern zu vergleichen.",
        "task": "Erkläre, wie Lesenlernen, Naturerfahrung und soziale Verantwortung in dieser Lektion zusammenkommen.",
        "questionTasks": [
          "Was kann Schule leisten, was die Alp nicht leistet?",
          "Was lernt Heidi ausserhalb der Schule weiterhin besser?",
          "Wie verändert Bildung die Beziehungen zwischen Heidi, Peter und Klara?"
        ],
        "taskGuide": "Die Antwort sollte Schule und Alp nicht gegeneinander ausspielen. Lesenlernen erweitert Heidis Handlungsmöglichkeiten; Erfahrungslernen bleibt aber für Beziehung, Naturwahrnehmung und Verantwortung zentral.",
        "answerGuides": [
          "Schule kann Lesen, Schrift, religiöse Texte und Zugang zu fremden Lebenswelten leisten; das leistet die Alp nicht in gleicher Weise. Sie gibt Heidi Ausdrucksmöglichkeiten, die Natur allein nicht bietet.",
          "Ausserhalb der Schule lernt Heidi weiterhin Beziehung, Fürsorge, Tierverhalten, Gelände und situatives Handeln besser. Dieses Wissen ist körperlich und praktisch.",
          "Bildung verändert Beziehungen, weil Heidi lesen, trösten, vermitteln und Klara oder Peter anders begegnen kann. Zugleich entstehen neue Ungleichheiten und Eifersucht."
        ]
      },
      {
        "resourceId": "figuren-beziehungen",
        "title": "Figurenbeziehungen: Freundschaft, Eifersucht, Besuch",
        "summary": "Die Figurenkonstellation zeigt, wie Klaras Reise Peters Stellung bedroht und Heidis Beziehungen erweitert.",
        "task": "Untersuche Peters Eifersucht nicht als blosse Bosheit, sondern als Reaktion auf veränderte Näheverhältnisse.",
        "questionTasks": [
          "Wodurch fühlt Peter sich zurückgesetzt?",
          "Wie verhält sich Heidi zwischen Peter und Klara?",
          "Welche Beziehung wird durch die geplante Reise gestärkt oder gefährdet?"
        ],
        "taskGuide": "Eine starke Antwort nimmt Peters Eifersucht ernst, ohne sie zu entschuldigen. Klara erweitert Heidis Welt; Peter erlebt diese Erweiterung als Verlust von Nähe und Exklusivität.",
        "answerGuides": [
          "Peter fühlt sich zurückgesetzt, weil Heidi Aufmerksamkeit, Zeit und Zuneigung mit Klara teilt. Auch soziale Unterschiede zwischen ihm und den Frankfurter Gästen spielen mit.",
          "Heidi versucht nicht strategisch zu vermitteln, sondern bleibt beiden zugewandt. Gerade diese Offenheit kann Peters Unsicherheit aber verstärken.",
          "Die Reise stärkt Heidis und Klaras Freundschaft, gefährdet aber Peters vertraute Stellung. Die Beziehungskonstellation wird dadurch instabiler."
        ]
      }
    ]
  },
  {
    "id": "lektion-09",
    "title": "Klara auf der Alp",
    "summary": "Klaras Aufenthalt macht Pflege, Behinderung und Fortschritt verhandelbar.",
    "moduleIds": [
      "modul-09"
    ],
    "entryIds": [
      "frage-41",
      "frage-42",
      "frage-43",
      "frage-44",
      "frage-45"
    ],
    "reviewFocus": "Textnahe Antwort mit Beobachtung, Beleg und Deutung; keine reine Inhaltsnacherzählung.",
    "sebPrompt": "Bearbeite die Leitfragen dieser Lektion präzise am Volltext und nutze mindestens eine Leselinse.",
    "recommendedTheoryIds": [
      "koerper-gesundheit",
      "film-alptraum",
      "ki-trailer"
    ],
    "resourceAssignments": [
      {
        "resourceId": "koerper-gesundheit",
        "title": "Körper und Gesundheit: Pflege, Bewegung, Behinderung",
        "summary": "Das Gesundheitsmaterial hilft, Klaras Aufenthalt nicht als Wunder, sondern als Zusammenspiel von Pflege, Umgebung und Beziehung zu untersuchen.",
        "task": "Analysiere Klaras Veränderung auf der Alp: Welche körperlichen, räumlichen und sozialen Bedingungen werden dafür aufgebaut?",
        "questionTasks": [
          "Welche Pflegehandlungen werden konkret gezeigt?",
          "Wie verändert die Alp Klaras Bewegungsmöglichkeiten?",
          "Wo bleibt die Darstellung problematisch oder idealisierend?"
        ],
        "taskGuide": "Die Antwort sollte Klaras Veränderung nicht als blosses Wunder lesen. Der Roman baut Bedingungen auf: Pflege, Übung, Ermutigung, Naturraum und soziale Zuwendung.",
        "answerGuides": [
          "Konkret gezeigt werden Tragen, Stützen, Üben, sorgfältige Ernährung, Ruhe, Begleitung und Ermutigung. Pflege ist im Roman praktisch und beziehungsnah.",
          "Die Alp verändert Klaras Bewegungsmöglichkeiten durch Wege, Luft, Tiere, Höhen und gemeinsames Tun. Bewegung wird weniger häuslich kontrolliert als in Frankfurt.",
          "Problematisch bleibt, dass Behinderung stark auf Heilung und Überwindung hin erzählt wird. Die Darstellung kann idealisieren, weil soziale und medizinische Komplexität verkürzt wird."
        ]
      },
      {
        "resourceId": "film-alptraum",
        "title": "Filmwerkstatt: Heidis Alptraum",
        "summary": "Der Dokumentarfilm erweitert die Romanlektüre, indem er Heidi als kulturelles Bild, Projektionsfläche und Konfliktfigur befragt.",
        "task": "Vergleiche eine Szene mit Klara auf der Alp mit einem Beobachtungsauftrag aus dem Film: Welche Heidi-Vorstellung wird bestätigt, welche irritiert?",
        "questionTasks": [
          "Welche Bilder von Alp und Heilung nutzt der Film?",
          "Wo zeigt der Film eine Spannung zwischen Idylle und Problemgeschichte?",
          "Welche Beobachtung aus dem Film verändert deinen Blick auf Klara?"
        ],
        "taskGuide": "Eine sorgfältige Antwort nutzt den Film nicht als Dekoration, sondern als Gegenlektüre: Die vertraute Heidi-Idylle wird auf Projektionen, Vermarktung und verdrängte Konflikte hin befragt.",
        "answerGuides": [
          "Der Film arbeitet mit Bildern von Bergen, Natur, Kindheit, Heimat oder Heilung. Diese Bilder können den Roman bestätigen, aber auch vereinfachen.",
          "Spannung entsteht dort, wo die schöne Alp zugleich als kulturelle Projektionsfläche, Problemgeschichte oder vermarktetes Bild erscheint. Idylle wird dadurch fragwürdig.",
          "Für Klara kann der Film den Blick darauf schärfen, dass Heilung nicht nur privat-glücklich erzählt wird, sondern Teil eines mächtigen Heidi-Bildes geworden ist."
        ]
      }
    ]
  },
  {
    "id": "lektion-10",
    "title": "Schuld, Wiedergutmachung und Schluss",
    "summary": "Peters Schuld wird gestanden, umgedeutet und sozial beigelegt; Medienvergleiche prüfen, wie stabil oder verformbar die Heidi-Ikone danach geworden ist.",
    "moduleIds": [
      "modul-10"
    ],
    "entryIds": [
      "frage-46",
      "frage-47",
      "frage-48",
      "frage-49",
      "frage-50"
    ],
    "reviewFocus": "Textnahe Antwort mit Beobachtung, Beleg und Deutung; keine reine Inhaltsnacherzählung.",
    "sebPrompt": "Bearbeite die Leitfragen dieser Lektion präzise am Volltext und nutze mindestens eine Leselinse.",
    "recommendedTheoryIds": [
      "schuld-ordnung",
      "bilder-popularisierung",
      "spyris-werk-lesarten",
      "studienkompass",
      "ki-trailer"
    ],
    "resourceAssignments": [
      {
        "resourceId": "schuld-ordnung",
        "title": "Schuld und Ordnung: Peters Geständnis",
        "summary": "Das Material hilft, Peters Schuld zwischen moralischer Verfehlung, sozialer Kränkung und Wiedergutmachung zu lesen.",
        "task": "Untersuche, wie der Roman Peters Tat bewertet: Wird Schuld bestraft, verstanden, entschärft oder sozial eingehegt?",
        "questionTasks": [
          "Welche Motive führen zu Peters Tat?",
          "Wie verändert das Geständnis die Situation?",
          "Welche Form von Wiedergutmachung bietet der Schluss an?"
        ],
        "taskGuide": "Die Antwort sollte Peters Schuld weder verharmlosen noch dämonisieren. Seine Tat entsteht aus Eifersucht und sozialer Kränkung; der Schluss ordnet sie durch Geständnis, Vergebung und materielle Entlastung ein.",
        "answerGuides": [
          "Zu Peters Tat führen Motive wie Eifersucht, Angst vor Bedeutungsverlust, soziale Unterlegenheit und Wut auf Klaras Rollstuhl als Zeichen der Konkurrenz.",
          "Das Geständnis verändert die Situation, weil es die verborgene Schuld öffentlich macht und eine neue Ordnung ermöglicht. Peter wird nicht nur Täter, sondern wieder Teil der Gemeinschaft.",
          "Wiedergutmachung entsteht durch Vergebung, Einsicht und die finanzielle Regelung. Der Schluss entschärft Schuld sozial, statt sie nur strafend zu behandeln."
        ]
      },
      {
        "resourceId": "bilder-popularisierung",
        "title": "Bildgeschichte und Popularisierung: Heidi als Ikone",
        "summary": "Das Bildmaterial zeigt, wie Heidi nach dem Roman zu einem wiedererkennbaren Zeichen für Kindheit, Schweiz, Natur und Heimat wurde.",
        "task": "Vergleiche den Romanschluss mit einem späteren Heidi-Bild: Was wird vereinfacht, verstärkt oder ausgeblendet?",
        "questionTasks": [
          "Welche Eigenschaften machen Heidi leicht popularisierbar?",
          "Welche Konflikte des Romans verschwinden in idealisierten Bildern?",
          "Wie verändert Popularisierung den Blick auf Schuld und Schluss?"
        ],
        "taskGuide": "Eine gute Antwort vergleicht Roman und Bildtradition genau: Heidi wird als Naturkind, Schweizer Ikone und Heilsfigur wiedererkennbar, während Ambivalenzen des Romans oft geglättet werden.",
        "answerGuides": [
          "Popularisierbar sind Heidis Kindlichkeit, Naturverbundenheit, Fröhlichkeit, Schweizer Alpenkulisse und klare Wiedererkennbarkeit.",
          "In idealisierten Bildern verschwinden oft Konflikte wie Armut, Weggabe, Krankheit, religiöser Druck, Peters Schuld und soziale Abhängigkeiten. Übrig bleibt eine harmlose Idylle.",
          "Popularisierung kann Schuld und Schluss versöhnlicher wirken lassen, als sie im Roman angelegt sind. Konflikte werden zu einem beruhigenden Heidi-Bild geglättet."
        ]
      },
      {
        "resourceId": "spyris-werk-lesarten",
        "title": "Spyri, Heidi und Nachleben: Autorin, Figur, Ikone",
        "summary": "Der SIKJM-Band zeigt, dass Heidi immer wieder neu gelesen, übersetzt und medial umgeformt wird; zugleich bleibt Spyri als Person schwer eindeutig zu fassen.",
        "task": "Formuliere zum Schluss eine differenzierte These zum Wechselspiel zwischen Spyri und Heidi: Wie wird aus einer literarischen Kinderfigur eine biografisch, gesellschaftlich und medial aufgeladene Ikone?",
        "questionTasks": [
          "Welche Spannung zwischen Autorin und Figur bleibt nach der Lektüre offen?",
          "Welche gesellschaftliche oder politische Dimension wird durch das Dossier im Schluss neu sichtbar?",
          "Wie erklärt das Dossier, dass Heidi über den Roman hinaus in jeder Generation anders gelesen werden kann?"
        ],
        "taskGuide": "Eine überzeugende Antwort bündelt die Einheit: Heidi ist nicht einfach Spyri, aber die Figur trägt Spuren von weiblicher Biografie, gesellschaftlicher Ordnung und kultureller Sehnsucht. Im Nachleben wird diese Figur immer wieder vereinfacht, erweitert oder umcodiert.",
        "answerGuides": [
          "Offen bleibt, wie viel Johanna in Heidi steckt. Gerade diese Unentscheidbarkeit macht die Figur stark: Sie ist biografisch anschliessbar, aber literarisch eigenständig.",
          "Neu sichtbar werden Fragen von weiblichem Handlungsspielraum, politischer Zugehörigkeit, sozialer Ordnung und öffentlichem Sprechen. Der Schluss kann deshalb als Beruhigung und als kulturelle Formung gelesen werden.",
          "Das Dossier zeigt Übersetzungen, Filme und Lesarten als Umformungen. Heidi bleibt anschlussfähig, weil sie klare Bilder bietet, aber zugleich offene Konflikte in Natur, Heimat, Kindheit und Gesellschaft bündelt."
        ]
      },
      {
        "resourceId": "studienkompass",
        "title": "Studienkompass: Forschungsperspektiven bündeln",
        "summary": "Der Studienkompass hilft, einzelne Beobachtungen am Ende der Einheit in eine begründete Gesamtdeutung zu überführen.",
        "task": "Formuliere eine abschliessende These: Welche Spannung trägt den Roman am stärksten – Natur und Stadt, Religion und Fürsorge, Krankheit und Heilung oder Schuld und Ordnung?",
        "questionTasks": [
          "Welche Forschungs- oder Dossierperspektive war für deine Deutung am ergiebigsten?",
          "Welche Romanstelle stützt deine Gesamtthese am stärksten?",
          "Welche Vereinfachung über Heidi würdest du nach der Einheit zurückweisen?"
        ],
        "taskGuide": "Die Antwort sollte eine echte Gesamtthese formulieren und nicht nur Themen aufzählen. Entscheidend ist, eine Spannung des Romans zu wählen und mit einer starken Textstelle sowie einer Materialperspektive zu begründen.",
        "answerGuides": [
          "Als ergiebigste Forschungs- oder Dossierperspektive gilt diejenige, die die eigene Deutung am besten schärft, etwa Naturpädagogik, Körper und Gesundheit, Religion, Stadt-Land-Kontrast oder Popularisierung.",
          "Die Romanstelle, die die Gesamtthese am stärksten stützt, sollte nicht nur passen, sondern die Spannung bündeln: etwa Heidis Weggabe, der Frankfurter Spuk, Klaras Alpaufenthalt oder Peters Geständnis.",
          "Zurückweisen lässt sich die Vereinfachung, Heidi sei nur eine harmlose Idylle. Der Roman verhandelt auch Armut, Kontrolle, Krankheit, Schuld und soziale Ordnung."
        ]
      },
      {
        "resourceId": "ki-trailer",
        "title": "Medienvergleich: KI-Horror-Trailer als produktive Störung",
        "summary": "Der Trailer wird gegen den Schluss der Einheit eingesetzt, um Heidi als globale, manipulierbare Bildikone zu untersuchen.",
        "task": "Wähle eine Romanstelle aus dem Schluss oder aus der Alp-Handlung und vergleiche sie mit dem KI-Trailer: Welche Bedeutungsverschiebung entsteht durch Horrorbild, Musik, Schnitt und KI-Ästhetik?",
        "questionTasks": [
          "Welche Heidi-Erwartung nutzt der Trailer aus?",
          "Welche Bild- oder Tonentscheidung verändert die Romanwirkung am stärksten?",
          "Was lernst du dadurch über Popularisierung und Verfremdung?"
        ],
        "taskGuide": "Eine genaue Antwort beschreibt den Trailer als produktive Störung: Er nutzt vertraute Heidi-Signale und verschiebt sie durch Horrorästhetik, Musik, Schnitt oder KI-Bildlogik in ein fremdes Genre.",
        "answerGuides": [
          "Der Trailer nutzt die Erwartung von Unschuld, Alp-Idylle, Kindheit, Natur und Heimat. Gerade weil diese Erwartungen vertraut sind, kann er sie ins Unheimliche kippen.",
          "Als Bild- oder Tonentscheidung verändert etwa düstere Musik, harte Schnitte, verzerrte Gesichter, Schatten, Tempo oder KI-Glätte die Romanwirkung am stärksten. Die Wirkung verschiebt sich von Trost zu Bedrohung.",
          "Man lernt, dass Popularisierung Figuren aus ihrem Ursprung lösen kann. Verfremdung macht sichtbar, welche Bildformeln Heidi stabilisieren und wie leicht sie umcodiert werden."
        ]
      }
    ]
  }
];

export const starterPrompt = {
  title: "Leseeinstieg",
  text: "Wähle eine Leitfrage, lies die passende Passage im Volltext und antworte mit Beobachtung, Beleg und Deutung.",
  items: [
    "Lies zuerst die Leitfrage und markiere die Figuren, Orte oder Motive, die darin vorkommen.",
    "Suche im Volltext eine genaue Formulierung, die deine Antwort stützt.",
    "Formuliere nicht nur Inhalt, sondern eine Deutung: Was zeigt oder bewirkt die Stelle?"
  ]
};
export const pdfSource = pdfPath;
export const coverImage = coverImg;
export const authorImage = authorImg;
