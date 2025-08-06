// Importações do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
// NOVO: Precisamos de mais funções do Firestore
import { getFirestore, doc, getDoc, setDoc, query, collection, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const onboardingMessage = document.getElementById('onboarding-message'); // NOVO: Para mensagens de erro

// --- LÓGICA PRINCIPAL ---

onAuthStateChanged(auth, (user) => {
    if (user) {
        const userDocRef = doc(db, "users", user.uid);
        getDoc(userDocRef).then(docSnap => {
            if (docSnap.exists()) {
                showApp(docSnap.data());
            } else {
                showOnboarding();
            }
        });
    } else {
        window.location.replace('login.html');
    }
});

function showApp(userData) {
    onboardingPanel.style.display = 'none';
    appContent.style.display = 'block';
    userDisplayName.textContent = userData.username;
    userDisplayName.style.color = userData.username_color;
}

function showOnboarding() {
    appContent.style.display = 'none';
    onboardingPanel.style.display = 'flex';
}

logoutBtn.addEventListener('click', () => {
    signOut(auth).catch(error => console.error("Erro ao sair:", error));
});

// --- LÓGICA DO FORMULÁRIO (VERSÃO DE TESTE SIMPLIFICADA) ---
onboardingForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const user = auth.currentUser;
    if (!user) return;

    const username = document.getElementById('username').value.trim();
    const color = document.getElementById('color').value;

    const submitButton = onboardingForm.querySelector('button');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';
    onboardingMessage.textContent = '';

    try {
        // CÓDIGO TEMPORARIAMENTE DESATIVADO PARA TESTE
        // console.log("Verificação de username pulada para o teste.");
        
        // PASSO 1: Preparar os dados para salvar
        const userProfile = {
            uid: user.uid,
            username: username,
            username_color: color,
            email: user.email,
            profile_picture_url: user.photoURL || null,
            contacts: []
        };

        // PASSO 2: Criar o documento diretamente!
        await setDoc(doc(db, "users", user.uid), userProfile);

        // PASSO 3: Tudo certo! Mostrar o aplicativo.
        showApp(userProfile);

    } catch (error) {
        console.error("Erro ao criar perfil (versão de teste): ", error);
        onboardingMessage.textContent = error.message;

        submitButton.disabled = false;
        submitButton.textContent = 'Salvar e Entrar';
    }
});
