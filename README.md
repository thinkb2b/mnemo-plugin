# mnemo-plugin (Outlook Add-in)

## Warum das Add-in in Outlook oft nicht startet

Die häufigsten Ursachen im aktuellen Stand:

1. **Manifest enthält Platzhalter-URLs (`DEINE_APP_URL`)**. Ohne echte HTTPS-URL kann Outlook das Taskpane nicht laden.
2. **Icons/Assets unter den Manifest-URLs fehlen**. Outlook bricht das Laden oft schon beim Manifest-Check ab, wenn Icon-Links 404 liefern.
3. **Office-Async-APIs wurden nicht sauber als Promise behandelt**. Fehler beim Einfügen von Betreff/Text wurden dadurch schwer sichtbar.

## Voraussetzungen für Outlook 365 Desktop (Windows 11)

- Microsoft 365 Konto mit **Exchange Online** Mailbox.
- Outlook 365 auf Windows 11 (klassisches oder neues Outlook, Mailbox muss verbunden sein).
- Eine **öffentlich erreichbare HTTPS-URL** für die gebaute App (z. B. Render, Azure, Vercel).
- Die URL muss Folgendes bereitstellen:
  - `https://<deine-url>/index.html`
  - `https://<deine-url>/icon-16.png`
  - `https://<deine-url>/icon-32.png`
  - `https://<deine-url>/icon-64.png`
  - `https://<deine-url>/icon-80.png`
  - `https://<deine-url>/icon-128.png`

## Schritt-für-Schritt: Installation in Outlook 365 (Windows 11)

### 1) App bauen und deployen

```bash
npm install
npm run build
```

Deploye den Inhalt von `dist/` auf eine HTTPS-Domain.

### 2) Manifest anpassen

In `manifest.xml` **alle** Vorkommen von

`https://DEINE_APP_URL.onrender.com`

durch deine echte URL ersetzen (ohne abschließenden Slash), z. B.:

`https://mnemo-plugin.onrender.com`

### 3) Manifest lokal speichern

Speichere die fertige Datei als `manifest.xml` an einen leicht auffindbaren Ort (z. B. Desktop).

### 4) Add-in in Outlook hinzufügen (Sideload)

#### Klassisches Outlook für Windows

1. Outlook öffnen.
2. **Start** → **Add-Ins abrufen** (oder „Get Add-ins“).
3. Unten links: **Meine Add-Ins**.
4. **Benutzerdefinierte Add-Ins** → **Benutzerdefiniertes Add-In hinzufügen** → **Aus Datei hinzufügen**.
5. Deine `manifest.xml` auswählen.
6. Sicherheitsabfrage bestätigen.

#### Neues Outlook für Windows

1. Neues Outlook öffnen.
2. In einer E-Mail auf die drei Punkte `...` klicken.
3. **Add-Ins abrufen**.
4. **Meine Add-Ins** → **Benutzerdefinierte Add-Ins** → **Aus Datei hinzufügen**.
5. `manifest.xml` auswählen und bestätigen.

### 5) Add-in testen

1. Neue E-Mail erstellen.
2. Im Ribbon sollte die Gruppe **Mnemo** mit Button **Snippets öffnen** erscheinen.
3. Klick auf **Snippets öffnen** öffnet das Taskpane.
4. Snippet auswählen und in den Entwurf einfügen.

## Troubleshooting (kurz & praxisnah)

- **Add-in erscheint nicht im Ribbon**
  - Prüfe, ob du wirklich im **Compose**-Fenster bist (das Manifest ist auf `FormType="Edit"` ausgelegt).
  - Konto neu anmelden und Outlook neu starten.

- **Leeres Taskpane / Ladefehler**
  - Öffne die `index.html` URL direkt im Browser.
  - Prüfe Zertifikat/HTTPS, CORS und ob die URL öffentlich erreichbar ist.

- **Manifest wird abgelehnt**
  - Oft sind ungültige/unerreichbare Icon-URLs die Ursache.
  - Stelle sicher, dass jede im Manifest referenzierte Datei mit HTTP 200 antwortet.

- **Einfügen in Betreff/Text funktioniert nicht zuverlässig**
  - In dieser Version wurden die Outlook-Async-Aufrufe in Promise-Wrapper gelegt, damit Fehler korrekt behandelt werden.

## Entwicklung lokal

```bash
npm run dev
```

Für lokalen Outlook-Test muss das Manifest auf eine HTTPS-Quelle zeigen, die Outlook erreichen und vertrauen kann.
