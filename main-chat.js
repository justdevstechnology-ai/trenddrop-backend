import { db, storage } from './main-firebase.js';
import { AUTH } from './main-auth.js';
import { collection, addDoc, onSnapshot, doc, setDoc, getDoc, updateDoc, increment, query, where, orderBy, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export const CHAT = {
  currentChatId: null,
  currentOtherUser: null,
  messagesUnsub: null,
  chatsUnsub: null,

  async startChat(otherUserId, otherUserName, otherUserPhoto, productId = null, productName = null) {
    if (otherUserId === AUTH.user.uid) return window.APP.toast("Can't message yourself");

    // Create consistent chat ID: smaller UID first
    const chatId = [AUTH.user.uid, otherUserId].sort().join('_');
    CHAT.currentChatId = chatId;
    CHAT.currentOtherUser = { id: otherUserId, name: otherUserName, photo: otherUserPhoto };

    // Create chat doc if doesn't exist
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        users: [AUTH.user.uid, otherUserId],
        userNames: {
          [AUTH.user.uid]: AUTH.user.name,
          [otherUserId]: otherUserName
        },
        userPhotos: {
          [AUTH.user.uid]: AUTH.user.photo || '',
          [otherUserId]: otherUserPhoto || ''
        },
        lastMessage: productId? `Interested in ${productName}` : 'Chat started',
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Send initial product message if from product page
      if (productId) {
        await addDoc(collection(db, "chats", chatId, "messages"), {
          senderId: AUTH.user.uid,
          text: `Hi! I'm interested in your product: ${productName}`,
          productId,
          createdAt: serverTimestamp()
        });
      }
    }

    CHAT.openChatRoom(chatId, otherUserName, otherUserPhoto);
  },

  openChatRoom(chatId, userName, userPhoto) {
    CHAT.currentChatId = chatId;
    document.getElementById('chatUserName').innerText = userName;
    document.getElementById('chatUserPhoto').src = userPhoto || 'https://via.placeholder.com/32';
    showPage('chat-room-page');
    CHAT.loadMessages(chatId);
    CHAT.markAsRead(chatId);
  },

  loadMessages(chatId) {
    if (CHAT.messagesUnsub) CHAT.messagesUnsub();

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    CHAT.messagesUnsub = onSnapshot(q, (snap) => {
      const messages = snap.docs.map(d => ({ id: d.id,...d.data() }));
      CHAT.renderMessages(messages);
      CHAT.scrollToBottom();
    });
  },

  renderMessages(messages) {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = messages.map(m => {
      const isSent = m.senderId === AUTH.user.uid;
      return `
        <div class="message ${isSent? 'sent' : 'received'}">
          ${m.text? `<div>${m.text}</div>` : ''}
          ${m.imageUrl? `<img src="${m.imageUrl}">` : ''}
          ${m.productId? `<div style="font-size:11px;opacity:0.8;margin-top:4px">📦 About a product</div>` : ''}
          <div class="message-time">${CHAT.formatTime(m.createdAt)}</div>
        </div>
      `;
    }).join('');
  },

  scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    setTimeout(() => container.scrollTop = container.scrollHeight, 100);
  },

  async sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text ||!CHAT.currentChatId) return;

    const btn = document.getElementById('sendMessageBtn');
    btn.disabled = true;

    try {
      await addDoc(collection(db, "chats", CHAT.currentChatId, "messages"), {
        senderId: AUTH.user.uid,
        text,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, "chats", CHAT.currentChatId), {
        lastMessage: text,
        lastMessageTime: serverTimestamp(),
        [`unread_${CHAT.currentOtherUser.id}`]: increment(1)
      });

      input.value = '';
    } catch(e) {
      window.APP.toast('Failed to send');
    } finally {
      btn.disabled = false;
    }
  },

  async sendImage(file) {
    if (!file ||!CHAT.currentChatId) return;

    const fileName = `chats/${CHAT.currentChatId}_${Date.now()}.jpg`;
    const storageRef = ref(storage, fileName);
    const uploadTask = uploadBytesResumable(storageRef, file);

    window.APP.toast('Sending image...');

    uploadTask.on('state_changed', null,
      (error) => window.APP.toast('Upload failed'),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);

        await addDoc(collection(db, "chats", CHAT.currentChatId, "messages"), {
          senderId: AUTH.user.uid,
          imageUrl: url,
          createdAt: serverTimestamp()
        });

        await updateDoc(doc(db, "chats", CHAT.currentChatId), {
          lastMessage: '📷 Photo',
          lastMessageTime: serverTimestamp(),
          [`unread_${CHAT.currentOtherUser.id}`]: increment(1)
        });
      }
    );
  },

  async markAsRead(chatId) {
    await updateDoc(doc(db, "chats", chatId), {
      [`unread_${AUTH.user.uid}`]: 0
    }).catch(()=>{});
  },

  loadChatList() {
    if (CHAT.chatsUnsub) CHAT.chatsUnsub();

    const q = query(
      collection(db, "chats"),
      where("users", "array-contains", AUTH.user.uid),
      orderBy("updatedAt", "desc")
    );

    CHAT.chatsUnsub = onSnapshot(q, (snap) => {
      const chats = snap.docs.map(d => ({ id: d.id,...d.data() }));
      CHAT.renderChatList(chats);
      CHAT.updateUnreadBadge(chats);
    });
  },

  renderChatList(chats) {
    const container = document.getElementById('chatList');

    if (chats.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text2);padding:40px">No messages yet</p>';
      return;
    }

    container.innerHTML = chats.map(chat => {
      const otherUserId = chat.users.find(u => u!== AUTH.user.uid);
      const otherName = chat.userNames[otherUserId];
      const otherPhoto = chat.userPhotos[otherUserId];
      const unread = chat[`unread_${AUTH.user.uid}`] || 0;

      return `
        <div class="chat-item" onclick="CHAT.openChatRoom('${chat.id}', '${otherName}', '${otherPhoto}')">
          <div class="chat-avatar">
            <img src="${otherPhoto || 'https://via.placeholder.com/50'}" style="width:50px;height:50px;border-radius:50%">
            ${unread > 0? `<span class="chat-unread">${unread}</span>` : ''}
          </div>
          <div style="flex:1">
            <div style="font-weight:600;margin-bottom:4px">${otherName}</div>
            <div style="font-size:13px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${chat.lastMessage}</div>
          </div>
          <div style="font-size:11px;color:var(--text2)">${CHAT.formatTime(chat.lastMessageTime)}</div>
        </div>
      `;
    }).join('');
  },

  updateUnreadBadge(chats) {
    const total = chats.reduce((sum, c) => sum + (c[`unread_${AUTH.user.uid}`] || 0), 0);
    const badge = document.getElementById('unreadBadge');
    if (total > 0) {
      badge.innerText = total > 9? '9+' : total;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  },

  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff/60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h`;
    if (diff < 604800000) return `${Math.floor(diff/86400000)}d`;
    return date.toLocaleDateString();
  }
};
