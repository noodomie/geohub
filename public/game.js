window.onerror = function(message, source, lineno, colno, error) {
    alert("Kritik Kod Hatası:\n" + message + "\nSatır: " + lineno);
    return false;
};
if (typeof THREE === 'undefined') {
    alert("Kritik Hata: Three.js kütüphanesi yüklenemedi!");
}
const socket = io();
const loginScreen = document.getElementById('login-screen');
const gameUI = document.getElementById('game-ui');
const usernameInput = document.getElementById('username-input');
const colorWheel = document.getElementById('color-wheel');
const playButton = document.getElementById('play-button');
const errorMessage = document.getElementById('error-message');
const joystickBase = document.getElementById('joystick-base');
const joystickThumb = document.getElementById('joystick-thumb');
const jumpButton = document.getElementById('jump-button');
const btnChat = document.getElementById('btn-chat');
const chatPanel = document.getElementById('chat-panel');
const chatClose = document.getElementById('chat-close');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const chatMessages = document.getElementById('chat-messages');
if (usernameInput && errorMessage) {
    usernameInput.parentNode.insertBefore(errorMessage, usernameInput.nextSibling);
}
let unreadCount = 0;
let chatBadge = document.getElementById('chat-badge');
if (btnChat && !chatBadge) {
    chatBadge = document.createElement('span');
    chatBadge.id = 'chat-badge';
    chatBadge.style.position = 'absolute';
    chatBadge.style.top = '-5px';
    chatBadge.style.right = '-5px';
    chatBadge.style.backgroundColor = '#ff3838';
    chatBadge.style.color = '#ffffff';
    chatBadge.style.borderRadius = '50%';
    chatBadge.style.padding = '2px 6px';
    chatBadge.style.fontSize = '12px';
    chatBadge.style.fontWeight = 'bold';
    chatBadge.style.display = 'none';
    chatBadge.style.minWidth = '14px';
    chatBadge.style.textAlign = 'center';
    chatBadge.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
    btnChat.style.position = 'relative';
    btnChat.appendChild(chatBadge);
}
function updateChatBadge() {
    if (!chatBadge) return;
    if (unreadCount > 0) {
        chatBadge.innerText = unreadCount;
        chatBadge.style.display = 'block';
    } else {
        chatBadge.style.display = 'none';
    }
}
const inputs = [usernameInput, chatInput];
inputs.forEach(input => {
    if (input) {
        const resetScroll = () => {
            setTimeout(() => {
                window.scrollTo(0, 0);
                document.body.scrollTop = 0;
            }, 30);
        };
        input.addEventListener('focus', resetScroll);
        input.addEventListener('blur', resetScroll);
    }
});
let localPlayerId = null;
let playerColor = '#00a8ff';
let scene, camera, renderer;
const otherPlayers = {};
let localPlayerMesh = null;
let position = null; 
let velocityY = 0;
let isGrounded = true;
const GRAVITY = -0.015;
const JUMP_FORCE = 0.32;
const SPEED = 0.12;
const cameraDist = 8;
let cameraYaw = 0;
let cameraPitch = 0.3;
let joystickTouchId = null;
let cameraTouchId = null;
let startTouchX = 0, startTouchY = 0;
let joystickActive = false;
let joyDX = 0, joyDY = 0;
const PLATFORM_RADIUS = 24.5;
let pickerPos = { x: 75, y: 75 };
function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function drawWheel(selectX = null, selectY = null) {
    if (!colorWheel) return;
    const ctx = colorWheel.getContext('2d');
    const radius = colorWheel.width / 2;
    ctx.clearRect(0, 0, colorWheel.width, colorWheel.height);
    for (let i = 0; i < 360; i++) {
        const startAngle = (i - 1.5) * Math.PI / 180;
        const endAngle = (i + 0.5) * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(radius, radius);
        ctx.arc(radius, radius, radius, startAngle, endAngle);
        ctx.closePath();
        const grad = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, `hsl(${i}, 100%, 50%)`);
        ctx.fillStyle = grad;
        ctx.fill();
    }
    if (selectX !== null && selectY !== null) {
        pickerPos = { x: selectX, y: selectY };
    }
    ctx.beginPath();
    ctx.arc(pickerPos.x, pickerPos.y, 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pickerPos.x, pickerPos.y, 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
}
function handleColorPick(e) {
    const rect = colorWheel.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = Math.max(0, Math.min(colorWheel.width, clientX - rect.left));
    const y = Math.max(0, Math.min(colorWheel.height, clientY - rect.top));
    const cx = colorWheel.width / 2;
    const cy = colorWheel.height / 2;
    const dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
    if (dist <= cx) {
        const ctx = colorWheel.getContext('2d');
        const imgData = ctx.getImageData(x, y, 1, 1).data;
        playerColor = rgbToHex(imgData[0], imgData[1], imgData[2]);
        drawWheel(x, y);
    }
}
const initialAngle = 200 * Math.PI / 180;
pickerPos = {
    x: 75 + 55 * Math.cos(initialAngle),
    y: 75 + 55 * Math.sin(initialAngle)
};
drawWheel();
if (colorWheel) {
    colorWheel.addEventListener('mousedown', (e) => {
        handleColorPick(e);
        const onMouseMove = (moveEv) => handleColorPick(moveEv);
        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    });
    colorWheel.addEventListener('touchstart', (e) => {
        handleColorPick(e);
        const onTouchMove = (moveEv) => handleColorPick(moveEv);
        const onTouchEnd = () => {
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
        };
        window.addEventListener('touchmove', onTouchMove);
        window.addEventListener('touchend', onTouchEnd);
    });
}
playButton.addEventListener('click', joinGame);
usernameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') joinGame(); });
function joinGame() {
    const name = usernameInput.value.trim();
    errorMessage.classList.remove('show');
    if (name.length < 3 || name.length > 16) {
        errorMessage.innerText = "Kullanıcı adı en az 3, en fazla 16 karakter olmalıdır!";
        errorMessage.classList.add('show');
        return;
    }
    if (/\s/.test(name)) {
        errorMessage.innerText = "Kullanıcı adında boşluk bulunamaz!";
        errorMessage.classList.add('show');
        return;
    }
    socket.emit('joinRequest', { username: name, color: playerColor });
}
socket.on('joinResponse', (response) => {
    if (response.success) {
        localPlayerId = response.id;
        playerColor = response.color;
        loginScreen.style.opacity = '0';
        loginScreen.style.transform = 'scale(1.1)';
        setTimeout(() => {
            loginScreen.classList.add('hidden');
            gameUI.classList.remove('hidden');
            try {
                initEngine();
                setupMultiplayer(response.players);
            } catch (err) {
                alert("Oyun motoru başlatma hatası: " + err.message);
            }
        }, 500);
    } else {
        errorMessage.innerText = response.error;
        errorMessage.classList.add('show');
    }
});
function setupMultiplayer(initialPlayers) {
    Object.keys(initialPlayers).forEach((id) => {
        if (id !== localPlayerId) {
            createOtherPlayer(initialPlayers[id]);
        }
    });
}
socket.on('playerJoined', (playerData) => {
    createOtherPlayer(playerData);
});
socket.on('playerMoved', (playerData) => {
    if (otherPlayers[playerData.id]) {
        otherPlayers[playerData.id].mesh.position.set(playerData.x, playerData.y, playerData.z);
        otherPlayers[playerData.id].mesh.rotation.y = playerData.ry;
    }
});
socket.on('playerLeft', (id) => {
    if (otherPlayers[id]) {
        scene.remove(otherPlayers[id].mesh);
        delete otherPlayers[id];
    }
});
btnChat.addEventListener('click', () => {
    chatPanel.classList.toggle('closed');
    if (!chatPanel.classList.contains('closed')) {
        unreadCount = 0;
        updateChatBadge();
    }
});
chatClose.addEventListener('click', () => {
    chatPanel.classList.add('closed');
});
chatSend.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });
function sendChatMessage() {
    const text = chatInput.value.trim();
    if (text) {
        socket.emit('chatMessage', text);
        chatInput.value = '';
    }
}
socket.on('chatMessage', (data) => {
    const msgElement = document.createElement('div');
    msgElement.className = 'msg';
    msgElement.innerHTML = `<span class="msg-sender" style="color: ${data.color};">${data.username}:</span>${data.text}`;
    chatMessages.appendChild(msgElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    if (chatPanel.classList.contains('closed')) {
        unreadCount++;
        updateChatBadge();
    }
});
function createBeanGeometry() {
    try {
        return new THREE.CapsuleGeometry(0.4, 0.8, 8, 16);
    } catch(e) {
        return new THREE.CylinderGeometry(0.4, 0.4, 0.8, 16);
    }
}
function createPlayerGroup(color, username = null) {
    const group = new THREE.Group();
    const bodyGeo = createBeanGeometry();
    const bodyMat = new THREE.MeshPhongMaterial({ color: color, roughness: 0.5 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.8;
    group.add(body);
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.15, 1.0, 0.35);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.15, 1.0, 0.35);
    group.add(rightEye);
    if (username) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        if (ctx.roundRect) {
            ctx.roundRect(10, 10, 236, 44, 15);
        } else {
            ctx.rect(10, 10, 236, 44);
        }
        ctx.fill();
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(username, 128, 40);
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(1.5, 0.375, 1);
        sprite.position.y = 1.9;
        group.add(sprite);
    }
    return group;
}
function createOtherPlayer(playerData) {
    const color = playerData.color || '#80d8ff';
    const mesh = createPlayerGroup(color, playerData.username);
    mesh.position.set(playerData.x, playerData.y, playerData.z);
    scene.add(mesh);
    otherPlayers[playerData.id] = { mesh, username: playerData.username, color: color };
}
function initEngine() {
    position = new THREE.Vector3(0, 1, 0);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdbeeff);
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const floorGeo = new THREE.CylinderGeometry(25, 25, 1, 64);
    const floorMat = new THREE.MeshPhongMaterial({ color: 0x1d1d23, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.5;
    scene.add(floor);
    const gridGeo = new THREE.CircleGeometry(25, 64);
    const gridMat = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            void main() {
                float thickness = 0.03;
                float lx = step(thickness, fract(vUv.x * 50.0));
                float ly = step(thickness, fract(vUv.y * 50.0));
                if (lx > 0.5 && ly > 0.5) discard;
                gl_FragColor = vec4(0.2, 0.2, 0.2, 0.8);
            }
        `,
        transparent: true,
        depthWrite: false
    });
    const gridHelper = new THREE.Mesh(gridGeo, gridMat);
    gridHelper.rotation.x = -Math.PI / 2;
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 15, 5);
    scene.add(dirLight);
    localPlayerMesh = createPlayerGroup(playerColor);
    scene.add(localPlayerMesh);
    setupControls();
    tick();
}
function setupControls() {
    window.addEventListener('touchstart', (e) => {
        if (e.target.closest('.side-panel') || e.target.closest('#ui-bar') || e.target.closest('#login-screen')) {
            return;
        }
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.clientX < window.innerWidth * 0.45 && touch.clientY > window.innerHeight * 0.5 && joystickTouchId === null) {
                joystickTouchId = touch.identifier;
                joystickActive = true;
                updateJoystick(touch);
            } 
            else if (touch.clientX >= window.innerWidth / 2 && cameraTouchId === null) {
                if (e.target.closest('#jump-button')) {
                    continue; 
                }
                cameraTouchId = touch.identifier;
                startTouchX = touch.clientX;
                startTouchY = touch.clientY;
            }
        }
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === joystickTouchId) {
                updateJoystick(touch);
            } 
            else if (touch.identifier === cameraTouchId) {
                const deltaX = touch.clientX - startTouchX;
                const deltaY = touch.clientY - startTouchY;
                cameraYaw -= deltaX * 0.007;
                cameraPitch = Math.max(0.05, Math.min(Math.PI / 2.2, cameraPitch + deltaY * 0.005));
                startTouchX = touch.clientX;
                startTouchY = touch.clientY;
            }
        }
    }, { passive: false });
    window.addEventListener('touchend', (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === joystickTouchId) {
                joystickTouchId = null;
                joystickActive = false;
                joyDX = 0;
                joyDY = 0;
                joystickThumb.style.transform = 'translate(-50%, -50%)';
            } 
            else if (touch.identifier === cameraTouchId) {
                cameraTouchId = null;
            }
        }
    });
    jumpButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isGrounded) {
            velocityY = JUMP_FORCE;
            isGrounded = false;
        }
    });
}
function updateJoystick(touch) {
    const rect = joystickBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = rect.width / 2;
    if (distance > maxRadius) {
        dx = (dx / distance) * maxRadius;
        dy = (dy / distance) * maxRadius;
    }
    joystickThumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    joyDX = dx / maxRadius;
    joyDY = dy / maxRadius;
}
let lastFrameTime = performance.now();
const fpsInterval = 1000 / 60;
function tick() {
    requestAnimationFrame(tick);
    const now = performance.now();
    const elapsed = now - lastFrameTime;
    if (elapsed >= fpsInterval) {
        lastFrameTime = now - (elapsed % fpsInterval);
        updatePhysics();
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }
}
function updatePhysics() {
    velocityY += GRAVITY;
    position.y += velocityY;
    if (position.y <= 0) {
        position.y = 0;
        velocityY = 0;
        isGrounded = true;
    } else {
        isGrounded = false;
    }
    if (joystickActive && (joyDX !== 0 || joyDY !== 0)) {
        const forwardX = -Math.sin(cameraYaw);
        const forwardZ = -Math.cos(cameraYaw);
        const rightX = Math.cos(cameraYaw);
        const rightZ = -Math.sin(cameraYaw);
        const moveX = (forwardX * -joyDY) + (rightX * joyDX);
        const moveZ = (forwardZ * -joyDY) + (rightZ * joyDX);
        position.x += moveX * SPEED;
        position.z += moveZ * SPEED;
        const angle = Math.atan2(moveX, moveZ);
        if (localPlayerMesh) {
            localPlayerMesh.rotation.y = angle;
        }
    }
    const distFromCenter = Math.sqrt(position.x * position.x + position.z * position.z);
    if (distFromCenter > PLATFORM_RADIUS) {
        const angle = Math.atan2(position.z, position.x);
        position.x = Math.cos(angle) * PLATFORM_RADIUS;
        position.z = Math.sin(angle) * PLATFORM_RADIUS;
    }
    if (localPlayerMesh) {
        localPlayerMesh.position.copy(position);
    }
    const targetCamX = position.x + cameraDist * Math.sin(cameraYaw) * Math.cos(cameraPitch);
    const targetCamY = position.y + 1.2 + cameraDist * Math.sin(cameraPitch);
    const targetCamZ = position.z + cameraDist * Math.cos(cameraYaw) * Math.cos(cameraPitch);
    camera.position.set(targetCamX, targetCamY, targetCamZ);
    camera.lookAt(position.x, position.y + 1.0, position.z);
    if (socket.connected && localPlayerId && localPlayerMesh) {
        socket.emit('move', {
            x: position.x,
            y: position.y,
            z: position.z,
            ry: localPlayerMesh.rotation.y
        });
    }
}
window.addEventListener('resize', () => {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
    }
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});
