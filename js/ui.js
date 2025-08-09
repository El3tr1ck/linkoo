// NO ARQUIVO: js/ui.js
// VERSÃO COMPLETA E ATUALIZADA

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
    if (!document.getElementById('add-contact-overlay').classList.contains('hidden')) {
        document.getElementById('search-user-input').value = '';
        document.getElementById('search-results').innerHTML = '';
    }
}

function showConversationScreen() {
    document.getElementById('chat-welcome-screen').classList.add('hidden');
    document.getElementById('chat-conversation-screen').classList.remove('hidden');
}

function displaySearchResults(users) {
    const searchResultsDiv = document.getElementById('search-results');
    searchResultsDiv.innerHTML = '';
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
            toggleAddContactOverlay();
        };
        searchResultsDiv.appendChild(userDiv);
    });
}

function addUserToContactsList(chatId, otherUserData) {
    const contactList = document.getElementById('contact-list');
    if (document.getElementById(`contact-${chatId}`)) return;
    const contactDiv = document.createElement('div');
    contactDiv.className = 'contact-item';
    contactDiv.id = `contact-${chatId}`;
    contactDiv.onclick = () => setActiveChat(chatId, otherUserData);
    contactDiv.innerHTML = `
        <div id="status-${otherUserData.id}" class="status-dot offline"></div>
        <div>
            <strong>${otherUserData.username}</strong>
        </div>
    `;
    contactList.prepend(contactDiv);
    listenForStatusUpdates(otherUserData.id);
}

function updateContactStatus(userId, status) {
    const statusDot = document.getElementById(`status-${userId}`);
    if (statusDot) {
        statusDot.className = `status-dot ${status}`;
    }
}

/**
 * Exibe uma mensagem na área de chat, com rolagem automática e suporte a Markdown.
 * @param {Object} message - O objeto da mensagem.
 * @param {string} currentUserId - O ID do usuário logado.
 */
function displayMessage(message, currentUserId) {
    const messagesArea = document.getElementById('messages-area');
    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    bubble.classList.add(message.senderId === currentUserId ? 'sent' : 'received');

    if (message.text) {
        // Usa nossa nova função para converter Markdown em HTML de forma segura
        bubble.innerHTML = convertMarkdownToHtml(message.text);
    } else if (message.imageUrl) {
        bubble.innerHTML = `<img src="${message.imageUrl}" alt="Imagem enviada">`;
    }
    
    // Adiciona a nova mensagem no final da área de chat
    messagesArea.appendChild(bubble);

    // Rola a área de mensagens para o final para mostrar a mensagem mais recente
    messagesArea.scrollTop = messagesArea.scrollHeight;
}
