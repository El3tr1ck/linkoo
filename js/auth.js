// Gera um ID único no formato especificado: 5 letras + # + número
function generateCustomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let randomChars = '';
    for (let i = 0; i < 5; i++) {
        randomChars += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const randomNumber = Math.floor(1000 + Math.random() * 9000); // Gera número de 4 dígitos
    return `${randomChars}#${randomNumber}`;
}

// Função de Login
async function loginUser(username) {
    if (!username || username.trim().length < 3) {
        alert("O nome de usuário precisa ter pelo menos 3 caracteres.");
        return;
    }

    const userId = generateCustomId();
    const userRef = database.ref('users/' + userId);

    // Salva as informações do usuário no banco de dados
    try {
        await userRef.set({
            username: username,
            id: userId,
            status: 'online', // Adicionando status de presença
            last_seen: firebase.database.ServerValue.TIMESTAMP
        });

        // Salva informações do usuário localmente para uso na sessão
        sessionStorage.setItem('currentUser', JSON.stringify({ username, id: userId }));

        // Configura a presença (online/offline)
        setupPresence(userId);

        // Muda para a tela de chat
        showChatInterface();
        loadUserChats(userId);

    } catch (error) {
        console.error("Erro ao fazer login:", error);
        alert("Não foi possível fazer o login. Tente novamente.");
    }
}

// Configura o sistema de presença
function setupPresence(userId) {
    const userStatusRef = database.ref('/users/' + userId);
    const presenceRef = database.ref('.info/connected');

    presenceRef.on('value', (snap) => {
        if (snap.val() === true) {
            // Usuário está conectado
            userStatusRef.update({ status: 'online' });

            // Se o usuário desconectar, o Firebase definirá o status para offline
            userStatusRef.onDisconnect().update({
                status: 'offline',
                last_seen: firebase.database.ServerValue.TIMESTAMP
            });
        }
    });
}
