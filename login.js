// Importa as funções de autenticação que vamos usar
import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect, // Adicionado para a outra solução, mas não tem problema estar aqui
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Pega a instância de autenticação que criamos no HTML
const auth = window.firebaseAuth;

// --- Seleciona os elementos do HTML ---
const googleLoginBtn = document.getElementById('google-login-btn');
const emailLoginForm = document.getElementById('email-login-form');
const emailInput = document.getElementById('email-input');
const messageDiv = document.getElementById('message');

// --- Lógica de Login ---

// 1. VERIFICAR SE O USUÁRIO CLICOU NO LINK DO E-MAIL
// Esta parte roda assim que a página carrega para finalizar o login por link
if (isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
        email = window.prompt('Por favor, digite seu e-mail para confirmar o login.');
    }

    signInWithEmailLink(auth, email, window.location.href)
        .then((result) => {
            window.localStorage.removeItem('emailForSignIn');
            window.location.href = 'index.html'; // Redireciona para a página principal
        })
        .catch((error) => {
            console.error(error);
            messageDiv.textContent = 'Erro ao entrar. O link pode ser inválido ou ter expirado.';
            messageDiv.style.color = 'red';
        });
}

// 2. LOGIN COM GOOGLE (usando Popup)
googleLoginBtn.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();

    signInWithPopup(auth, provider)
        .then((result) => {
            console.log('Usuário logado com Google:', result.user);
            window.location.href = 'index.html'; // Redireciona para a página principal
        })
        .catch((error) => {
            console.error('Erro no login com Google:', error);
            messageDiv.textContent = 'Não foi possível fazer o login com o Google.';
            messageDiv.style.color = 'red';
        });
});

// 3. ENVIAR LINK DE LOGIN PARA O E-MAIL
emailLoginForm.addEventListener('submit', (event) => {
    // ESTA É A LINHA MAIS IMPORTANTE PARA O PROBLEMA DE RECARREGAMENTO
    event.preventDefault(); 

    const email = emailInput.value;
    const actionCodeSettings = {
        url: window.location.origin + '/login.html', // Usar window.location.origin para ser mais robusto
        handleCodeInApp: true,
    };

    sendSignInLinkToEmail(auth, email, actionCodeSettings)
        .then(() => {
            window.localStorage.setItem('emailForSignIn', email);
            messageDiv.textContent = `Link de acesso enviado para ${email}! Verifique sua caixa de entrada.`;
            messageDiv.style.color = 'green';
            emailLoginForm.reset(); // Limpa o campo do email após o envio
        })
        .catch((error) => {
            console.error('Erro ao enviar link:', error);
            messageDiv.textContent = 'Erro ao enviar o link. Verifique o e-mail digitado.';
            messageDiv.style.color = 'red';
        });
});
