// Iniciar uma conversa com um usuário
function startChatWith(otherUser) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    
    // Cria um ID de chat único e ordenado para que seja o mesmo para ambos os usuários
    const chatID = [currentUser.id, otherUser.id].sort().join('_');
    
    const chatRef = database.ref('chats/' + chatID);
    
    // Adiciona o chat na lista de chats de ambos os usuários
    database.ref(`user_chats/${currentUser.id}/${chatID}`).set({
        withUsername: otherUser.username,
        withUserId: otherUser.id
    });
    database.ref(`user_chats/${otherUser.id}/${chatID}`).set({
        withUsername: currentUser.username,
        withUserId: currentUser.id
    });

    // Abre a janela de chat
    loadChat(chatID, otherUser.username, otherUser.id);
}

// Carrega as mensagens de um chat específico
function loadChat(chatID, otherUsername, otherUserId) {
    // Atualiza o cabeçalho
    document.getElementById('chat-header-info').innerHTML = `<h2>${otherUsername} <small>(${otherUserId})</small></h2>`;

    const messagesArea = document.getElementById('messages-area');
    messagesArea.innerHTML = ''; // Limpa mensagens antigas
    
    const messagesRef = database.ref('chats/' + chatID).orderByChild('timestamp').limitToLast(50);
    
    messagesRef.on('child_added', (snapshot) => {
        const message = snapshot.val();
        displayMessage(message);
    });
}

// Exibe uma única mensagem na tela
function displayMessage(message) {
    const messagesArea = document.getElementById('messages-area');
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));

    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    bubble.classList.add(message.senderId === currentUser.id ? 'sent' : 'received');

    // Suporte a Markdown
    // A biblioteca 'marked' converte o texto em Markdown para HTML
    if (message.text) {
        bubble.innerHTML = marked.parse(message.text);
    } else if (message.imageUrl) { // Exibe a imagem
        bubble.innerHTML = `<img src="${message.imageUrl}" alt="Imagem enviada" style="max-width: 100%;">`;
    }

    messagesArea.prepend(bubble); // Adiciona no início por causa do flex-direction: column-reverse
}


// Envia uma mensagem de texto
function sendTextMessage(chatID) {
    const messageInput = document.getElementById('message-input');
    const text = messageInput.value.trim();

    if (text === '') return;

    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const message = {
        senderId: currentUser.id,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    database.ref('chats/' + chatID).push(message);
    messageInput.value = '';
}

// Busca por usuários
function searchUsers(query) {
    const usersRef = database.ref('users');
    const searchResultsDiv = document.getElementById('search-results');
    searchResultsDiv.innerHTML = '';

    usersRef.orderByChild('username').startAt(query).endAt(query + '\uf8ff').once('value', snapshot => {
        snapshot.forEach(childSnapshot => {
            const user = childSnapshot.val();
            const userDiv = document.createElement('div');
            userDiv.innerHTML = `<p>${user.username}</p><small>${user.id}</small>`;
            userDiv.onclick = () => startChatWith(user);
            searchResultsDiv.appendChild(userDiv);
        });
    });
}
