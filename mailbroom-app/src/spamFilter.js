const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

export async function moveSenderToSpam(token, email) {
  try {
    const res = await fetch(`${GMAIL}/settings/filters`, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        criteria: {
          from: email
        },
        action: {
          removeLabelIds: ['INBOX'] // <--- ONLY REMOVE FROM INBOX
        }
      })
    });
    
    const data = await res.json();
    if (res.ok) {
      console.log("Spam filter created successfully for:", email);
      return true;
    } else {
      console.error(' Gmail API Error Reason:', JSON.stringify(data.error)); 
      return false;
    }
  } catch (err) {
    console.error(' Error creating spam filter:', err);
    return false;
  }
}