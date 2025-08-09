// NO ARQUIVO: js/auth.js (VERSÃO DE DEPURAÇÃO)

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
    console.log("--- DEBUG: INICIANDO PROCESSO DE LOGIN ---");

    if (!username || username.trim().length < 3) {
        console.log("--- DEBUG: Falha na validação do nome de usuário.");
        alert("O nome de usuário precisa ter pelo menos 3 caracteres.");
        return;
    }
    console.log("1. Validação do nome OK. Nome:", username);

    const userId = generateCustomId();
    console.log("2. ID gerado:", userId);
    
    const userRef = database.ref('users/' + userId);
    const userData = {
        username: username,
        id: userId,
        status: 'online',
        last_seen: firebase.database.ServerValue.TIMESTAMP
    };

    try {
        console.log("3. Tentando escrever no Firebase...");
        await userRef.set(userData);
        console.log("4. Escrita no Firebase BEM-SUCEDIDA!");

        sessionStorage.setItem('currentUser', JSON.stringify({ username, id: userId }));
        
        console.log("5. Configurando presença...");
        setupPresence(userId);
        
        console.log("6. Mostrando interface do chat...");
        showChatInterface();
        loadUserChats(userId);
        console.log("--- DEBUG: PROCESSO DE LOGIN CONCLUÍDO ---");

    } catch (error) {
        console.error("--- DEBUG: ERRO CRÍTICO NO LOGIN ---", error);
        alert("FALHA AO CONECTAR: " + error.message);
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
