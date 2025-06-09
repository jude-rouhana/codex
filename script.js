const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const vizSelect = document.getElementById('vizSelect');
const audioFileInput = document.getElementById('audioFile');
let audioCtx, analyser, dataArray;
let scene, camera, renderer, visual, animationId, micStream, fileSource;

document.querySelectorAll('input[name="audioSource"]').forEach(radio => {
    radio.addEventListener('change', () => {
        if (radio.value === 'file') {
            audioFileInput.style.display = 'inline';
        } else {
            audioFileInput.style.display = 'none';
        }
    });
});

startButton.addEventListener('click', async () => {
    startButton.disabled = true;
    stopButton.disabled = false;
    try {
        const sourceType = document.querySelector('input[name="audioSource"]:checked').value;
        if (sourceType === 'mic') {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setupMicAudio(stream);
        } else {
            const file = audioFileInput.files[0];
            if (!file) {
                alert('Select a WAV file first');
                startButton.disabled = false;
                return;
            }
            await setupFileAudio(file);
        }
        initThree(vizSelect.value);
        animate();
    } catch (err) {
        console.error('Audio initialization failed:', err);
        startButton.disabled = false;
        stopButton.disabled = true;
    }
});

stopButton.addEventListener('click', stopVisualizer);

function setupMicAudio(stream) {
    micStream = stream;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
}

async function setupFileAudio(file) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const source = audioCtx.createBufferSource();
    fileSource = source;
    source.buffer = audioBuffer;
    source.loop = true;
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    source.start();
    dataArray = new Uint8Array(analyser.frequencyBinCount);
}

function initThree(type) {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    switch (type) {
        case 'sphere':
            visual = new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshStandardMaterial({ color: 0x00ff00 }));
            break;
        case 'particles':
            const pGeom = new THREE.BufferGeometry();
            const count = 500;
            const positions = new Float32Array(count * 3);
            for (let i = 0; i < count * 3; i++) {
                positions[i] = (Math.random() - 0.5) * 4;
            }
            pGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const pMat = new THREE.PointsMaterial({ color: 0x00ff00, size: 0.05 });
            visual = new THREE.Points(pGeom, pMat);
            break;
        case 'bars':
            visual = new THREE.Group();
            const barCount = 32;
            for (let i = 0; i < barCount; i++) {
                const bar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 0.2), new THREE.MeshStandardMaterial({ color: 0x00ff00 }));
                bar.position.x = (i - barCount / 2) * 0.25;
                visual.add(bar);
            }
            break;
        case 'cube':
        default:
            visual = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0x00ff00 }));
    }
    scene.add(visual);

    const light = new THREE.PointLight(0xffffff, 1);
    light.position.set(0, 2, 2);
    scene.add(light);

    camera.position.z = 5;
    window.addEventListener('resize', onWindowResize);
}

function stopVisualizer() {
    cancelAnimationFrame(animationId);
    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }
    if (fileSource) {
        try { fileSource.stop(); } catch (e) {}
        fileSource = null;
    }
    if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
    }
    if (renderer && renderer.domElement) {
        renderer.domElement.remove();
    }
    startButton.disabled = false;
    stopButton.disabled = true;
    window.removeEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    animationId = requestAnimationFrame(animate);
    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
    const scale = 1 + avg / 256;
    if (vizSelect.value === 'bars' && visual instanceof THREE.Group) {
        const bars = visual.children;
        const step = Math.floor(dataArray.length / bars.length);
        bars.forEach((bar, i) => {
            const val = dataArray[i * step] / 255;
            bar.scale.y = 0.1 + val * 2;
        });
    } else {
        visual.scale.set(scale, scale, scale);
        visual.rotation.x += 0.01;
        visual.rotation.y += 0.01;
    }
    renderer.render(scene, camera);
}
