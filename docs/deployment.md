# Gratis-Deployment

## Schlauere stabile Gratis-Lösung

Die beste kostenlose Architektur ist:

1. **Vercel Hobby** für Hosting und Serverless Express
2. **Supabase Free** für die Lernstände

Warum: Vercel hostet die App sehr bequem aus GitHub. Supabase speichert Lernstände, Namen, Antworten und Peer Reviews in Postgres, statt sie in ein flüchtiges Dateisystem zu schreiben.

## Vercel einrichten

Die Datei `vercel.json` ist bereits enthalten. Sie leitet alle Routen an `api/index.mjs` weiter:

- `/`
- `/open`
- `/teacher-entry`
- `/teacher`
- `/reader-api`
- `/reader/assets/...`

Vorgehen:

1. Repository in Vercel importieren.
2. Framework Preset: `Other`.
3. Build Command: leer lassen oder `npm ci`.
4. Output Directory: leer lassen.
5. Environment Variables setzen:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - optional `SUPABASE_STORE_TABLE=reader_store`
   - optional `SUPABASE_STORE_ID=heidi_spyri`
   - optional `SEB_CONFIG_KEY_HASH`
6. Deploy starten.

## Supabase einrichten

1. Supabase-Projekt erstellen.
2. SQL Editor öffnen.
3. Inhalt von `sql/supabase-reader-store.sql` ausführen.
4. In Vercel diese Werte setzen:
   - `SUPABASE_URL`: Project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key

Der Service-Role-Key bleibt nur serverseitig in Vercel und wird nicht an den Browser ausgeliefert.

## Lokaler Fallback

Ohne Supabase-Variablen nutzt die App weiterhin:

`data/kehlmann-reader-store.json`

Das ist für lokale Entwicklung und Render-Testbetrieb praktisch.

## Render Free als einfache Alternative

`render.yaml` bleibt vorhanden. Render Free funktioniert, aber die lokalen Laufzeitdaten sind flüchtig:

- Free Web Services schlafen nach Inaktivität ein.
- Lokale Dateiänderungen gehen bei Neustart, Redeploy oder Spin-down verloren.
- Persistent Disks gibt es für Free Web Services nicht.

Darum ist Render Free okay für kurze Tests, aber Vercel + Supabase ist die bessere Gratis-Variante, wenn Lernstände stabiler bleiben sollen.

## Grenzen der Gratis-Lösung

Auch Supabase Free ist keine perfekte Archivlösung:

- Projekte können bei Inaktivität pausiert werden.
- Free-Projekte haben keine herunterladbaren Backups.

Für Unterrichtssequenzen ist das deutlich besser als ein flüchtiges Dateisystem. Für dauerhaftes Archivieren wäre später ein bezahlter Storage-Plan oder regelmässiger Export sinnvoll.
