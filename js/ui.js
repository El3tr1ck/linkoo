// Funções que alteram a UI

function showLoginScreen() {
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('chat-container').classList.add('hidden');
}

function showChatInterface() {
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('chat-container').classList.remove('hidden');
}

function toggleAddContactOverlay() {
    document.getElementById('add-contact-overlay').classList.toggle('hidden');
    // Limpa a busca anterior ao abrir
    if (!document.getElementById('add-contact-overlay').classList.contains('hidden')) {
        document.getElementById('search-user-input').value = '';
        document.getElementById('search-results').innerHTML = '';
    }
}

function showConversationScreen() {
    document.getElementById('chat-welcome-screen').classList.add('hidden');
    document.getElementById('chat-conversation-screen').classList.remove('hidden');
}

/**
 * Exibe os resultados da busca por usuários no painel.
 * @param {Array<Object>} users - Uma lista de objetos de usuário.
 */
function displaySearchResults(users) {
    const searchResultsDiv = document.getElementById('search-results');
    searchResultsDiv.innerHTML = ''; // Limpa resultados antigos

    if (users.length === 0) {
        searchResultsDiv.innerHTML = '<p>Nenhum usuário encontrado.</p>';
        return;
    }

    users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'search-result-item';
        userDiv.innerHTML = `<strong>${user.username}</strong><br><small>${user.id}</small>`;
        userDiv.onclick = () => {
            startChatWith(user);
            toggleAddContactOverlay(); // Fecha o overlay após iniciar o chat
        };
        searchResultsDiv.appendChild(userDiv);
    });
}

/**
 * Adiciona um contato à lista de conversas no painel esquerdo.
 * @param {string} chatId - O ID do chat.
 * @param {Object} otherUserData - Dados do outro usuário na conversa.
 */
function addUserToContactsList(chatId, otherUserData) {
    const contactList = document.getElementById('contact-list');
    
    // Evita adicionar contatos duplicados na UI
    if (document.getElementById(`contact-${chatId}`)) return;

    const contactDiv = document.createElement('div');
    contactDiv.className = 'contact-item';
    contactDiv.id = `contact-${chatId}`;
    contactDiv.onclick = () => {
        setActiveChat(chatId, otherUserData);
    };

    contactDiv.innerHTML = `
        <div id="status-${otherUserData.id}" class="status-dot offline"></div>
        <div>
            <strong>${otherUserData.username}</strong>
        </div>
    `;
    contactList.prepend(contactDiv); // Adiciona novas conversas no topo

    listenForStatusUpdates(otherUserData.id);
}

/**
 * Atualiza o indicador de status (bolinha verde/cinza) de um contato.
 * @param {string} userId - O ID do usuário a ser atualizado.
 * @param {string} status - O novo status ('online' ou 'offline').
 */
function updateContactStatus(userId, status) {
    const statusDot = document.getElementById(`status-${userId}`);
    if (statusDot) {
        statusDot.className = `status-dot ${status}`;
    }
}


/**
 * Exibe uma mensagem na área de chat.
 * @param {Object} message - O objeto da mensagem.
 * @param {string} currentUserId - O ID do usuário logado.
 */
function displayMessage(message, currentUserId) {
    const messagesArea = document.getElementById('messages-area');
    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    bubble.classList.add(message.senderId === currentUserId ? 'sent' : 'received');

    if (message.text) {
        bubble.innerText = message.text;
    } else if (message.imageUrl) {
        bubble.innerHTML = `<img src="${message.imageUrl}" alt="Imagem enviada">`;
    }
    
    // Insere a nova mensagem no fundo e rola para a visualização
    const isScrolledToBottom = messagesArea.scrollHeight - messagesArea.clientHeight <= messagesArea.scrollTop + 1;

    messagesArea.insertBefore(bubble, messagesArea.firstChild);

    if (isScrolledToBottom) {
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }
}
