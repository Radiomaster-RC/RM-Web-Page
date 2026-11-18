import { ESPLoader, Transport } from './vendor/esptool-js/bundle.js';

const BAUDRATE = 921600;
const FLASH_ADDRESS = 0;
const BIN_FOLDER = 'radio';
const FILES_JSON_KEY = 'transmitter';

const LANGS = {
  zh: {
    title: 'ESP 固件烧录',
    subtitle: 'ESP8285 · 请选择固件后连接设备并烧录',
    hint: '烧录地址固定为 0x0，波特率 921600，Flash 参数保持芯片原样。请使用 Chrome / Edge。',
    'fw-label': '云端固件 (bin/radio)',
    'fw-local-label': '本地固件',
    'fw-or': '或',
    'drag-fw-file': '拖拽 .bin 文件到此处',
    'drag-fw-hint': '或点击选择本地文件',
    'fw-file-selected': '已选择本地固件：',
    'fw-file-size': '（',
    'fw-file-bytes': ' 字节）',
    'fw-invalid-file': '请选择 .bin 或 .hex 固件文件',
    'fw-loading': '正在加载固件列表…',
    'fw-empty': '未找到固件，请确认 bin/radio 目录',
    'flash-btn': '连接并烧录',
    'disconnect-btn': '断开连接',
    'back-link': '返回配置工具',
    'status-ready': '请选择固件',
    'status-connecting': '正在连接设备…',
    'status-loading-fw': '正在加载固件…',
    'status-flashing': '正在烧录…',
    'status-done': '烧录完成，请重新上电或返回配置工具',
    'status-no-serial': '浏览器不支持 Web Serial，请使用 Chrome / Edge',
    'status-no-fw': '请先选择固件文件',
    'status-fetch-fw-fail': '固件文件加载失败',
    'chip-detected': '已识别芯片：',
    'err-prefix': '失败：',
  },
  en: {
    title: 'ESP Firmware Flash',
    subtitle: 'ESP8285 · Select firmware, connect, and flash',
    hint: 'Flash address 0x0, baud 921600, flash params kept. Use Chrome / Edge.',
    'fw-label': 'Cloud firmware (bin/radio)',
    'fw-local-label': 'Local firmware',
    'fw-or': 'or',
    'drag-fw-file': 'Drag a .bin file here',
    'drag-fw-hint': 'or click to browse',
    'fw-file-selected': 'Local firmware: ',
    'fw-file-size': ' (',
    'fw-file-bytes': ' bytes)',
    'fw-invalid-file': 'Please select a .bin or .hex firmware file',
    'fw-loading': 'Loading firmware list…',
    'fw-empty': 'No firmware found in bin/radio',
    'flash-btn': 'Connect & Flash',
    'disconnect-btn': 'Disconnect',
    'back-link': 'Back to Config',
    'status-ready': 'Select a firmware file',
    'status-connecting': 'Connecting…',
    'status-loading-fw': 'Loading firmware…',
    'status-flashing': 'Flashing…',
    'status-done': 'Done. Power-cycle or return to config tool.',
    'status-no-serial': 'Web Serial not supported. Use Chrome / Edge.',
    'status-no-fw': 'Select a firmware file first',
    'status-fetch-fw-fail': 'Failed to load firmware file',
    'chip-detected': 'Chip: ',
    'err-prefix': 'Failed: ',
  },
};

let currentLang = 'zh';

function initLang() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('lang');
  if (q === 'zh' || q === 'en') {
    currentLang = q;
  } else {
    const stored = localStorage.getItem('lang');
    if (stored === 'zh' || stored === 'en') currentLang = stored;
    else currentLang = 'zh';
  }
  document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
}

function updateLangSwitcher() {
  $('lang-switcher').textContent = currentLang === 'en' ? '🌐 EN' : '🌐 中文';
}
let device = null;
let transport = null;
let esploader = null;
let firmwareData = null;
let firmwareSource = null; // 'cloud' | 'local'
let localFileName = '';
let busy = false;

const $ = (id) => document.getElementById(id);

function t(key) {
  return (LANGS[currentLang] && LANGS[currentLang][key]) || key;
}

function getBasePath() {
  const path = window.location.pathname;
  const slash = path.lastIndexOf('/');
  return slash >= 0 ? path.substring(0, slash + 1) : './';
}

function updateFlashButton() {
  const ready = firmwareSource === 'local'
    ? !!firmwareData
    : !!$('fw-select').value;
  $('flash-btn').disabled = busy || !ready;
}

function clearLocalFirmware() {
  localFileName = '';
  $('fw-file-name').textContent = '';
  $('fw-file').value = '';
  if (firmwareSource === 'local') {
    firmwareSource = null;
    firmwareData = null;
  }
}

function clearCloudSelection() {
  $('fw-select').value = '';
  if (firmwareSource === 'cloud') {
    firmwareSource = null;
    firmwareData = null;
  }
}

function setLocalFirmware(file, data) {
  clearCloudSelection();
  firmwareSource = 'local';
  firmwareData = data;
  localFileName = file.name;
  $('fw-file-name').textContent =
    t('fw-file-selected') + file.name + t('fw-file-size') + data.length + t('fw-file-bytes');
  setStatus(t('status-ready'));
  updateFlashButton();
}

async function readFirmwareFile(file) {
  if (!/\.(bin|hex)$/i.test(file.name)) {
    throw new Error(t('fw-invalid-file'));
  }
  const data = new Uint8Array(await file.arrayBuffer());
  if (!data.length) throw new Error(t('fw-invalid-file'));
  return data;
}

function setStatus(msg, type) {
  const el = $('status');
  el.textContent = msg;
  el.className = type || '';
}

function logLine(msg) {
  const panel = $('log-panel');
  panel.style.display = 'block';
  panel.textContent += msg + '\n';
  panel.scrollTop = panel.scrollHeight;
}

const terminal = {
  clean() { $('log-panel').textContent = ''; },
  writeLine(data) { logLine(data); },
  write(data) { logLine(String(data)); },
};

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (LANGS[currentLang][key]) {
      if (key === 'hint') {
        el.innerHTML = currentLang === 'zh'
          ? '烧录地址固定为 <strong>0x0</strong>，波特率 <strong>921600</strong>，Flash 参数保持芯片原样。请使用 Chrome / Edge。'
          : 'Flash address <strong>0x0</strong>, baud <strong>921600</strong>, flash params kept. Use Chrome / Edge.';
      } else {
        el.textContent = LANGS[currentLang][key];
      }
    }
  });
  updateLangSwitcher();
  $('back-link').textContent = t('back-link');
  if (firmwareSource === 'local' && localFileName && firmwareData) {
    $('fw-file-name').textContent =
      t('fw-file-selected') + localFileName + t('fw-file-size') + firmwareData.length + t('fw-file-bytes');
  }
}

async function loadFirmwareList() {
  const sel = $('fw-select');
  sel.innerHTML = '';
  const optLoad = document.createElement('option');
  optLoad.value = '';
  optLoad.textContent = t('fw-loading');
  sel.appendChild(optLoad);

  const base = getBasePath();
  let names = [];
  try {
    const res = await fetch(base + 'bin/files.json');
    if (res.ok) {
      const json = await res.json();
      names = json[FILES_JSON_KEY] || [];
    }
  } catch (e) {
    console.warn('files.json', e);
  }

  sel.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  if (!names.length) {
    placeholder.textContent = t('fw-empty');
    sel.appendChild(placeholder);
    setStatus(t('status-ready'));
    updateFlashButton();
    return;
  }

  placeholder.textContent = '— ' + t('fw-label') + ' —';
  sel.appendChild(placeholder);

  names.forEach((name) => {
    const o = document.createElement('option');
    o.value = name;
    o.textContent = name;
    sel.appendChild(o);
  });

  setStatus(t('status-ready'));
  updateFlashButton();
}

async function fetchFirmware(name) {
  const url = getBasePath() + 'bin/' + BIN_FOLDER + '/' + encodeURIComponent(name);
  const res = await fetch(url);
  if (!res.ok) throw new Error(t('status-fetch-fw-fail') + ' (' + name + ')');
  return new Uint8Array(await res.arrayBuffer());
}

function setProgress(pct) {
  $('progress-wrap').style.display = 'block';
  $('progress-bar').style.width = pct + '%';
  $('progress-text').textContent = Math.round(pct) + '%';
}

async function connectDevice() {
  if (!navigator.serial) throw new Error(t('status-no-serial'));
  device = await navigator.serial.requestPort();
  transport = new Transport(device, true);
  esploader = new ESPLoader({
    transport,
    baudrate: BAUDRATE,
    terminal,
    debugLogging: false,
  });
  const chip = await esploader.main();
  $('chip-info').textContent = t('chip-detected') + chip;
  $('disconnect-btn').style.display = 'block';
  return chip;
}

async function flashFirmware(data) {
  await esploader.writeFlash({
    fileArray: [{ data, address: FLASH_ADDRESS }],
    eraseAll: false,
    compress: true,
    flashMode: 'keep',
    flashFreq: 'keep',
    flashSize: 'keep',
    reportProgress: (_fileIndex, written, total) => {
      setProgress((written / total) * 100);
    },
  });
  await esploader.after('hard_reset');
}

async function disconnect() {
  try {
    if (transport) await transport.disconnect();
  } catch (e) { /* ignore */ }
  device = null;
  transport = null;
  esploader = null;
  $('disconnect-btn').style.display = 'none';
  $('chip-info').textContent = '';
}

$('fw-select').addEventListener('change', () => {
  const name = $('fw-select').value;
  if (name) {
    clearLocalFirmware();
    firmwareSource = 'cloud';
    firmwareData = null;
    setStatus(t('status-ready'));
  } else if (firmwareSource === 'cloud') {
    firmwareSource = null;
    firmwareData = null;
  }
  updateFlashButton();
});

const fwDropArea = $('fw-drop-area');
const fwFileInput = $('fw-file');

fwDropArea.addEventListener('click', () => fwFileInput.click());

fwDropArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  fwDropArea.classList.add('drag-over');
});

fwDropArea.addEventListener('dragleave', (e) => {
  e.preventDefault();
  fwDropArea.classList.remove('drag-over');
});

fwDropArea.addEventListener('drop', async (e) => {
  e.preventDefault();
  fwDropArea.classList.remove('drag-over');
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file) return;
  try {
    setLocalFirmware(file, await readFirmwareFile(file));
  } catch (err) {
    setStatus(t('err-prefix') + (err.message || err), 'error');
    updateFlashButton();
  }
});

fwFileInput.addEventListener('change', async () => {
  const file = fwFileInput.files && fwFileInput.files[0];
  if (!file) return;
  try {
    setLocalFirmware(file, await readFirmwareFile(file));
  } catch (err) {
    setStatus(t('err-prefix') + (err.message || err), 'error');
    updateFlashButton();
  }
});

$('flash-btn').addEventListener('click', async () => {
  if (busy) return;
  const fwName = $('fw-select').value;
  if (!firmwareSource && !fwName) {
    setStatus(t('status-no-fw'), 'error');
    return;
  }

  busy = true;
  $('flash-btn').disabled = true;
  terminal.clean();

  try {
    setStatus(t('status-loading-fw'));
    if (firmwareSource === 'cloud' || (!firmwareSource && fwName)) {
      firmwareSource = 'cloud';
      if (!firmwareData) firmwareData = await fetchFirmware(fwName);
    } else if (!firmwareData) {
      throw new Error(t('status-no-fw'));
    }

    setStatus(t('status-connecting'));
    await connectDevice();

    setStatus(t('status-flashing'));
    setProgress(0);
    await flashFirmware(firmwareData);

    setProgress(100);
    setStatus(t('status-done'), 'ok');
  } catch (e) {
    console.error(e);
    setStatus(t('err-prefix') + (e.message || e), 'error');
    await disconnect();
  } finally {
    busy = false;
    updateFlashButton();
  }
});

$('disconnect-btn').addEventListener('click', async () => {
  await disconnect();
  setStatus(t('status-ready'));
});

$('lang-switcher').addEventListener('click', async () => {
  currentLang = currentLang === 'zh' ? 'en' : 'zh';
  localStorage.setItem('lang', currentLang);
  document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
  const prevSelect = $('fw-select').value;
  applyLang();
  await loadFirmwareList();
  if (prevSelect) $('fw-select').value = prevSelect;
  if (firmwareSource === 'local' && localFileName && firmwareData) {
    $('fw-file-name').textContent =
      t('fw-file-selected') + localFileName + t('fw-file-size') + firmwareData.length + t('fw-file-bytes');
  }
  if (!$('status').classList.contains('ok') && !$('status').classList.contains('error')) {
    setStatus(t('status-ready'));
  }
  const chipText = $('chip-info').textContent;
  if (chipText && (chipText.startsWith('已识别芯片') || chipText.startsWith('Chip'))) {
    const chip = chipText.replace(/^已识别芯片：|^Chip: /, '');
    $('chip-info').textContent = t('chip-detected') + chip;
  }
});

initLang();
applyLang();
loadFirmwareList();
