document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Simulasi autentikasi - bisa diganti dengan validasi server di masa depan
    if (username === "admin" && password === "password") {
        // Simpan status login ke localStorage
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('username', username);

        // Redirect ke dashboard
        window.location.href = 'dashboard.html';
    } else {
        alert('Username atau password salah!');
    }
});