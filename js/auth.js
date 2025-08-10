// --- START OF FILE auth.js --- (CORRIGIDO PARA SUAS REGRAS)

// Função para fazer o login/registro do usuário
async function loginUser(username) {
    if (!username || username.trim().length < 3) {
        alert("O nome de usuário deve ter pelo menos 3 caracteres.");
        return;
    }

    try {
        // Passo 1: Realiza o login anônimo com o Firebase Auth para obter um `auth` e `auth.uid`
        const userCredential = await firebase.auth().signInAnonymously();
        const user = userCredential.user;
        console.log("Usuário autenticado anonimamente, UID:", user.uid);

        // Passo 2: Cria o objeto de dados do usuário, garantindo que todos os campos
        // exigidos pela sua regra ".validate" estejam presentes.
        const userData = {
            id: user.uid, // Satisfaz a validação "id"
            username: username, // Satisfaz a validação "username"
            status: 'online', // Satisfaz a validação "status"
            createdAt: firebase.database.ServerValue.TIMESTAMP, // Satisfaz a validação "createdAt"
            last_seen: firebase.database.ServerValue.TIMESTAMP // Satisfaz a validação "last_seen"
        };

        // Passo 3: Agora que `auth` não é nulo e `auth.uid` é igual ao ID do usuário,
        // a escrita será permitida pelas suas regras de segurança.
        await database.ref('users/' + user.uid).set(userData);

        // Passo 4: Salva os dados no localStorage para manter o usuário logado na página
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        // Passo 5: Inicia a interface do chat e a gestão de presença
        setupPresence(user.uid);
        showChatInterface();
        loadUserChats(user.uid);

    } catch (error) {
        console.error("Erro Crítico no Login:", error);
        alert("Não foi possível fazer o login. Verifique o console para mais detalhes. O erro mais comum é não ter habilitado a 'Autenticação Anônima' no painel do Firebase.");
    }
}

// Função para gerenciar o status de presença (online/offline) e o 'last_seen'
function setupPresence(userId) {
    const userStatusRef = database.ref('/users/' + userId);
    const presenceRef = database.ref('.info/connected');

    presenceRef.on('value', (snapshot) => {
        if (snapshot.val() === false) {
            // Se o SDK detectar que não está conectado, apenas atualiza o status.
            // O onDisconnect cuidará disso de forma mais robusta.
            userStatusRef.update({ status: 'offline' });
            return;
        }

        // Quando a conexão for perdida (ex: fechar o navegador), o Firebase definirá o status
        // como 'offline' e atualizará o 'last_seen'. Isso é executado pelo servidor do Firebase.
        userStatusRef.onDisconnect().update({ 
            status: 'offline',
            last_seen: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            // Quando a conexão é estabelecida (ou reestabelecida), define o status como online
            // e atualiza o 'last_seen'.
            userStatusRef.update({ 
                status: 'online',
                last_seen: firebase.database.ServerValue.TIMESTAMP
            });
        });
    });
}
