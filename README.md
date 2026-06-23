# heidi_spyri

Interaktive Lese- und Lernumgebung zu Johanna Spyris *Heidi*.

## Enthalten

- integrierter Volltext als lokale HTML-Ressource
- 50 Leitfragen aus dem Word-Dokument mit Sofortfeedback
- offene Anmeldung nur mit Name
- Lehrer*innen-Dashboard ohne Passwortlogik
- didaktisierte Dossiers zu Archiv, Religion, Natur, Stadt-Land, Bildgeschichte, Forschung und Film
- Filmwerkstatt zu Anita Hugis *Heidis Alptraum* als interpretatorische Erweiterung
- GitHub- und Render-fähige Express-App

## Gratis-Hosting

Empfohlen: **Vercel Hobby + Supabase Free**.

Das ist stabiler als reines Render Free, weil Lernstände dann in Supabase/Postgres liegen und nicht im flüchtigen Dateisystem eines Free-Webservices.

- `vercel.json` für Vercel Serverless Express
- `api/index.mjs` als Vercel-Entry
- `sql/supabase-reader-store.sql` für die Store-Tabelle
- Supabase wird automatisch genutzt, wenn `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` gesetzt sind
- ohne Supabase bleibt der lokale Datei-Store als Fallback aktiv

Render Free bleibt als einfache Alternative vorbereitet:

- `render.yaml` nutzt `plan: free`
- Build: `npm ci`
- Start: `npm start`
- Healthcheck: `/`
- keine Lehrer*innen-Passwortlogik

Einschränkung: Auch Supabase Free kann bei längerer Inaktivität pausieren und ist keine perfekte Archivlösung. Für Unterrichtssequenzen ist es aber deutlich stabiler als lokales Speichern auf Render Free.

## Start

```bash
npm install
npm test
npm start
```

Standardmässig läuft die App unter <http://127.0.0.1:3018>.

## Zugänge

- `/open` offene Lernendenansicht
- `/teacher-entry` Lehrendenüberblick
- `/teacher` Dashboard

Die grosse Open-Access-Studie wurde nicht als 523-MB-Originaldatei eingebettet, sondern als Studienkompass und Dossiers didaktisiert.

Deployment-Schritte stehen in [docs/deployment.md](docs/deployment.md).
