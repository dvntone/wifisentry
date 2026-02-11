document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessageDiv = document.getElementById('error-message');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessageDiv.textContent = '';

        const username = loginForm.username.value;
        const password = loginForm.password.value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                if (data.twoFactorRequired) {
                    window.location.href = '/2fa-verify.html';
                } else {
                    window.location.href = '/dashboard.html';
                }
            } else {
                errorMessageDiv.textContent = data.message || 'Login failed. Please try again.';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorMessageDiv.textContent = 'An error occurred. Please check the console.';
        }
    });
});