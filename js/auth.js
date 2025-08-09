function generateCustomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let randomChars = '';
    for (let i = 0; i < 5; i++) {
        randomChars += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const randomNumber = Math.floor(1000 + Math.random() * 9000);
    return `${randomChars}-${randomNumber}`; 
}

async function loginUser(username) {
    if (!username || username.trim().length < 3) {
        alert("O nome de usuário precisa ter pelo menos 3 caracteres.");
        return;
    }

    const userId = generateCustomId();
    const userRef = database.ref('users/' + userId);

    const userData = {
        username: username,
        id: userId,
        status: 'online',
        last_seen: firebase.database.ServerValue.TIMESTAMP,
        joinDate: firebase.database.ServerValue.TIMESTAMP, // DATA DE ENTRADA
        bio: '',
        links: {},
        ratings: {},
        avgRating: 0,
        ratingCount: 0
    };

    try {
        await userRef.set(userData);
        
        sessionStorage.setItem('currentUser', JSON.stringify(userData)); // Salva todos os dados
        
        setupPresence(userId);
        showChatInterface();
        loadUserChats(userId);

    } catch (error) {
        console.error("Erro Crítico no Login:", error);
        alert("Falha ao conectar: " + error.message);
    }
}

// NOVA FUNÇÃO DE LOGIN COM GOOGLE
async function linkGoogleAccount() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await firebase.auth().signInWithPopup(provider);
        const googleUser = result.user;
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));

        if (!currentUser) {
            alert("Erro: não há usuário local para vincular a conta.");
            return;
        }

        const updates = {
            googleUID: googleUser.uid,
            email: googleUser.email
        };

        // Atualiza no Firebase
        await database.ref('users/' + currentUser.id).update(updates);

        // Atualiza na sessão local
        const updatedUser = { ...currentUser, ...updates };
        sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));

        alert("Conta do Google vinculada com sucesso!");
        // Reabre o painel de identidade para mostrar as informações atualizadas
        const profileOverlay = document.getElementById('profile-overlay');
        toggleOverlay('profile-overlay', false);
        setTimeout(() => {
             toggleOverlay('profile-overlay', true, () => buildProfilePanel(currentUser.id));
        }, 100);
       
    } catch (error) {
        console.error("Erro ao vincular conta do Google:", error);
        alert("Falha ao vincular conta: " + error.message);
    }
}

function setupPresence(userId) {
    const userStatusRef = database.ref('/users/' + userId);
    const presenceRef = database.ref('.info/connected');

    presenceRef.on('value', (snap) => {
        if (snap.val() === true) {
            userStatusRef.update({ status: 'online' });
            userStatusRef.onDisconnect().update({
                status: 'offline',
                last_seen: firebase.database.ServerValue.TIMESTAMP
            });
        }
    });
}
