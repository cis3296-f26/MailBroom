// This function takes an email address and saves it to the browser's local memory
//so if the user refreshes the app, it remembers they unsubscribed

export function saveUnsubscribedEmail(email) {
    // Get the saved list from memory
    const saved = JSON.parse(localStorage.getItem('unsubscribedEmails') || '[]');
    
    // Check if the email is not already in the list 
    if (!saved.includes(email)) {
        saved.push(email); // Add the new email to the list
        // Save the updated list back to memory
        localStorage.setItem('unsubscribedEmails', JSON.stringify(saved));
    }
}

// This function lets the app check if a sender has already been unsubscribed
// returns true so the app can hide them & the user doesn't see them again

export function isAlreadyUnsubscribed(email) {
    const saved = JSON.parse(localStorage.getItem('unsubscribedEmails') || '[]');
    return saved.includes(email);
}

// If the user clicks Undo or un-unsubscribe, remove the email from the memory list

export function removeUnsubscribedEmail(email) {
    let saved = JSON.parse(localStorage.getItem('unsubscribedEmails') || '[]');
    
    // Filter out the email we want to remove 
    saved = saved.filter(e => e !== email); 
    // Save the new list back to memory
    localStorage.setItem('unsubscribedEmails', JSON.stringify(saved));
}