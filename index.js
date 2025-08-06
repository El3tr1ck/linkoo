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

// --- LÓGICA DO FORMULÁRIO DE CADASTRO (AGORA PREENCHIDA) ---
onboardingForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const user = auth.currentUser;
    if (!user) return; // Segurança extra

    const username = document.getElementById('username').value.trim();
    const color = document.getElementById('color').value;

    // NOVO: Adicionando feedback de carregamento
    const submitButton = onboardingForm.querySelector('button');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';
    onboardingMessage.textContent = '';

    try {
        // **PASSO 1: Verificar se o nome de usuário já existe**
        // Criamos uma "query" (consulta) para procurar na coleção 'users'
        // por qualquer documento que já tenha o campo 'username' igual ao escolhido.
        const q = query(collection(db, "users"), where("username", "==", username));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Se a consulta não voltou vazia, o nome já existe!
            throw new Error("Este nome de usuário já está em uso. Tente outro.");
        }

        // **PASSO 2: Preparar os dados para salvar**
        const userProfile = {
            uid: user.uid,
            username: username,
            username_color: color,
            email: user.email,
            // Usamos a foto do Google se existir, senão, deixamos nulo por enquanto.
            profile_picture_url: user.photoURL || null, 
            contacts: [] // Lista de contatos começa vazia
        };

        // **PASSO 3: Criar o documento!**
        // Usamos setDoc para criar o documento com o ID sendo o UID do usuário.
        await setDoc(doc(db, "users", user.uid), userProfile);

        // **PASSO 4: Tudo certo! Mostrar o aplicativo.**
        showApp(userProfile);

    } catch (error) {
        // Se qualquer coisa der errado (nome de usuário já existe, etc.)
        console.error("Erro ao criar perfil: ", error);
        onboardingMessage.textContent = error.message;

        // Re-habilita o botão para o usuário tentar de novo
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar e Entrar';
    }
});
