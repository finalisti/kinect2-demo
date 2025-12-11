let depthWidth = 1920;
let depthHeight = 1080;

let ws = null;
let streaming = false;

function sendInputBridge(cmd, data = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({cmd, ...data}));
}

const canvas = document.getElementById('outputCanvas');
const ctx = canvas.getContext('2d');
canvas.width = depthWidth;
canvas.height = depthHeight;

const handRaisedStates = {};

const indicator = document.createElement('div');
indicator.id = 'kinect-indicator';
document.body.appendChild(indicator);

function showIndicator(t) {
  indicator.textContent = t;
  indicator.classList.add('kinect-indicator-visible');
}
function hideIndicator() {
  indicator.classList.remove('kinect-indicator-visible');
}

function startStreaming() {
  if (ws) return;

  ws = new WebSocket('ws://localhost:8081');
  ws.onopen = () => (streaming = true);

  ws.onmessage = (evt) => {
    if (typeof evt.data !== 'string') return;
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch {
      return;
    }

    if (msg.type === 'constants') {
      depthWidth = msg.depthWidth;
      depthHeight = msg.depthHeight;
      canvas.width = depthWidth;
      canvas.height = depthHeight;
      window.__KINECT_CONSTS = msg;
    } else if (msg.type === 'bodyFrame') {
      drawBodyFrame(msg.bodyFrame);
    }
  };

  ws.onclose = () => {
    ws = null;
    streaming = false;
  };
}
startStreaming();

const HANDSIZE = 20;

function drawBodyFrame(bodyFrame) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!bodyFrame || !Array.isArray(bodyFrame.bodies)) return;

  const K = window.__KINECT_CONSTS;
  const JointType = K.JointType;
  const TrackingState = K.TrackingState;

  const lookup = (n) =>
    JointType[n] ??
    JointType[n[0].toUpperCase() + n.slice(1)] ??
    JointType[n.toUpperCase()];

  let i = 0;
  for (const body of bodyFrame.bodies) {
    if (!body || !body.tracked) continue;

    for (const jt in body.joints) {
      const j = body.joints[jt];
      if (!j) continue;
      if (j.trackingState <= TrackingState.notTracked) continue;

      const x = j.colorX;
      const y = j.colorY;

      ctx.fillStyle = '#00ff00';
      ctx.fillRect(x - 6, y - 6, 12, 12);
    }

    const head = body.joints[lookup('head')];
    const torso = body.joints[lookup('spineMid')];

    const lh = body.joints[lookup('handLeft')];
    const le = body.joints[lookup('elbowLeft')];

    const rh = body.joints[lookup('handRight')];
    const re = body.joints[lookup('elbowRight')];

    const getX = (j) => (j ? j.colorX : null);
    const getY = (j) => (j ? j.colorY : null);

    const lhX = getX(lh),
      lhY = getY(lh);
    const leX = getX(le);

    const rhX = getX(rh),
      rhY = getY(rh);
    const reX = getX(re);

    const torsoY = getY(torso);
    const headY = getY(head);

    const leftExt = lhX != null && leX != null && lhX < leX && lhY < torsoY;
    const rightExt = rhX != null && reX != null && rhX > reX && rhY < torsoY;

    // LEFT/RIGHT mouse turn
    if (leftExt && !rightExt) {
      sendInputBridge('MOUSE_MOVE', {dir: -1});
      showIndicator('LEFT');
    } else if (rightExt && !leftExt) {
      sendInputBridge('MOUSE_MOVE', {dir: 1});
      showIndicator('RIGHT');
    } else {
      hideIndicator();
    }

    // W logic
    const leftRaised = lhY != null && lhY < headY;
    const rightRaised = rhY != null && rhY < headY;

    const any = leftRaised || rightRaised;
    const prev = handRaisedStates[i] || {raised: false};

    if (any) {
      if (!prev.raised) sendInputBridge('W_DOWN');
      prev.raised = true;
      showIndicator('W');
    } else {
      if (prev.raised) sendInputBridge('W_UP');
      prev.raised = false;
    }

    handRaisedStates[i] = prev;
    i++;
  }
}
