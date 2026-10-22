# MailBroom

Initial project proposal for MailBroom, a Tinder-like email hygiene software that is hosted locally, allowing you to review and unsubscribe from unwanted Gmail communication using an intuitive swipe interface.

This project has been migrated from a Python/Flask proof-of-concept to a **cross-platform architecture** using React (Vite), Capacitor, and Electron. This stack allows the application to run natively on Desktop (Windows/macOS/Linux) and Mobile (iOS/Android) from a single codebase.

**Current Architecture Stack:**
*   **Frontend:** React (built with Vite)
*   **Desktop Wrapper:** Electron
*   **Mobile Wrapper:** Capacitor
*   **Authentication:** Google OAuth 2.0 (Google Identity Services & `google-auth-library`)
*   **Data:** Gmail API

### Features Not Yet Implemented
*   Sending the actual unsubscribe network request.
*   Spam filtering after completing an unsubscribe request.

---

## 1. Google Cloud Setup (Prerequisite)

In order to run MailBroom, you must grant the application Google OAuth 2.0 access to your Gmail metadata. Without this step, the code cannot fetch your inbox.

1. Create a project at [Google Cloud Console](https://console.cloud.google.com).
2. Enable the **Gmail API** under *APIs & Services -> Library*.
3. Under *OAuth consent screen*, configure it as **External**. Add a test Gmail address you are comfortable using under *Test users*.
4. Under *Credentials*, create a new OAuth client of type **Web application** (Do *not* select Desktop app).
5. Set the **Authorized JavaScript origins** to `http://localhost`.
6. Set the **Authorized redirect URIs** to `http://localhost/callback`.
7. Create a file named `credentials.json` in the root of the `mailbroom-app` directory and paste your keys into this exact format:

```json
{
  "CLIENT_ID": "YOUR_CLIENT_ID.apps.googleusercontent.com",
  "CLIENT_SECRET": "YOUR_CLIENT_SECRET"
}
```

> **Note:** `credentials.json` is listed in `.gitignore` and must not be committed to the repository.

---

## 2. Build Requirements

To build and run this cross-platform application, you must have the following installed on your system:
*   **Node.js** (v20 or higher recommended)
*   **npm** (comes bundled with Node.js)
*   *(Optional)* Xcode (for iOS builds) or Android Studio (for Android builds)

---

## 3. Installation & Build Instructions

Because this is a React and Electron application, you must install the JavaScript dependencies and compile the frontend assets before running.

**1. Clone the repository and install dependencies:**
```bash 
git clone https://github.com/cis3296-f26/MailBroom.git 
cd MailBroom/mailbroom-app

# Install standard React and Capacitor dependencies
npm install 

# Install specific Electron desktop dependencies
cd electron
npm install
cd ..
```

**2. Build the React Frontend and Sync to Platforms:**
Anytime you modify the React UI (`src/App.jsx`), you must rebuild the web assets and synchronize them to the native platforms (Electron, iOS, Android).

For simplicity, a desktop build & run script exists
```bash
npm run desktop
```

```bash
# Compile the React code into the /dist folder
npm run build

# Copy the compiled code into the Electron and Mobile native folders
npx cap sync
```

---

## 4. How to Run

**To run the Desktop Application (Electron):**
You must compile the Electron TypeScript backend once, and then you can launch the app.

```bash
cd electron

# Compile the Electron main process (index.ts)
npm run build

# Launch the desktop application
npx electron .
```

On the first run, clicking **Login with Google** will open a secure OAuth window. Google will display a warning because the app is in testing mode—choose "Advanced" and "Continue". The application handles the OAuth redirect locally and securely stores the session token.

**To run for Web Development (React only):**
If you are strictly designing the UI and want live-reloading in your browser without the Electron wrapper:
```bash
npm run dev
```