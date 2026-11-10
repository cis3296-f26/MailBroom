# Installing MailBroom on a Mac
MailBroom does not have an Apple Developer certificate... So macOS will warn
you the first time you open it. This is a one-time step.

## 1. Download
Go to (https://github.com/cis3296-f26/MailBroom/releases),
and download the file ending in `.dmg`.

## 2. Install
Double click on the `.dmg`. A window will open with the MailBroom icon on the left and
an Applications folder on the right. Drag MailBroom onto Applications.

## 3. First open
Open your Applications folder and double-click MailBroom. macOS will stop you.
The message you receive will look something like:

### "Apple could not verify MailBroom is free of malware"
1. Click **Done**
2. Open **System Settings** -> **Privacy & Security**
3. Scroll down. You'll see a line about MailBroom being blocked, with an
   **Open Anyway** button. Click that
4. Enter your Mac password 
5. Open MailBroom from Applications again 

After this, MailBroom opens with a normal double-click every time.

### "MailBroom is damaged and can't be opened"
The app is fine... this is macOS refusing to run software that wasn't stamped
by Apple. There's no button for this one, please open Terminal and paste this, then press Return:

```bash
xattr -dr com.apple.quarantine /Applications/MailBroom.app
```

Nothing is printed if it works. Open MailBroom from Applications again.

## 4. Sign in
**You need to be added as a test user first.** MailBroom is still in Google's
testing mode. Only approved beta users can access the application. Please send your email address to the team.

Once you're added:

1. Click **Login with Google**
2. Pick your Google account
3. Google warns the app isn't verified. Click **Advanced**, then
   **Go to MailBroom (unsafe)**
4. Approve the requested access

## What MailBroom can see
It reads message headers (who sent each message and whether it offers an
unsubscribe link). MailBroom does not read the contents of your mail