let socket;
let scene, camera, renderer;
let myId = null;
let localPlayer = null;
const otherPlayers = {};
const tapIndicators = [];

// Kontroller
let moveDirection = { x: 0, z: 0 };
let isJumping = false;
let jumpVelocity = 0;
const gravity = 0.015;

// Giriş elementleri
const loginContainer = document.getElementById('login-container');
const gameContainer = document.getElementById('game-container');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const loginError = document.getElementById('login-error');

// Bağlan ve Giriş Yap Yapısı
joinBtn.addEventListener('click', () => {
  const rawName = usernameInput.value.trim();
  const nameRegex = /^[a-zçğıöşuü]+$/; // Sadece küçük Türkçe ve İngilizce harfler

  if (!nameRegex.test(rawName)) {
    loginError.innerText = "HATA: Kullanıcı adı sadece küçük harflerden oluşmalıdır! Sayı, boşluk veya noktalama yasak.";
    return;
  }

  loginError.innerText = "";
  initSocket(rawName);
});

// Socket.io Bağlantısı
function initSocket(username) {
  socket = io();

  socket.on('connect', () => {
    socket.emit('joinGame', username);
  });

  socket.on('loginError', (msg) => {
    loginError.innerText = `HATA: ${msg}`;
    socket.disconnect();
  });

  socket.on('loginSuccess', (data) => {
    myId = data.myId;
    
    // Arayüzleri ayarla
    loginContainer.style.display = 'none';
    gameContainer.style.display = 'block';

    // Three.js Başlat
    initThree();

    // Mevcut oyuncuları sahneye ekle
    for (let id in data.players) {
      if (id === myId) {
        createLocalPlayer(data.players[id]);
      } else {
        createRemotePlayer(data.players[id]);
      }
    }

    // Oyun döngüsünü başlat
    animate();
  });

  socket.on('playerJoined', (playerData) => {
    createRemotePlayer(playerData);
  });

  socket.on('playerMoved', (data) => {
    if (otherPlayers[data.id]) {
      otherPlayers[data.id].mesh.position.set(data.x, data.y, data.z);
    }
  });

  // Hasar Alma Olayı (PvP)
  socket.on('playerHit', (data) => {
    let target;
    if (data.targetId === myId) {
      target = localPlayer;
      // Kendi HUD Can göstergemizi güncelle
      document.getElementById('hud-hp-fill').style.width = `${data.hp}%`;
      document.getElementById('hud-hp-text').innerText = data.hp;
    } else {
      target = otherPlayers[data.targetId];
      // Diğer oyuncunun tepesindeki can barını küçült
      const fillBar = document.getElementById(`hp-fill-${data.targetId}`);
      if (fillBar) fillBar.style.width = `${data.hp}%`;
    }

    // Vurulan kişiyi kırmızı yapıp parlat (Flaş efekti)
    if (target && target.mesh) {
      const originalColor = target.mesh.material.color.getHex();
      target.mesh.material.color.setHex(0xff0000); // Kırmızı renk flaşı
      
      // Geri tepme pozisyonunu anlık uygula (server hesaplı)
      target.mesh.position.set(data.newPos.x, data.newPos.y, data.newPos.z);

      setTimeout(() => {
        if (target && target.mesh) {
          target.mesh.material.color.setHex(originalColor);
        }
      }, 200);
    }
  });

  // Ölüm ve Yeniden Canlanma
  socket.on('playerRespawned', (data) => {
    let target;
    if (data.id === myId) {
      target = localPlayer;
      document.getElementById('hud-hp-fill').style.width = `100%`;
      document.getElementById('hud-hp-text').innerText = '100';
    } else {
      target = otherPlayers[data.id];
      const fillBar = document.getElementById(`hp-fill-${data.id}`);
      if (fillBar) fillBar.style.width = `100%`;
    }

    if (target && target.mesh) {
      target.mesh.position.set(data.pos.x, data.pos.y, data.pos.z);
    }
  });

  // Oyuncu çıkınca anında sahneden sil (Hayalet oyuncu düzeltmesi)
  socket.on('playerDisconnected', (id) => {
    if (otherPlayers[id]) {
      scene.remove(otherPlayers[id].mesh);
      delete otherPlayers[id];
    }
    const tag = document.getElementById(`tag-${id}`);
    if (tag) tag.remove();
  });

  // Sohbet Alıcısı
  socket.on('chatMessage', (data) => {
    const msgDiv = document.getElementById('chat-messages');
    msgDiv.innerHTML += `<div><strong>${data.username}:</strong> ${data.text}</div>`;
    msgDiv.scrollTop = msgDiv.scrollHeight;
  });
}

// Oyuncu sekmesini veya tarayıcısını kapattığı an anında çıkış gönder
window.addEventListener('beforeunload', () => {
  if (socket) socket.disconnect();
});

// THREE.JS OYUN MOTORU KURULUMU
function initThree() {
  const container = document.getElementById('canvas-container');
  
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0512);
  scene.fog = new THREE.FogExp2(0x0a0512, 0.015);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 12, 18);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // Işıklandırma
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xa855f7, 0.8);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  // DEV PLATFORM (100x100 Cyber-Grid)
  const floorGeo = new THREE.BoxGeometry(100, 1, 100);
  const floorMat = new THREE.MeshStandardMaterial({ 
    color: 0x140a24, 
    roughness: 0.9,
    metalness: 0.1
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = -0.5;
  scene.add(floor);

  // Neon Izgara Süslemesi
  const gridHelper = new THREE.GridHelper(100, 50, 0x00ffcc, 0x581c87);
  gridHelper.position.y = 0.01;
  scene.add(gridHelper);

  // Ekran Yeniden Boyutlandırma (WebView/Instagram ve Yatay Ekran Fix)
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.style.height = window.innerHeight + 'px';
  });

  // Dokunma/Tıklama Olayları (PvP ve Dokunma İzi)
  window.addEventListener('pointerdown', (e) => {
    // UI elemanlarına tıklandıysa işlemi yok say
    if (e.target.closest('#chat-container') || e.target.closest('#my-hud') || e.target.closest('#joystick-zone') || e.target.closest('#jump-btn')) {
      return;
    }

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );

    raycaster.setFromCamera(mouse, camera);

    // Diğer oyuncuları vurma tespiti (PvP)
    const playerMeshes = Object.values(otherPlayers).map(p => p.mesh);
    const playerIntersects = raycaster.intersectObjects(playerMeshes);

    if (playerIntersects.length > 0) {
      const hitMesh = playerIntersects[0].object;
      const targetId = hitMesh.userData.id;
      if (targetId) {
        socket.emit('hitPlayer', { targetId: targetId });
        return; // Karakter vurulduysa yere tıklama izi çıkartma
      }
    }

    // Yere tıklama izi çıkartma
    const floorIntersect = raycaster.intersectObject(floor);
    if (floorIntersect.length > 0) {
      spawnTapIndicator(floorIntersect[0].point);
    }
  });

  // Joystick ve Buton Kontrolleri
  initMobileControls();
}

// Oyuncu Oluşturma Fonksiyonları
function createLocalPlayer(data) {
  const geom = new THREE.CylinderGeometry(0.5, 0.5, 2, 16);
  const mat = new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.5 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(data.x, data.y, data.z);
  scene.add(mesh);

  localPlayer = { mesh: mesh, color: data.color };

  // HUD ismini yaz
  document.getElementById('hud-name').innerText = data.username;
}

function createRemotePlayer(data) {
  const geom = new THREE.CylinderGeometry(0.5, 0.5, 2, 16);
  const mat = new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.5 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(data.x, data.y, data.z);
  
  // PvP tespiti için ID'sini mesh içine yerleştiriyoruz
  mesh.userData = { id: data.id };
  scene.add(mesh);

  otherPlayers[data.id] = { mesh: mesh, color: data.color, username: data.username };

  // Diğer oyuncu için üstte can barı olan HTML nametag oluştur
  const container = document.getElementById('nametag-overlay-container');
  const tag = document.createElement('div');
  tag.id = `tag-${data.id}`;
  tag.className = 'player-tag';
  tag.innerHTML = `
    <div class="tag-hp-bar-bg">
      <div id="hp-fill-${data.id}" class="tag-hp-bar-fill"></div>
    </div>
    <div class="tag-username">${data.username}</div>
  `;
  container.appendChild(tag);
}

// Harika Dokunma İz İşareti (Neon Ring)
function spawnTapIndicator(point) {
  const geom = new THREE.RingGeometry(0.01, 0.5, 16);
  const mat = new THREE.MeshBasicMaterial({ 
    color: 0x00ffcc, 
    side: THREE.DoubleSide, 
    transparent: true, 
    opacity: 1 
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(point.x, 0.05, point.z); // Z-fighting engellemek için hafif havada
  scene.add(mesh);

  tapIndicators.push({
    mesh: mesh,
    scale: 1,
    opacity: 1
  });
}

// Joystick ve Zıplama Kontrolleri
function initMobileControls() {
  const manager = nipplejs.create({
    zone: document.getElementById('joystick-zone'),
    mode: 'static',
    position: { left: '50px', bottom: '50px' },
    color: '#00ffcc'
  });

  manager.on('move', (evt, data) => {
    const speed = 0.12;
    moveDirection.x = data.vector.x * speed;
    moveDirection.z = -data.vector.y * speed; // 3D'de ileri-geri ekseni Z'dir
  });

  manager.on('end', () => {
    moveDirection.x = 0;
    moveDirection.z = 0;
  });

  document.getElementById('jump-btn').addEventListener('click', () => {
    if (!isJumping) {
      isJumping = true;
      jumpVelocity = 0.28;
    }
  });

  // Sohbet Gönderme
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');
  chatSend.addEventListener('click', sendChat);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat();
  });
}

function sendChat() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (text.length > 0 && socket) {
    socket.emit('chatMessage', text);
    input.value = "";
  }
}

// HTML Nametaglerin 3D Pozisyonunu Ekrana Yansıtma (Projeksiyon)
function updateNametags() {
  for (let id in otherPlayers) {
    const player = otherPlayers[id];
    const tagDiv = document.getElementById(`tag-${id}`);
    if (!tagDiv || !player.mesh) continue;

    const tempV = new THREE.Vector3();
    player.mesh.getWorldPosition(tempV);
    tempV.y += 1.8; // Kapsülün kafasının hemen üstü

    tempV.project(camera);

    // Kamera arkasında kalıyorsa gizle
    if (tempV.z > 1) {
      tagDiv.style.display = 'none';
      continue;
    }

    // Ekran koordinatlarına dönüştürme
    const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
    const y = (tempV.y * -0.5 + 0.5) * window.innerHeight;

    tagDiv.style.display = 'block';
    tagDiv.style.left = `${x}px`;
    tagDiv.style.top = `${y}px`;
  }
}

// OYUN DÖNGÜSÜ
function animate() {
  requestAnimationFrame(animate);

  if (localPlayer) {
    // Karakter Hareketi ve Bounding Box Sınırları (Platform sınırlarında tut)
    localPlayer.mesh.position.x = Math.max(-49, Math.min(49, localPlayer.mesh.position.x + moveDirection.x));
    localPlayer.mesh.position.z = Math.max(-49, Math.min(49, localPlayer.mesh.position.z + moveDirection.z));

    // Zıplama Fiziği
    if (isJumping) {
      localPlayer.mesh.position.y += jumpVelocity;
      jumpVelocity -= gravity;
      if (localPlayer.mesh.position.y <= 1) {
        localPlayer.mesh.position.y = 1;
        isJumping = false;
        jumpVelocity = 0;
      }
    }

    // Kamera Takibi
    camera.position.x = localPlayer.mesh.position.x;
    camera.position.z = localPlayer.mesh.position.z + 18;
    camera.lookAt(localPlayer.mesh.position);

    // Sunucuya yeni konumumuzu gönder
    socket.emit('move', {
      x: localPlayer.mesh.position.x,
      y: localPlayer.mesh.position.y,
      z: localPlayer.mesh.position.z
    });
  }

  // Tıklama İzlerinin Efekti ve Sahneden Silinmesi
  for (let i = tapIndicators.length - 1; i >= 0; i--) {
    const ind = tapIndicators[i];
    ind.scale += 0.09;
    ind.mesh.scale.set(ind.scale, ind.scale, 1);
    ind.opacity -= 0.05;
    ind.mesh.material.opacity = ind.opacity;

    if (ind.opacity <= 0) {
      scene.remove(ind.mesh);
      ind.mesh.geometry.dispose();
      ind.mesh.material.dispose();
      tapIndicators.splice(i, 1);
    }
  }

  // Nametag konumlarını güncelle
  updateNametags();

  renderer.render(scene, camera);
}
