# SabeeApp Go — Functional Manual (internal source)

> **Purpose of this document.** This is an internal, factual reference describing every screen and feature of the SabeeApp Go mobile app. It is written for the Customer Success team to use as the source material when producing the final, customer-facing manual. It aims to be complete and accurate rather than promotional, and it intentionally documents behaviour exactly as the app currently works. Sections marked **⚠ Internal** describe developer or QA mechanics and must **not** be carried over into the customer manual.
>
> This document reflects the app as released in build **iOS 55 / Android versionCode 5**.

---

## 1. About the app

SabeeApp Go is a mobile companion to the SabeeApp PMS (Property Management System), built for front-desk staff and property managers who need to handle day-to-day operations from their phone. It focuses on the daily front-desk workflow: seeing who is arriving, reviewing reservations and their guests, keeping guest personal details up to date, and capturing guest identity documents by scanning them with the phone camera.

The app is deliberately narrow in scope. Everything related to account management, billing, rate and room configuration, and other administrative setup continues to live in the SabeeApp PMS and is **not** available in this app. SabeeApp Go should be presented to customers as a focused front-desk tool, not as a replacement for the PMS.

A few facts that apply across the whole app:

- **Platforms.** The app ships as native iOS and Android applications and can also run as a Progressive Web App (PWA) added to the home screen.
- **Languages.** The interface is available in English, Hungarian, German, Turkish, French, Latvian, and Spanish. The language can be chosen on the Login screen and changed at any time in Settings, and the choice is remembered between sessions.
- **Connectivity.** The app is online-only. All information is loaded live from the SabeeApp API; there is no offline mode and no local copy of the data beyond what is currently on screen.

## 2. Core concepts

These concepts apply throughout the app, and understanding them first makes the individual screens easier to explain.

**The sign-in journey.** A user always moves through the same sequence when opening the app for the first time or after logging out: they sign in on the **Login** screen, confirm their identity on the **MFA** (two-factor) screen, choose which property they are working with on the **Property Select** screen, and then arrive at the **Home** screen. From Home, the main path into detail is: open a **Reservation**, open one of its **Guests**, and from there either **Edit** the guest or run an **ID Scan**.

**The data window (important).** When a property is opened, the app loads the reservations whose dates fall between **14 days ago and 14 days from now** — roughly a four-week window centred on today. Every other part of the app works on top of this loaded set. This means the Home day tabs and the Search screen can only display or find reservations inside that window; a reservation that checked out three weeks ago, or one arriving in two months, is simply not loaded and therefore cannot be shown or searched. This is the single most important limitation to communicate to users.

**Reservation status.** Every reservation shows a coloured status pill. The label is derived from the reservation's status in the PMS and is purely informational in this app — staff cannot change a reservation's status from SabeeApp Go (that is done in the PMS). The possible labels are:

| Label | Meaning |
|---|---|
| Option | No lifecycle status has been assigned yet — a tentative or unassigned booking. |
| Confirmed | The booking is confirmed but the guest has not yet arrived. |
| Onboard | The guest is currently in-house. |
| Check in | The reservation is due to check in. |
| Checked in | The guest has been checked in. |
| Check out | The reservation is due to check out. |
| Checked out | The guest has been checked out. |
| Cancelled | The reservation has been cancelled. |
| No show | The guest did not arrive. |

---

## 3. Screens

Each screen below is described in terms of its purpose, what it shows, what the user can do on it, and which checks or mandatory inputs apply.

### Login

**Purpose.** The Login screen authenticates the user against their SabeeApp account and is the entry point to the whole app.

**What it shows.** There is an email field and a password field (both use floating labels that lift above the text as the user types) and a language selector in the top corner. While the app is connecting, the Sign-in button shows a spinner.

**What the user can do.** The user enters their email and password and taps Sign in, which begins authentication and, on success, takes them to the MFA screen. The language selector changes the interface language immediately.

**Checks and mandatory fields.** Both the email and the password are required: the Sign-in button does nothing while either field is empty. Credentials are verified by the server, and an incorrect email or password produces an error message (for example, "The email or password you entered is incorrect. Please check your credentials and try again."). Authentication always continues to a second factor — there is no way to reach Home directly from Login.

### MFA (two-factor authentication)

**Purpose.** The MFA screen confirms the user's identity using a six-digit, time-based one-time code (TOTP) from the user's authenticator app.

**What it shows.** Six single-digit input boxes, arranged as two groups of three.

**What the user can do.** As the user types, the cursor advances automatically to the next box; pressing backspace clears the current box and steps back. The user can paste a full six-digit code into the first box and it will populate all six. The code submits **automatically** as soon as the sixth digit is entered — there is no separate "Verify" button.

**Checks and mandatory fields.** All six digits are required, and only numbers are accepted. The complete code is verified by the server. An incorrect code clears all boxes, shows "Invalid code. Try again", and returns focus to the first box so the user can re-enter it. On success, the user proceeds to Property Select.

### Property Select

**Purpose.** This screen requires the user to choose which property they will be managing in this session. It appears immediately after sign-in and intentionally has **no back button**.

**What it shows.** A list of the properties the user has access to, each showing the company name and the property name. The list is sorted alphabetically (using locale-aware ordering), and a filter field is available to narrow a long list by typing part of a name.

**What the user can do.** Tapping a property selects it. The app then loads that property's reservations (and supporting data such as the country list) and opens the Home screen.

**Checks and mandatory fields.** A property must be selected before the user can continue. The active property can be changed later from the Home screen, so this is not a permanent choice.

### Home (Arrivals)

**Purpose.** Home is the daily working screen. It shows the arrivals for the selected property, focused on a single day at a time.

**What it shows.** At the top, a header displays the current property name (which can be tapped to switch properties), a notification bell (currently visual only), and a settings icon. Below that is a search field that opens the Search screen. A day selector offers three tabs — **Yesterday**, **Today**, and **Tomorrow** — with Today selected by default. Two summary cards show figures for the selected day: **Guests** (the total number of guests across that day's arriving reservations) and **Reservations** (how many reservations arrive that day). Below the cards is the list of arrivals, one card per reservation, each showing the reservation code, the status pill, the guest's name and email, the date with the guest and night counts, and the room.

**What the user can do.** The user switches between the three day tabs, pulls down on the list to refresh the data from the server, and taps any reservation to open its detail screen. Tapping the property name opens a property switcher panel that lists the available properties (with the current one marked and a filter field for long lists) and lets the user move to a different property.

**Checks and mandatory fields.** None — this is a read-only overview. For clarity, reservations that are Cancelled or No-show are shown dimmed, and reservations still in the "Option" state are dimmed on the Yesterday and Tomorrow tabs. Only arrivals that fall inside the ±14-day data window can appear here.

### Search

**Purpose.** The Search screen finds a specific reservation among those currently loaded.

**What it shows.** A search field that focuses automatically when the screen opens, a list of recent searches, and the matching reservations presented as cards.

**What the user can do.** The user types a query and the results update shortly after they stop typing. Tapping a result opens that reservation's detail screen. Recent searches are remembered (up to ten) and offered as quick shortcuts on subsequent visits.

**Checks and mandatory fields.** At least **three characters** must be entered before any search runs. The query is matched against the reservation code and the guest's first and last name (matching from the start of the word) and against the email address (matching anywhere within it). Because Search works only over the loaded set, it covers the **±14-day window only** and is not a full booking-history search.

### Reservation Detail

**Purpose.** This screen shows the full detail of a single reservation together with the guests on it.

**What it shows.** A detail block at the top displays the reservation code, the status pill, and a grid of facts: the check-in date (with the check-in time if the guest has already checked in), the check-out date (with the check-out time if applicable), the guest composition, the source or partner, and the room and room type. Below this, a "Guests" section lists each guest as a card showing the guest's name, age, gender, citizenship, and whether they are liable for city tax, along with an indicator if a document has already been scanned for that guest.

**What the user can do.** Tapping a guest card opens that guest's detail screen.

**Checks and mandatory fields.** None — this screen is read-only. In particular, the status pill cannot be changed here.

### Guest Detail

**Purpose.** This screen presents one guest's complete record.

**What it shows.** The information is grouped into cards: personal details (name, maiden name, mother's name, date and place of birth, citizenship), contact details (phone number and email), and document details (document type, whether it has been scanned, and the document number).

**What the user can do.** Shortcut buttons next to the contact details let the user place a call or start an email. A floating action button opens a small menu with two choices: **Edit guest**, which opens the editing form, and **ID Scan**, which begins a document scan for this guest.

**Checks and mandatory fields.** None — this is a viewing screen; all changes are made through Edit guest or ID Scan.

### Edit Guest

**Purpose.** This form lets the user correct or complete a guest's details.

**What it shows.** Editable fields for first name, last name, maiden name, mother's name, date of birth, place of birth, citizenship, gender, phone number, email, document type (chosen from a dropdown of Passport, ID Card, Driving Licence, or Residence Permit), and document number.

**What the user can do.** The user edits any field and taps Save, which writes the changes to the server and returns to the previous screen. If the user has just completed an ID scan, the relevant fields are **pre-filled** with the scanned values so they only need to confirm or adjust them.

**Checks and mandatory fields.** **There are none.** The form currently performs **no required-field validation and no format checking** of any kind — whatever is entered, including empty fields, is saved exactly as typed. *(Note for the final manual: any expectations about which guest fields "must" be completed are a matter of staff procedure, not something the app enforces today.)*

### ID Scan

**Purpose.** ID Scan reads a guest's travel document — a passport, ID card, driving licence, or residence permit — and extracts the guest's data automatically, using optical character recognition and, where the document supports it, the RFID chip.

**What it shows.** A camera view with a scanning frame, a brief loading state while the document scanner initialises, and a result panel once the document has been read.

**What the user can do.** When a document is read, the user can **Save** the extracted data directly onto the guest, or choose **Edit** to open the Edit Guest form with the scanned values pre-filled for review. The captured fields are the guest's name, date and place of birth, gender, citizenship, age, mother's name, document type, and document number. If a scan does not complete — for example it times out, is cancelled, or is interrupted — the screen offers a **Scan again** option.

**Checks and mandatory fields.** Scanning requires the device camera and therefore **works only on a real phone**; it is intentionally disabled in a desktop browser, where the shutter button cannot be used.

### Settings

**Purpose.** Settings covers account and app preferences.

**What it shows.** The signed-in user's name and email at the top, a language picker, and the app's version and build number.

**What the user can do.** The user can change the interface language (the screen fetches the current list of available languages, marks the active one, and remembers the selection), lock the session (see Internal), and log out, which returns them to the Login screen.

**Checks and mandatory fields.** None.

---

## 4. Validation and mandatory fields — quick reference

This table summarises, for each place the user enters data, what is required and what the app checks.

| Surface | Required input | Checks performed |
|---|---|---|
| Login | Email **and** password | Both must be non-empty before Sign in does anything; credentials are verified by the server. |
| MFA | All six digits | Numbers only; the full six-digit code is verified by the server. |
| Property Select | A property selection | One property must be chosen to proceed. |
| Search | At least three characters | Fewer than three characters returns no results. |
| Edit Guest | **Nothing** | **No required fields and no format validation** — data is saved exactly as entered. |
| ID Scan | A real device with a camera | Scanning is disabled in a browser. |

---

## 5. Typical tasks

These short flows describe the most common things a front-desk user will do, and may be helpful when writing step-by-step instructions:

- **Review who is arriving today.** Open the app, sign in, choose the property, and read the Today tab on Home. Switch to Yesterday or Tomorrow to look around that day.
- **Look up a specific booking.** From Home, tap the search field, type at least three characters of the reservation code, guest name, or email, and open the matching result.
- **Check or correct a guest's details.** Open the reservation, tap the guest, review the cards on Guest Detail, then use the floating button to choose Edit guest, make changes, and Save.
- **Capture a guest's ID document.** Open the guest, use the floating button to choose ID Scan, scan the document on a phone, review the extracted data, and either Save it to the guest or open Edit guest to adjust it first.
- **Switch to another property.** On Home, tap the property name in the header and choose a different property from the panel.

---

## 6. ⚠ Internal / hidden — exclude from the customer manual

The following exist for development and QA and should **not** appear in the customer-facing manual.

- **Test ↔ Live API switch (Login screen).** Tapping the bottom-left corner of the Login screen seven times toggles the app between the Live and Test API environments. Taps four through six show a small countdown message, and the seventh tap logs the user out and switches the environment. This is a QA convenience for pointing real builds at the test API and is not a customer feature.
- **Session lock (Settings).** A "lock" action locks the session behind the device's biometrics. It is a minor, internal capability.
- **Preview deep-links.** Developer-only URL parameters (`?preview=…` on the ID Scan screen and `?previewScanSheet=…` on Guest Detail) render the scan result and error states without performing a real scan, so those screens can be reviewed during development.
- **Empty-credentials behaviour.** In the released app, pressing Sign in with empty fields simply does nothing; there is no hidden shortcut that bypasses login.

## 7. Known limitations (for awareness)

- **The ±14-day window.** Home and Search only cover reservations dated from 14 days ago to 14 days ahead. There is no date-range picker and no full booking-history search.
- **Status is read-only.** Checking in or out, and any change of reservation status, is performed in the PMS, not in this app.
- **ID scanning is native-only.** Documents cannot be scanned in the browser or PWA preview.
- **The `Cancelled` and `No show` status labels** are best-effort mappings of the underlying PMS values and may need confirmation against live data.
