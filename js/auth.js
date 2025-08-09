// NO ARQUIVO: js/auth.js
// VERSÃO CORRIGIDA E COMPLETA

/**
 * Gera um ID customizado no formato: 5 letras + - + 4 números.
 * @returns {string} O ID gerado.
 */
function generateCustomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let randomChars = '';
    for (let i = 0; i < 5; i++) {
        randomChars += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const randomNumber = Math.floor(1000 + Math.random() * 9000);
    
    // LINHA CORRIGIDA: Usa um hífen "-", que é um caractere válido.
    return `${randomChars}-${randomNumber}`; 
}

/**
 * Realiza o login do usuário, criando um registro no banco de dados.
 * @param {string} username - O nome de usuário escolhido.
 */
async function loginUser(username) {
    if (!username || username.trim().length < 3) {
        alert("O nome de usuário precisa ter pelo menos 3 caracteres.");
        return;
    }

    const userId = generateCustomId(); // Agora gera um ID válido, como "AdfCQ-1234"
    const userRef = database.ref('users/' + userId);

    const userData = {
        username: username,
        id: userId,
        status: 'online',
        last_seen: firebase.database.ServerValue.TIMESTAMP
    };

    try {
        await userRef.set(userData);
        
        sessionStorage.setItem('currentUser', JSON.stringify({ username, id: userId }));
        
        setupPresence(userId);
        showChatInterface();
        loadUserChats(userId);

    } catch (error) {
        console.error("Erro ao fazer login:", error);
        alert("Não foi possível conectar. Verifique sua configuração do Firebase e a conexão com a internet.");
    }
}

/**
 * Configura o sistema de presença para atualizar o status do usuário (online/offline).
 * @param {string} userId - O ID do usuário atual.
 */
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
