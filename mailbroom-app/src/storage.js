import { Preferences } from '@capacitor/preferences';


// This function takes an email address and saves it to the browser's local memory
//so if the user refreshes the app, it remembers they unsubscribed

export async function saveUnsubscribedEmail(email) {
    // Get the saved list from memory

    const { value } = await Preferences.get({ key: 'unsubscribedEmails' });
    const saved = JSON.parse(value || '[]');
    
    // Check if the email is not already in the list 
    if (!saved.includes(email)) {
        saved.push(email); // Add the new email to the list
        // Save the updated list back to memory

        await Preferences.set({
            key: 'unsubscribedEmails',
            value: JSON.stringify(saved)
        });
    }
}

// This function lets the app check if a sender has already been unsubscribed
// returns true so the app can hide them & the user doesn't see them again

export async function isAlreadyUnsubscribed(email) {
    const { value } = await Preferences.get({key: 'unsubscribedEmails'})
    const saved = JSON.parse(value || '[]');
    return saved.includes(email);
}

// If the user clicks Undo or un-unsubscribe, remove the email from the memory list

export async function removeUnsubscribedEmail(email) {
    const { value } = await Preferences.get({key: 'unsubscribedEmails'});
    let saved = JSON.parse(value || '[]');
    
    // Filter out the email we want to remove 
    saved = saved.filter(e => e !== email); 
    // Save the new list back to memory
    await Preferences.set({
        key: 'unsubscribedEmails',
        value: JSON.stringify(saved)
    });
}