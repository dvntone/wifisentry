document.addEventListener('DOMContentLoaded', () => {
    const twoFactorForm = document.getElementById('2fa-form');
    const errorMessageDiv = document.getElementById('error-message');

    twoFactorForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessageDiv.textContent = '';

        const token = twoFactorForm.token.value;

        try {
            const response = await fetch('/api/auth/2fa/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token }),
            });

            if (response.ok) {
                window.location.href = '/dashboard.html';
            } else {
                const data = await response.json();
                errorMessageDiv.textContent = data.message || 'Verification failed. Please try again.';
            }
        } catch (error) {
            console.error('2FA verification error:', error);
            errorMessageDiv.textContent = 'An error occurred. Please check the console.';
        }
    });
});