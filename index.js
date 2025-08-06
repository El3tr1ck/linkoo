// Importa as funções de autenticação que vamos usar
import { 
    getAuth,
    onAuthStateChanged, // Importamos o observador de estado
    GoogleAuthProvider, 
    signInWithPopup, 
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Pega a instância de autenticação que criamos no HTML
const auth = window.firebaseAuth;

// --- NOVO: VERIFICADOR DE SESSÃO ATIVA ---
// Esta função roda assim que o JS carrega
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Se o objeto 'user' existe, significa que o usuário já está logado.
        // Então, redirecionamos ele para a página principal.
        console.log("Usuário já está logado. Redirecionando para o index...");
        window.location.replace('index.html');
    }
    // Se não houver usuário, não fazemos nada e a página de login continua visível.
});


// --- O restante do código de login permanece o mesmo ---
const googleLoginBtn = document.getElementById('google-login-btn');
const emailLoginForm = document.getElementById('email-login-form');
const emailInput = document.getElementById('email-input');
const messageDiv = document.getElementById('message');

// Lógica de Login com Email (após clicar no link)
if (isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
        email = window.prompt('Por favor, digite seu e-mail para confirmar.');
    }
    signInWithEmailLink(auth, email, window.location.href)
        .then((result) => {
            window.localStorage.removeItem('emailForSignIn');
            // Não redirecionamos mais aqui, o onAuthStateChanged cuidará disso.
        })
        .catch((error) => {
            console.error(error);
            messageDiv.textContent = 'Erro ao entrar. O link pode ter expirado.';
            messageDiv.style.color = 'red';
        });
}

// Lógica de clique no botão do Google
googleLoginBtn.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch((error) => {
        console.error('Erro no login com Google:', error);
        messageDiv.textContent = 'Não foi possível fazer o login com o Google.';
        messageDiv.style.color = 'red';
    });
});

// Lógica de envio do link por e-mail
emailLoginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = emailInput.value;
    const actionCodeSettings = {
        url: window.location.href,
        handleCodeInApp: true,
    };
    sendSignInLinkToEmail(auth, email, actionCodeSettings)
        .then(() => {
            window.localStorage.setItem('emailForSignIn', email);
            messageDiv.textContent = `Link de acesso enviado para ${email}!`;
            messageDiv.style.color = 'green';
        })
        .catch((error) => {
            console.error('Erro ao enviar link:', error);
            messageDiv.textContent = 'Erro ao enviar o link. Verifique o e-mail digitado.';
            messageDiv.style.color = 'red';
        });
});
