document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('login-button');
    const usernameInput = document.getElementById('username-input');
    
    const addProfileButton = document.getElementById('add-profile-button');
    const closeOverlayButton = document.getElementById('close-overlay-button');
    const searchUserInput = document.getElementById('search-user-input');

    const sendMessageButton = document.getElementById('send-message-button');
    const messageInput = document.getElementById('message-input');
    
    const fileMenuButton = document.getElementById('file-menu-button');
    const sendPhotoButton = document.getElementById('send-photo-button');


    // Lógica de Login
    loginButton.addEventListener('click', () => {
        loginUser(usernameInput.value);
    });
    usernameInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            loginUser(usernameInput.value);
        }
    });

    // Abrir/Fechar painel de adicionar contato
    addProfileButton.addEventListener('click', showAddProfileOverlay);
    closeOverlayButton.addEventListener('click', hideAddProfileOverlay);

    // Buscar usuários
    searchUserInput.addEventListener('keyup', () => {
        const query = searchUserInput.value;
        if (query.length > 2) {
            searchUsers(query);
        }
    });

    // Lógica de envio de mensagem (a ser conectada a um chat ativo)
    // Precisamos de uma variável para guardar o chatID ativo
    let activeChatID = null; 

    // (Esta parte precisa ser integrada na função `loadChat` para definir o chat ativo)
    // Exemplo:
    // Na função loadChat(chatID, ...) -> activeChatID = chatID;

    sendMessageButton.addEventListener('click', () => {
        if(activeChatID) {
            sendTextMessage(activeChatID);
        } else {
            alert("Selecione uma conversa primeiro.");
        }
    });
    
    messageInput.addEventListener('keyup', (e) => {
        // Enviar com Enter, pular linha com Shift+Enter
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Impede a quebra de linha padrão do Enter
            sendMessageButton.click();
        }
    });
    
    // Lógica do menu de arquivos
    fileMenuButton.addEventListener('click', () => {
        document.getElementById('file-options').classList.toggle('hidden');
    });

    sendPhotoButton.addEventListener('click', () => {
         if(activeChatID) {
            handlePhotoUpload(activeChatID);
        } else {
            alert("Selecione uma conversa primeiro.");
        }
        document.getElementById('file-options').classList.add('hidden');
    });
});


// (As funções de UI como showChatInterface, showAddProfileOverlay etc.
// devem ser colocadas em ui.js para melhor organização)
