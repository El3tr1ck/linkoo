// Variável para guardar o estado do chat ativo
let activeChat = {
    id: null,
    withUsername: null,
    withUserId: null
};

/**
 * Define o chat ativo, atualiza a UI e carrega as mensagens.
 * @param {string} chatId - O ID do chat que se tornou ativo.
 * @param {Object} otherUser - Dados do outro usuário.
 */
function setActiveChat(chatId, otherUser) {
    activeChat.id = chatId;
    activeChat.withUsername = otherUser.username;
    activeChat.withUserId = otherUser.id;

    // Remove a classe 'active' de todos os outros contatos
    document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
    // Adiciona a classe 'active' ao contato clicado
    document.getElementById(`contact-${chatId}`).classList.add('active');

    // Atualiza o cabeçalho do chat
    document.getElementById('chat-header-username').innerText = otherUser.username;
    document.getElementById('chat-header-userid').innerText = otherUser.id;

    showConversationScreen();
    loadChatMessages(chatId);
    document.getElementById('message-input').focus();
}

// Executa quando o conteúdo da página estiver totalmente carregado
document.addEventListener('DOMContentLoaded', () => {

    // --- Seletores de Elementos ---
    const loginButton = document.getElementById('login-button');
    const usernameInput = document.getElementById('username-input');
    const addContactButton = document.getElementById('add-contact-button');
    const closeOverlayButton = document.getElementById('close-overlay-button');
    const searchUserInput = document.getElementById('search-user-input');
    const sendMessageButton = document.getElementById('send-message-button');
    const messageInput = document.getElementById('message-input');
    const fileMenuButton = document.getElementById('file-menu-button');
    const sendPhotoButton = document.getElementById('send-photo-button');

    // Verifica se já existe um usuário na sessão para manter logado
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        const userData = JSON.parse(savedUser);
        setupPresence(userData.id);
        showChatInterface();
        loadUserChats(userData.id);
    }

    // --- Event Listeners ---
    
    // Login
    loginButton.addEventListener('click', () => loginUser(usernameInput.value));
    usernameInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') loginUser(usernameInput.value);
    });

    // Abrir/Fechar Overlay de Busca
    addContactButton.addEventListener('click', toggleAddContactOverlay);
    closeOverlayButton.addEventListener('click', toggleAddContactOverlay);

    // Busca de Usuários
    searchUserInput.addEventListener('keyup', () => {
        const query = searchUserInput.value.trim();
        if (query.length > 2) {
            searchUsers(query);
        } else {
            document.getElementById('search-results').innerHTML = '';
        }
    });

    // Envio de Mensagem
    sendMessageButton.addEventListener('click', () => {
        const text = messageInput.value.trim();
        if (text && activeChat.id) {
            sendTextMessage(activeChat.id, text);
            messageInput.value = '';
            messageInput.style.height = 'auto'; // Reseta a altura
        }
    });

    messageInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessageButton.click();
        }
    });
    // Auto-ajuste de altura da caixa de texto
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
    });
    
    // Menu de Arquivos
    fileMenuButton.addEventListener('click', () => {
        document.getElementById('file-options').classList.toggle('hidden');
    });

    sendPhotoButton.addEventListener('click', () => {
        if (activeChat.id) {
            handlePhotoUpload(activeChat.id);
        }
        document.getElementById('file-options').classList.add('hidden');
    });
});
