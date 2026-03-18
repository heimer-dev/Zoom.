# 📰 Zoom. – Die Schülerzeitung des Burgaugymnasiums

Eine moderne Online-Schülerzeitung mit Admin-Bereich, Rich-Text-Editor und PDF-Export.

---

## ✨ Features

- **Online-Leseansicht** – ansprechend gestaltet in Blautönen
- **PDF-Download** jeder Ausgabe
- **Admin-Bereich** mit Rich-Text-Editor (Quill.js):
  - Verschiedene Schriftarten (Inter, Playfair Display, Serif, Monospace)
  - Fett, Kursiv, Unterstrichen, Durchgestrichen
  - Überschriften, Farben, Ausrichtung, Listen, Blockzitate
  - Bilder und Links einfügen
- **12 Abschnittstypen**:
  - 📰 Artikel · 😂 Witz der Woche · ⭐ Schüler des Monats
  - 💬 Zitat der Woche · 📅 Veranstaltungen · ⚽ Sportecke
  - 🍳 Rezept der Woche · 📊 Umfrage · 💡 Tipp der Redaktion
  - 📢 Bekanntmachung · 🖼️ Fotogalerie · 🎤 Interview
- **5 Seitenlayouts**: Einspaltig, Zweispaltig, Feature, Sidebar, Volle Breite
- **Individuelle Farben** pro Abschnitt (Hintergrund, Text, Akzent, Überschriften)
- **Benutzerverwaltung** mit 4 Rollen
- **Autosave** beim Schreiben

## 🔐 Standard-Login

| Feld | Wert |
|------|------|
| Benutzername | `Pebbles` |
| Passwort | `1234` |

> **Wichtig:** Beim ersten Login muss das Passwort geändert werden!

## 👥 Benutzerrollen

| Rolle | Berechtigungen |
|-------|---------------|
| **Mitarbeiter** | Eigene Artikel schreiben und bearbeiten |
| **Redakteur** | Alle Artikel bearbeiten, Ausgaben verwalten, veröffentlichen |
| **Admin** | + Benutzer anlegen, Einstellungen ändern |
| **Super-Admin** | Voller Zugriff (inkl. Benutzer löschen) |

---

## 🖥️ Lokales Testen (Umbrel Homeserver)

### Voraussetzungen
- [Umbrel](https://umbrel.com) läuft auf deinem Homeserver
- SSH-Zugriff auf den Umbrel-Server

### Schritt-für-Schritt-Anleitung

#### 1. Per SSH verbinden
```bash
ssh umbrel@umbrel.local
# Standard-Passwort: mnemonic (dein Umbrel-Passwort)
```

#### 2. Repository klonen
```bash
cd ~
git clone https://github.com/DEIN-USER/zoom-newspaper.git
cd zoom-newspaper
```

#### 3. Docker Compose starten
```bash
docker compose up -d
```

> Das erste Mal dauert etwas länger, da Chromium für den PDF-Export installiert wird.

#### 4. Im Browser öffnen
- Vom Umbrel-Gerät selbst: `http://localhost:3001`
- Vom Heimnetzwerk: `http://umbrel.local:3001` oder `http://[UMBREL-IP]:3001`
- Admin-Bereich: `http://umbrel.local:3001/admin`

#### 5. Umbrel-IP herausfinden (falls nötig)
```bash
hostname -I | awk '{print $1}'
```

### Logs anzeigen
```bash
docker compose logs -f
```

### Neustart
```bash
docker compose restart
```

### Stoppen
```bash
docker compose down
```

### Daten sind dauerhaft gespeichert
Die SQLite-Datenbank liegt im Docker-Volume `zoom-data` und bleibt auch nach Neustarts erhalten.

---

## 🚀 Manuelle Installation (ohne Docker)

### Voraussetzungen
- Node.js 18+ (`node --version`)
- npm

### Installation
```bash
cd backend
npm install
```

### Starten
```bash
node backend/server.js
```

Die App ist dann unter `http://localhost:3001` erreichbar.

---

## 🛠️ Entwicklung

```bash
cd backend
npm install
npm run dev   # Startet mit nodemon (Auto-Reload)
```

### Umgebungsvariablen
| Variable | Standard | Beschreibung |
|----------|---------|--------------|
| `PORT` | `3001` | Server-Port |
| `DB_PATH` | `./data/zoom.db` | Pfad zur SQLite-Datenbank |
| `JWT_SECRET` | *(Default)* | Sicherheitsschlüssel für JWT-Tokens – **in Produktion unbedingt ändern!** |

---

## 📁 Projektstruktur

```
Zoom./
├── backend/
│   ├── server.js          # Express-Server
│   ├── database/init.js   # Datenbankschema & Seed-Daten
│   ├── middleware/auth.js  # JWT-Authentifizierung
│   └── routes/
│       ├── auth.js        # Login, Passwort ändern
│       ├── users.js       # Benutzerverwaltung
│       ├── editions.js    # Ausgaben-CRUD
│       ├── articles.js    # Artikel-CRUD
│       ├── pdf.js         # PDF-Generierung
│       └── settings.js    # App-Einstellungen
├── frontend/
│   ├── index.html         # Startseite
│   ├── reader.html        # Online-Leseansicht
│   ├── admin/index.html   # Admin-Bereich
│   ├── css/
│   │   ├── style.css      # Hauptstyles
│   │   ├── reader.css     # Leseansicht-Styles
│   │   └── admin.css      # Admin-Styles
│   └── js/
│       ├── admin-utils.js    # Hilfsfunktionen
│       ├── admin-auth.js     # Authentifizierung
│       ├── admin-main.js     # App-Navigation
│       ├── admin-dashboard.js
│       ├── admin-editions.js # Editor
│       ├── admin-users.js
│       └── admin-settings.js
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 🔒 Sicherheitshinweis

Ändere in Produktion unbedingt:
1. Das Passwort von `Pebbles` beim ersten Login
2. Den `JWT_SECRET` in der `docker-compose.yml` oder als Umgebungsvariable

```bash
# Zufälligen JWT_SECRET generieren:
openssl rand -hex 32
```

Dann in `docker-compose.yml`:
```yaml
environment:
  - JWT_SECRET=dein-generierter-geheimer-schluessel
```
