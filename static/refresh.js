// Remember the broom click across the page reload, then show confirmation once.
if (sessionStorage.getItem('mailbroom-refreshed') === 'true') {
    sessionStorage.removeItem('mailbroom-refreshed');

    const status = document.getElementById('refresh-status');
    status.hidden = false;

    setTimeout(() => {
        status.hidden = true;
    }, 3000);
}
