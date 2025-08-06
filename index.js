// Importações do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Sua configuração do Firebase (a mesma do login.html)
const firebaseConfig = {
    apiKey: "AIzaSyCW2cEHzn6r9j9_hlpMfADkTbGp7aD03k4",
    authDomain: "linko-4f252.firebaseapp.com",
    projectId: "linko-4f252",
    storageBucket: "linko-4f252.firebasestorage.app",
    messagingSenderId: "731596149941",
    appId: "1:731596149941:web:a9e4545cc9fc5762b75afc",
    measurementId: "G-6E05TEQXCE"
};

// Inicializando Firebase e seus serviços
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Selecionando os elementos do HTML
const onboardingPanel = document.getElementById('onboarding-panel');
const appContent = document.getElementById('app-content');
const onboardingForm = document.getElementById('onboarding-form');
const userDisplayName = document.getElementById('user-display-name');
const logoutBtn = document.getElementById('logout-btn');

// --- LÓGICA PRINCIPAL ---

// O "Recepcionista" que verifica o estado do login
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuário está logado. Vamos verificar se ele tem perfil.
        const userDocRef = doc(db, "users", user.uid);

        getDoc(userDocRef).then(docSnap => {
            if (docSnap.exists()) {
                // O perfil JÁ EXISTE. O recepcionista encontrou a ficha.
                console.log("Usuário já tem perfil:", docSnap.data());
                showApp(docSnap.data());
            } else {
                // NOVO USUÁRIO. O recepcionista não encontrou a ficha.
                console.log("Novo usuário, mostrar painel de cadastro.");
                showOnboarding();
            }
        });
    } else {
        // Usuário não está logado. Redirecionar para a página de login.
        window.location.replace('login.html');
    }
});

// Função para mostrar o app principal
function showApp(userData) {
    onboardingPanel.style.display = 'none';
    appContent.style.display = 'block';
    userDisplayName.textContent = userData.username;
    userDisplayName.style.color = userData.username_color;
}

// Função para mostrar o painel de cadastro
function showOnboarding() {
    appContent.style.display = 'none';
    onboardingPanel.style.display = 'flex';
}

// Lógica do botão de Sair (Logout)
logoutBtn.addEventListener('click', () => {
    signOut(auth).catch(error => console.error("Erro ao sair:", error));
});


// --- LÓGICA DO FORMULÁRIO DE CADASTRO (o próximo passo) ---
onboardingForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Previne o recarregamento da página

    // (O código para salvar os dados virá aqui no próximo passo)
    console.log("Formulário enviado!");
});
