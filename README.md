# MailBroom
Initial project proposal for MailBroom, tinder-like email hygiene software that is hosted locally allowing the review and unsubscribing from unwanted Gmail communication.

The proof of concept for the project proposal is intended to show how the stack works together:
- Flask serves an interface hosted locally that opens in browser
- Google OAuth 2.0 handles authorization
- The Gmail API returns message metadata

Parts of the full project that are not implemented here
- The interactive swipe interface that makes the project fun and tinder like
- sending unsubscribe request
- spam filtering after completing an unsubscribe request 

In order to interpret the Python code, we must complete a Google cloud setup to grant GoogleOAuth 2.0 access to our Gmail metadata. Without this step, the code is effectively useless as it does not have a Gmail inbox to process. 

# Google cloud setup
Video tutorial to make things easier: https://www.loom.com/share/be5a43789fe842c2b9cadb31cf1890b2

Create a project at https://console.cloud.google.com
Enable the Gmail API under APIs & Services -> library
Under Google Auth Platform, configure the consent screen as external and add your own Gmail address under Audience (that you are comfortable with using for this test) -> Test users
Under clients, create an OAuth client of type Desktop app
Download the JSON file, rename it to 'credentials.json', and place it in the root of this repository

`credentials.json` and `token.json` are listed in `.gitignore` and must not be committed.

## Now we need to install and run the program 

```bash 
git clone https://github.com/cis3296-f26/MailBroom.git 

cd MailBroom 

python3 -m venv venv

source venv/bin/activate

pip install -r requirements.txt 

python3 app.py
```

Then open http://127.0.0.1:5000 in a browser.

On the first run, the browser window will open and ask you to authorize access to your Gmail account. Google displays a warning, choose "Advanced and continue". The token is saved to `token.json` so later runs do not prompt.

The OAuth flow in `get_service()` follows Google's Gmail API Python quickstart: https://developers.google.com/gmail/api/quickstart/python

## Environment
- Operating system: macOS 26.5.2
- Python: 3.14.6
- Framework: Flask 3.1.3
