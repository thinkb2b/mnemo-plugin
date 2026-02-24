# mnemo-plugin (Outlook Add-in)

## Analyse: Warum es bei dir in Outlook (Version `1.2026.210.300`) nicht klappt

Deine Versionsangaben zeigen, dass du das **neue Outlook für Windows** (WebView2-basiert) nutzt. In dieser Variante ist der Menüpfad für Sideloading je nach Tenant/Policy oft eingeschränkt oder anders als im klassischen Outlook.

Im aktuellen Repo gibt es zusätzlich zwei harte technische Stolpersteine:

1. Im Manifest stehen noch Platzhalter-URLs (`DEINE_APP_URL`). Ohne reale HTTPS-Ziele wird das Add-in nicht geladen.
2. Das Manifest verweist auf mehrere Icons; wenn nur eins davon fehlt (404), lehnt Outlook das Add-in häufig ab.

Zusätzlich wurde im Code der Office-Insert-Pfad bereits stabilisiert (Promise-Wrapper für Callback-APIs), damit Einfügefehler nicht stillschweigend verschwinden.

---

## Voraussetzungen (für **neues Outlook** auf Windows 11)

- Microsoft 365 **Arbeits-/Schulkonto** mit Exchange Online (kein reines POP/IMAP-Postfach).
- Add-in-Sideloading ist im Tenant nicht blockiert (M365 Admin/Policy kann es deaktivieren).
- Öffentlich erreichbare HTTPS-URL für die App (z. B. `https://mnemo-plugin.onrender.com`).
- Folgende Dateien müssen über HTTPS erreichbar sein (HTTP 200):
  - `/index.html`
  - `/icon-16.png`, `/icon-32.png`, `/icon-64.png`, `/icon-80.png`, `/icon-128.png`

---

## Schritt-für-Schritt (zuverlässiger Weg für deine Outlook-Version)

### 1) Build erzeugen

```bash
npm install
npm run build
```

### 2) `dist/` deployen (HTTPS)

Deploye den `dist/`-Inhalt auf eine öffentliche HTTPS-Domain.

### 3) Manifest korrekt machen

In `manifest.xml` **alle** Vorkommen von

`https://DEINE_APP_URL.onrender.com`

durch deine echte URL ersetzen, z. B. `https://mnemo-plugin.onrender.com`.

### 4) Manifest vorab prüfen (wichtig)

Öffne im Browser alle im Manifest referenzierten URLs:

- `https://<deine-url>/index.html`
- `https://<deine-url>/icon-16.png`
- `https://<deine-url>/icon-32.png`
- `https://<deine-url>/icon-64.png`
- `https://<deine-url>/icon-80.png`
- `https://<deine-url>/icon-128.png`

Wenn auch nur eine URL nicht lädt, bricht Outlook häufig ab.

### 5) Installation für **neues Outlook** (empfohlene Reihenfolge)

#### Option A (empfohlen): Über Outlook im Web sideloaden, dann in neuem Outlook nutzen

1. Öffne `https://outlook.office.com` mit demselben Konto wie im neuen Outlook.
2. Neue Mail erstellen.
3. `...` → **Apps abrufen** / **Get Add-ins**.
4. **Meine Add-Ins** → **Benutzerdefinierte Add-Ins** → **Aus Datei hinzufügen**.
5. `manifest.xml` auswählen.
6. Neues Outlook neu starten und 1–3 Minuten warten (Sync kann verzögert sein).

#### Option B: Direkt im neuen Outlook (wenn sichtbar)

1. Neue Mail öffnen.
2. `...` → **Apps abrufen**.
3. **Meine Add-Ins** → **Benutzerdefinierte Add-Ins** → **Aus Datei hinzufügen**.
4. `manifest.xml` auswählen.

Wenn **„Benutzerdefinierte Add-Ins / Aus Datei hinzufügen“** fehlt, ist Sideloading in deinem Tenant sehr wahrscheinlich deaktiviert.

---

## Wenn „Aus Datei hinzufügen“ fehlt (häufig in Enterprise)

Dann muss ein Administrator das Add-in bereitstellen:

1. Microsoft 365 Admin Center → **Integrated apps**.
2. **Upload custom apps** / benutzerdefinierte App hochladen.
3. `manifest.xml` hochladen und Benutzergruppe zuweisen.
4. Auf Replikation warten (typisch 5–60 Minuten).
5. Outlook neu starten.

---

## Funktionsprüfung in Outlook

1. Neue E-Mail (Compose) öffnen.
2. In der Befehlsleiste **Mnemo** / **Snippets öffnen** suchen.
3. Taskpane öffnen.
4. Snippet einfügen testen.

> Hinweis: Das Manifest registriert die Schaltfläche nur für **Compose/Edit**, nicht für Lesemodus.

---

## Troubleshooting (für deine Umgebung)

- **Add-in nicht sichtbar, obwohl installiert**
  - Prüfe, dass du mit dem gleichen Konto in neuem Outlook und OWA angemeldet bist.
  - Outlook komplett beenden, neu starten, 1–3 Minuten warten.

- **Manifest-Upload schlägt fehl**
  - Meist fehlerhafte/unerreichbare Manifest-URLs (Icons/Taskpane).
  - HTTPS-Zertifikat darf nicht selbstsigniert sein.

- **Taskpane bleibt leer**
  - `index.html` direkt im Browser testen.
  - Browser-DevTools im WebView2/OWA auf JS-Fehler prüfen.

- **Einfügen in Betreff/Body klappt nicht**
  - Der Code nutzt nun Promise-Wrapper um `setSelectedDataAsync`/`setAsync`; dadurch werden echte Office-Fehler sauber angezeigt.

---

## Entwicklung lokal

```bash
npm run dev
```

Für realen Outlook-Test muss das Manifest auf eine von Outlook erreichbare HTTPS-URL zeigen.
