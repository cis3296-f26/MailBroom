"""
The basic proof of concept for MailBroom

SHows the following working together to make the initial part of this project possible:
Flask for the local web interface, Google OAuth 2.0 for authorization, and the Gmail API for
reading message metadata. This fetches headers only, groups all of the messages by sender and extracts the list
unsubscribe header
"""

import os
import re
from collections import defaultdict

from flask import Flask
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
LIMIT = 50

app = Flask(__name__)

# this function follows google's official gmail API python quickstart pattern
def get_service():
    """authorize with google and return a Gmail API client."""
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    else:
        flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
        creds = flow.run_local_server(port=0)
        with open("token.json", "w") as f:
            f.write(creds.to_json())
    return build("gmail", "v1", credentials=creds)


def collect_senders(service):
    """Scan recent messages and count them by sender."""
    senders = defaultdict(lambda: {"total": 0, "unread": 0})

    listing = service.users().messages().list(userId="me", maxResults=LIMIT).execute()

    for stub in listing.get("messages", []):
        msg = service.users().messages().get(
            userId="me",
            id=stub["id"],
            format="metadata",
            metadataHeaders=["From", "List-Unsubscribe"],
        ).execute()

        headers = {h["name"].lower(): h["value"] for h in msg["payload"]["headers"]}

        #only the senders with an unsubscribe header can be acted on
        if "list-unsubscribe" not in headers:
            continue

        match = re.search(r"<([^>]+@[^>]+)>", headers.get("from", ""))
        address = match.group(1).lower() if match else headers.get("from", "")

        senders[address]["total"] += 1
        if "UNREAD" in msg.get("labelIds", []):
            senders[address]["unread"] += 1

    return senders


@app.route("/")
def index():
    senders = collect_senders(get_service())
    rows = ""
    for address, stats in sorted(senders.items(), key=lambda s: -s[1]["total"]):
        read = stats["total"] - stats["unread"]
        rows += f"<li><b>{address}</b> - {stats['total']} messages, {read} opened</li>"
    return f"<h1>MailBroom</h1><p>Senders you can unsubscribe from:</p><ul>{rows}</ul>"


if __name__ == "__main__":
    #the app is bound to localhost so the interface is only reachable from this machine.
    app.run(host="127.0.0.1", port=5000)
