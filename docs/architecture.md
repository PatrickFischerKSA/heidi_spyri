# Architektur

## Ziel

Dieses Repo liefert eine einzelne, abgeschlossene Unterrichtseinheit zu Johanna Spyris *Heidi*. Es ist fuer GitHub, Vercel und Render vorbereitet.

## Laufzeitmodell

- Express liefert Landingpage, offene Version, SEB-Version und Lehrer*innen-Dashboard.
- Der Reader ist eine Vanilla-JS-Oberflaeche mit integriertem Volltext.
- Klassen, Lernende, Arbeitsstaende und Peer Reviews werden bevorzugt in Supabase gespeichert, wenn `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` gesetzt sind.
- Ohne Supabase nutzt die App den lokalen Fallback `data/kehlmann-reader-store.json`.

## Kernmodule

- `src/app.mjs`: Routing, HTML-Shells und Zugangsseiten
- `src/routes/kehlmann-reader-api.mjs`: Reader- und Lehrer*innen-API
- `src/services/kehlmann-reader-store.mjs`: Persistenz, Supabase-Adapter und Klassenlogik
- `src/services/kehlmann-reader-progress.mjs`: Lektions- und Fortschrittsauswertung
- `src/services/kehlmann-reader-feedback.mjs`: differenzierte Feedbackdiagnostik
- `public/kehlmann-reader/data.js`: Heidi-Lektionen, Leitfragen, Dossiers und Medienaufgaben

## Zugangslogik

- `/open`: Name oder Kuerzel
- `/seb`: Safe Exam Browser, dann Name oder Kuerzel
- `/teacher-entry`: offener Lehrpersonen-Ueberblick
- `/teacher`: offenes Lehrer*innen-Dashboard

## Kostenfreie Deployment-Strategie

Vercel Hobby hostet den Serverless-Express-Einstieg, Supabase Free speichert die Lernstaende. Render Free bleibt als einfachere, aber fluechtigere Alternative erhalten.

## Erweiterungspfad

- externes Storage fuer dauerhaft gesicherte Klassendaten
- feinere Review-Rubriken
- Exportfunktionen fuer Lehrkraefte
- weitere Medien- und Forschungsstationen
