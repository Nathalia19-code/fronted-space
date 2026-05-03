document.addEventListener('DOMContentLoaded', () => {
    
    // Referencias a los elementos del DOM
    const loginForm = document.getElementById('login-form');
    const btnGoogle = document.getElementById('btn-google-login');

    /* =========================================================
       MECANISMO 1: LOGIN TRADICIONAL (Email + Contraseña)
       ========================================================= */
    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            // Prevenimos que el formulario recargue la página (comportamiento por defecto)
            event.preventDefault(); 

            // Capturamos los datos introducidos
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            console.log(`Intentando iniciar sesión con: ${email}`);

            // ---------------------------------------------------------
            // TFG NOTA: Aquí irá la llamada a la API de Spring Boot
            // Ejemplo futuro: 
            // fetch('http://localhost:8080/api/auth/login', {
            //     method: 'POST',
            //     body: JSON.stringify({ email, password })
            // })
            // ---------------------------------------------------------

            // Simulación de respuesta exitosa del backend:
            // Redirigimos al usuario a la aplicación principal
            window.location.href = 'index.html'; 
        });
    }

    /* =========================================================
       MECANISMO 2: LOGIN SOCIAL (Google)
       ========================================================= */
    if (btnGoogle) {
        btnGoogle.addEventListener('click', (event) => {
            event.preventDefault();
            
            console.log('Iniciando flujo de autenticación con Google...');
            
            // ---------------------------------------------------------
            // TFG NOTA: Aquí se integrará Firebase Auth o Google Identity Services.
            // Es decir, al hacer clic, se abrirá el popup oficial de Google.
            // ---------------------------------------------------------

            // Simulación de redirección tras autenticación exitosa:
            window.location.href = 'index.html';
        });
    }
});