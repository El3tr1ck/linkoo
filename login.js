// Importa as funções de autenticação que vamos usar
import { 
    GoogleAuthProvider, 
    signInWithPopup, 
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
// Isso roda assim que a página carrega
if (isSignInWithEmailLink(auth, window.location.href)) {
    // Pega o email que salvamos no navegador antes de enviar o link
    let email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
        // Se não encontrar o email, pede para o usuário digitar de novo
        email = window.prompt('Por favor, digite seu e-mail para confirmar.');
    }

    // Tenta fazer o login com o link
    signInWithEmailLink(auth, email, window.location.href)
        .then((result) => {
            // Sucesso! Limpa o email do armazenamento e redireciona
            window.localStorage.removeItem('emailForSignIn');
            window.location.href = 'index.html'; // Redireciona para a página principal
        })
        .catch((error) => {
            console.error(error);
            messageDiv.textContent = 'Erro ao entrar. O link pode ter expirado.';
            messageDiv.style.color = 'red';
        });
}

// 2. LOGIN COM GOOGLE
googleLoginBtn.addEventListener('click', () => {
    const provider = new GoogleAuthProvider(); // Cria o provedor do Google

    signInWithRedirect(auth, provider);
        .then((result) => {
            // Sucesso! O usuário está logado
            console.log('Usuário logado com Google:', result.user);
            window.location.href = 'index.html'; // Redireciona para a página principal
        })
        .catch((error) => {
            // Trata os erros aqui
            console.error('Erro no login com Google:', error);
            messageDiv.textContent = 'Não foi possível fazer o login com o Google.';
            messageDiv.style.color = 'red';
        });
});

// 3. ENVIAR LINK DE LOGIN PARA O E-MAIL
emailLoginForm.addEventListener('submit', (event) => {
    event.preventDefault(); // Impede que a página recarregue

    const email = emailInput.value;
    
    // Configurações do link que será enviado
    const actionCodeSettings = {
        // A URL que o usuário será redirecionado após clicar no link do email.
        // Ele voltará para esta mesma página (login.html) para a gente finalizar o login.
        url: window.location.href,
        handleCodeInApp: true, // Essencial!
    };

    sendSignInLinkToEmail(auth, email, actionCodeSettings)
        .then(() => {
            // Salva o email no armazenamento do navegador.
            // Precisamos dele quando o usuário voltar para a página.
            window.localStorage.setItem('emailForSignIn', email);
            
            messageDiv.textContent = `Link de acesso enviado para ${email}! Verifique sua caixa de entrada.`;
            messageDiv.style.color = 'green';
        })
        .catch((error) => {
            console.error('Erro ao enviar link:', error);
            messageDiv.textContent = 'Erro ao enviar o link. Verifique o e-mail digitado.';
            messageDiv.style.color = 'red';
        });
});
