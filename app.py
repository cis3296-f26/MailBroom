"""
The basic proof of concept for MailBroom

Shows the following working together to make the initial part of this project possible:
Flask for the local web interface, Google OAuth for authorization, and the Gmail API for
reading message metadata. This fetches headers only, groups all of the messages by sender and extracts the list
unsubscribe header
"""

import os
import re
from collections import defaultdict

from flask import Flask, request
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

def get_sender_view(senders, limit = -1):
    #Sort senders
    senderDisplay = sorted(senders.items(), key=lambda s: -s[1]["total"])
    #Limit senders display to limit, by default -1 (no limit)
    if limit > 0: 
        senderDisplay = senderDisplay[:limit]

    return senderDisplay

@app.route("/")
def index():
    display_limit = request.args.get("limit", default=-1, type=int)

    senders = collect_senders(get_service())
    count=len(senders)   
    total_msgs = sum(s["total"] for s in senders.values())
    rows = ""
    for address, stats in get_sender_view(senders, display_limit):
        read = stats["total"] - stats["unread"] 
        tag = " <span style='color: #b45309; font-size: 0.85em;'>never opened</span>" if read == 0 else ""
        rows += f"<li style='margin-bottom: 10px;'><b style='color: #D2042D;'>{address}</b>{tag}<br><span style='color: #000000;'>{stats['total']} messages, {read} opened</span></li>"

    form_html = f"""
        <form method="GET" action="/">
            <label for="limit">Visible Senders:</label>
            <input type="number" id="limit" name="limit" value="{display_limit}" min="1">
            <button type="submit">Update</button>
        </form>
        <hr>
    """

    return f"""

    <div style="position: fixed; top: 20px; right: 20px; z-index: 9999;">
        <img src="/static/button.png" alt="Close App" onclick="window.close();" style="cursor: pointer; width: 150px;" />
    </div>

    
    <div style="padding: 10px 0;">
        <img src="/static/mailbroomlogo.png"
            alt="MailBroom Logo"
            style="width: 250px; height: auto;">
    </div>
    {form_html}
    <p><u>{count} senders across {total_msgs} messages:</u></p>
    <ul>{rows}</ul>
    """
      
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)
    
    