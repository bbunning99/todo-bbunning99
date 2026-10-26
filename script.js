// 화면에서 쓸 것들을 찾아 둔다
const todoInput = document.getElementById('todo-input');
const timeSelect = document.getElementById('time-select');
const addButton = document.getElementById('add-button');
const todoList = document.getElementById('todo-list');
const remainingCount = document.getElementById('remaining-count');
const remainingTime = document.getElementById('remaining-time');
const doneCount = document.getElementById('done-count');
const clockFace = document.querySelector('.clock-face');
const arcLayer = document.getElementById('clock-arcs');

// 브라우저에 저장할 때 쓰는 이름
const STORAGE_KEY = 'todos';

// 처음 열었을 때 보여 줄 목록
const START_TODOS = [
  { text: '영어', minutes: 10, start: null, done: false },
  { text: '코딩', minutes: 10, start: null, done: false },
  { text: '블렌더', minutes: 10, start: null, done: false }
];

// 저장된 목록을 꺼낸다. 없으면 처음 목록을 쓴다.
function loadTodos() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      // 시간 기능 전에 저장한 할 일은 10분으로 본다. 시계에 안 올린 것은 start가 null.
      return JSON.parse(saved).map(function (todo) {
        return {
          text: todo.text,
          minutes: todo.minutes || 10,
          start: typeof todo.start === 'number' ? todo.start : null,
          done: todo.done
        };
      });
    }
  } catch (error) {
    // 저장소를 못 쓰는 브라우저면 처음 목록으로 시작한다
  }
  return START_TODOS.map(function (todo) {
    return { text: todo.text, minutes: todo.minutes, start: todo.start, done: todo.done };
  });
}

// 지금 목록을 브라우저에 저장한다
function saveTodos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch (error) {
    // 저장이 안 돼도 화면은 그대로 쓸 수 있다
  }
}

let todos = loadTodos();

// 할 일 한 줄을 만든다 (index.html의 줄과 같은 모양)
function makeItem(todo, index) {
  const li = document.createElement('li');

  const label = document.createElement('label');
  label.className = 'todo-item';

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'done-check';
  check.checked = todo.done;
  check.dataset.index = index;

  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.setAttribute('aria-label', '끌어서 시계에 놓기');
  handle.textContent = '⋮⋮';
  handle.dataset.index = index;

  const text = document.createElement('span');
  text.className = 'todo-text';
  text.textContent = todo.text;

  const time = document.createElement('span');
  time.className = 'todo-time';
  time.textContent = todo.minutes + '분';

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'delete-button';
  deleteButton.setAttribute('aria-label', '삭제');
  deleteButton.textContent = '×';
  deleteButton.dataset.index = index;

  label.append(check, text);
  li.append(handle, label);
  if (todo.start !== null) {
    const start = document.createElement('span');
    start.className = 'todo-start';
    start.textContent = formatStart(todo.start);
    li.append(start);
  }
  li.append(time, deleteButton);
  return li;
}

// 시작 시각(0시부터 흐른 분)을 '14:30'처럼 숫자만 적는다
function formatStart(start) {
  const minutes = start % 60;
  return Math.floor(start / 60) + ':' + (minutes < 10 ? '0' : '') + minutes;
}

// ---- 시계판 ----
// 시계판은 24시간(1440분)이 한 바퀴(360도). 0이 맨 위, 시계 방향.
const SVG_NS = 'http://www.w3.org/2000/svg';
const LANE_RADII = [36, 31, 26, 21, 16]; // 할 일마다 다른 반지름의 줄 (숫자보다 안쪽)
const arcNodes = new Map(); // 할 일 번호 → 그려 둔 띠
let preview = null; // 끄는 동안 잠깐 보여 줄 위치 { index, start }

// 시계 가운데에서 각도(분 환산)에 해당하는 원 위의 점
function arcPoint(minutes, radius) {
  const angle = (minutes * 0.25 * Math.PI) / 180;
  return [50 + radius * Math.sin(angle), 50 - radius * Math.cos(angle)];
}

function makeArc() {
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('class', 'arc');
  const line = document.createElementNS(SVG_NS, 'path');
  line.setAttribute('class', 'arc-line');
  const label = document.createElementNS(SVG_NS, 'text');
  label.setAttribute('class', 'arc-label');
  group.append(line, label);
  return { group: group, line: line, label: label };
}

// 시계에 올린 할 일의 띠를 모두 그린다 (이미 있는 띠는 모양만 고친다)
function drawArcs() {
  const used = new Set();
  todos.forEach(function (todo, index) {
    const start = preview && preview.index === index ? preview.start : todo.start;
    if (start === null) {
      return;
    }
    used.add(index);
    let node = arcNodes.get(index);
    if (!node) {
      node = makeArc();
      arcNodes.set(index, node);
      arcLayer.append(node.group);
    }
    const radius = LANE_RADII[index % LANE_RADII.length];
    const from = arcPoint(start, radius);
    const to = arcPoint(start + todo.minutes, radius);
    node.line.setAttribute('d', 'M ' + from[0] + ' ' + from[1] + ' A ' + radius + ' ' + radius + ' 0 0 1 ' + to[0] + ' ' + to[1]);
    const middle = arcPoint(start + todo.minutes / 2, radius);
    node.label.setAttribute('x', middle[0]);
    node.label.setAttribute('y', middle[1]);
    node.label.textContent = todo.text.length > 3 ? todo.text.slice(0, 3) + '…' : todo.text;
  });
  arcNodes.forEach(function (node, index) {
    if (!used.has(index)) {
      node.group.remove();
      arcNodes.delete(index);
    }
  });
}

// 목록과 개수를 다시 그린다
function render() {
  todoList.replaceChildren();
  todos.forEach(function (todo, index) {
    todoList.append(makeItem(todo, index));
  });

  let done = 0;
  let minutesLeft = 0;
  todos.forEach(function (todo) {
    if (todo.done) {
      done = done + 1;
    } else {
      minutesLeft = minutesLeft + todo.minutes;
    }
  });
  remainingCount.textContent = todos.length - done;
  remainingTime.textContent = minutesLeft;
  doneCount.textContent = done;
  drawArcs();
}

// 추가 버튼: 빈 칸이면 아무것도 하지 않는다
addButton.addEventListener('click', function () {
  const text = todoInput.value.trim();
  if (text === '') {
    todoInput.focus();
    return;
  }
  todos.push({ text: text, minutes: Number(timeSelect.value), start: null, done: false });
  saveTodos();
  render();
  todoInput.value = '';
  todoInput.focus();
});

// 시간 드롭다운 위에서 휠을 굴리면 10분씩 바꾼다 (아래로 굴리면 늘고, 위로 굴리면 준다)
timeSelect.addEventListener('wheel', function (event) {
  event.preventDefault(); // 페이지가 같이 스크롤되지 않게 막는다
  const step = event.deltaY > 0 ? 1 : -1;
  const next = timeSelect.selectedIndex + step;
  if (next >= 0 && next < timeSelect.options.length) {
    timeSelect.selectedIndex = next;
  }
}, { passive: false });

// 체크 상자: 완료 ↔ 안 함을 바꾼다
todoList.addEventListener('change', function (event) {
  if (event.target.classList.contains('done-check')) {
    const index = Number(event.target.dataset.index);
    todos[index].done = event.target.checked;
    saveTodos();
    render();
  }
});

// 삭제 버튼: 그 줄을 지운다
todoList.addEventListener('click', function (event) {
  if (event.target.classList.contains('delete-button')) {
    const index = Number(event.target.dataset.index);
    todos.splice(index, 1);
    saveTodos();
    render();
  }
});

// ---- 상자를 끌어서 시계판에 놓기 ----
let drag = null; // 끄는 중일 때만 { index, ghost, offsetX, offsetY, x, y, frame }

function clockInfo() {
  const rect = clockFace.getBoundingClientRect();
  return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, radius: rect.width / 2 };
}

// 가운데 점 기준으로 마우스·손가락이 가리키는 각도를 분으로 바꾼다 (0이 맨 위, 시계 방향)
function pointerMinutes(x, y, info) {
  const degrees = (Math.atan2(x - info.cx, -(y - info.cy)) * 180) / Math.PI;
  return ((degrees + 360) % 360) * 4;
}

// 10분 단위로 맞춘다
function snapMinutes(minutes) {
  return (Math.round(minutes / 10) * 10) % 1440;
}

// 끄는 동안 매번: 상자 따라다니기, 시계 위면 띠 미리 보여 주기
function updateDrag() {
  const info = clockInfo();
  const inside = Math.hypot(drag.x - info.cx, drag.y - info.cy) <= info.radius;
  drag.ghost.style.left = drag.x - drag.offsetX + 'px';
  drag.ghost.style.top = drag.y - drag.offsetY + 'px';
  drag.ghost.classList.toggle('over-clock', inside);
  clockFace.classList.toggle('clock-active', inside);
  preview = inside ? { index: drag.index, start: snapMinutes(pointerMinutes(drag.x, drag.y, info)) } : null;
  drawArcs();
  return inside;
}

// 화면 위·아래 끝으로 가져가면 페이지가 따라 움직이게 한다
function dragFrame() {
  if (!drag) {
    return;
  }
  if (drag.y < 70) {
    window.scrollBy(0, -12);
  } else if (drag.y > window.innerHeight - 70) {
    window.scrollBy(0, 12);
  }
  updateDrag();
  drag.frame = requestAnimationFrame(dragFrame);
}

function onDragMove(event) {
  drag.x = event.clientX;
  drag.y = event.clientY;
  updateDrag();
}

// 끝내기: 시계 안에서 놓았으면 그 시각을 저장하고, 아니면 그대로 둔다
function endDrag(event, save) {
  cancelAnimationFrame(drag.frame);
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragUp);
  window.removeEventListener('pointercancel', onDragCancel);
  if (save) {
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (updateDrag() && preview) {
      todos[drag.index].start = preview.start;
      saveTodos();
    }
  }
  drag.ghost.remove();
  clockFace.classList.remove('clock-active');
  preview = null;
  drag = null;
  render();
}

function onDragUp(event) {
  endDrag(event, true);
}

function onDragCancel(event) {
  endDrag(event, false);
}

// 손잡이를 잡으면 끌기 시작
todoList.addEventListener('pointerdown', function (event) {
  const handle = event.target.closest('.drag-handle');
  if (!handle || drag || event.button > 0) {
    return;
  }
  event.preventDefault();
  const box = handle.closest('li');
  const rect = box.getBoundingClientRect();
  const ghost = box.cloneNode(true);
  ghost.classList.add('drag-ghost');
  ghost.style.width = rect.width + 'px';
  todoList.append(ghost);
  box.classList.add('dragging');
  drag = {
    index: Number(handle.dataset.index),
    ghost: ghost,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    x: event.clientX,
    y: event.clientY,
    frame: 0
  };
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragUp);
  window.addEventListener('pointercancel', onDragCancel);
  updateDrag();
  drag.frame = requestAnimationFrame(dragFrame);
});

render();
