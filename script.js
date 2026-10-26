// 화면에서 쓸 것들을 찾아 둔다
const todoInput = document.getElementById('todo-input');
const timeSelect = document.getElementById('time-select'); // 걸리는 시간 콤보 박스의 버튼
const timeCombo = document.getElementById('time-combo');
const timeList = document.getElementById('time-list');
const addButton = document.getElementById('add-button');
const todoList = document.getElementById('todo-list');
const remainingCount = document.getElementById('remaining-count');
const remainingTime = document.getElementById('remaining-time');
const doneCount = document.getElementById('done-count');
const clockFace = document.querySelector('.clock-face');
const arcLayer = document.getElementById('clock-arcs');
const sliceLayer = document.getElementById('clock-slices');

// ---- Supabase (todos 표) ----
// 공개 키만 쓴다. 비밀 키는 이 파일에 절대 넣지 않는다.
const SUPABASE_URL = 'https://ymbassdoclbsfdqwchit.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4hGcBefkDkHrlojwY7py0Q_uDAVrj66';

// todos 표에 요청을 보낸다 (다른 사이트의 라이브러리 없이 fetch만 쓴다)
async function callSupabase(query, method, body) {
  const headers = { apikey: SUPABASE_KEY, Prefer: 'return=representation' };
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(SUPABASE_URL + '/rest/v1/todos' + query, {
    method: method,
    headers: headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    throw new Error('Supabase ' + response.status + ': ' + (await response.text()));
  }
  return response.json();
}

// 표의 한 줄을 고치거나 지운다. 바뀐 줄이 하나도 없으면(권한이 없을 때 등) 실패로 본다.
async function changeRow(method, id, body) {
  const rows = await callSupabase('?select=id&id=eq.' + encodeURIComponent(id), method, body);
  if (rows.length === 0) {
    throw new Error('표에서 바뀐 줄이 없어요. Supabase의 todos 표 권한(RLS 정책)을 확인해 주세요.');
  }
}

// 저장하지 못했을 때 알려 준다
function showError(what, error) {
  console.error(error);
  alert(what + ' 내용을 Supabase에 저장하지 못했어요. 인터넷 연결과 Supabase 설정을 확인해 주세요.');
}

// 표에서 가져올 칸 (minutes: 걸리는 시간, start_minute: 시계 시작 시각, star: 즐겨찾기)
const COLUMNS = 'id,text,done,created_at,minutes,start_minute,star';

// 표의 한 줄을 화면에서 쓰는 할 일로 바꾼다
function toTodo(row) {
  return {
    id: row.id,
    text: row.text,
    done: row.done === true,
    created: Date.parse(row.created_at) || 0,
    minutes: row.minutes || 10,
    start: typeof row.start_minute === 'number' ? row.start_minute : null,
    star: typeof row.star === 'number' ? row.star : 0
  };
}

let todos = [];

// 추가한 순서: 만든 시각이 빠른 것이 먼저
function byCreation(a, b) {
  return a.created - b.created || (String(a.id) < String(b.id) ? -1 : 1);
}

// 줄 세우기: 중요한 일이 맨 위 (나중에 별을 누른 것이 더 위), 나머지는 추가한 순서대로
function sortTodos() {
  todos.sort(function (a, b) {
    return b.star - a.star || byCreation(a, b);
  });
}

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
  time.textContent = formatMinutes(todo.minutes);

  const starButton = document.createElement('button');
  starButton.type = 'button';
  starButton.className = 'star-button' + (todo.star > 0 ? ' on' : '');
  starButton.setAttribute('aria-label', '중요 표시');
  starButton.setAttribute('aria-pressed', todo.star > 0 ? 'true' : 'false');
  starButton.textContent = todo.star > 0 ? '★' : '☆';
  starButton.dataset.index = index;

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'delete-button';
  deleteButton.setAttribute('aria-label', '삭제');
  deleteButton.textContent = '×';
  deleteButton.dataset.index = index;

  label.append(check, text);
  // 오른쪽 묶음: 걸리는 시간, 별표, 삭제
  const meta = document.createElement('span');
  meta.className = 'todo-meta';
  meta.append(time, starButton, deleteButton);

  li.append(handle, label, meta);
  // 시작 시각(시계에 올린 것만)은 상자 바깥 왼쪽 공백에 보인다. 안 올렸으면 공백으로 둔다.
  if (todo.start !== null) {
    const start = document.createElement('span');
    start.className = 'todo-start';
    start.textContent = formatStart(todo.start);
    li.prepend(start);
  }
  return li;
}

// 걸리는 시간(분)을 '10분', '1시간', '1시간 30분'처럼 적는다
function formatMinutes(minutes) {
  if (minutes < 60) {
    return minutes + '분';
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? hours + '시간' : hours + '시간 ' + rest + '분';
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
const SLICE_RADIUS = 49.5; // 피자 조각은 가운데 점부터 시계 테두리 바로 안쪽까지
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
  const hit = document.createElementNS(SVG_NS, 'path'); // 잡기 쉽게 투명하고 넓은 띠
  hit.setAttribute('class', 'arc-hit');
  const line = document.createElementNS(SVG_NS, 'path');
  line.setAttribute('class', 'arc-line');
  const label = document.createElementNS(SVG_NS, 'text');
  label.setAttribute('class', 'arc-label');
  group.append(hit, line, label);
  const slice = document.createElementNS(SVG_NS, 'path'); // 띠 아래에 깔리는 피자 조각
  slice.setAttribute('class', 'arc-slice');
  return { group: group, hit: hit, line: line, label: label, slice: slice };
}

// 시계에 올린 할 일의 띠를 모두 그린다 (이미 있는 띠는 모양만 고친다)
function drawArcs() {
  const used = new Set();
  const creationOrder = todos.slice().sort(byCreation);
  todos.forEach(function (todo, index) {
    const previewing = preview && preview.index === index;
    const start = previewing ? preview.start : todo.start;
    if (start === null) {
      return;
    }
    used.add(index);
    let node = arcNodes.get(index);
    if (!node) {
      node = makeArc();
      arcNodes.set(index, node);
      arcLayer.append(node.group);
      sliceLayer.append(node.slice);
    }
    const radius = LANE_RADII[creationOrder.indexOf(todo) % LANE_RADII.length]; // 추가한 순서로 줄을 정해서 별을 눌러도 같은 줄에 머문다
    const from = arcPoint(start, radius);
    const to = arcPoint(start + todo.minutes, radius);
    const path = 'M ' + from[0] + ' ' + from[1] + ' A ' + radius + ' ' + radius + ' 0 0 1 ' + to[0] + ' ' + to[1];
    node.hit.setAttribute('d', path);
    node.line.setAttribute('d', path);
    node.group.dataset.index = index;
    const rimFrom = arcPoint(start, SLICE_RADIUS);
    const rimTo = arcPoint(start + todo.minutes, SLICE_RADIUS);
    node.slice.setAttribute('d', 'M 50 50 L ' + rimFrom[0] + ' ' + rimFrom[1] + ' A ' + SLICE_RADIUS + ' ' + SLICE_RADIUS + ' 0 0 1 ' + rimTo[0] + ' ' + rimTo[1] + ' Z');
    const removing = previewing && preview.removing === true;
    node.group.classList.toggle('removing', removing);
    node.slice.classList.toggle('removing', removing);
    const middle = arcPoint(start + todo.minutes / 2, radius);
    node.label.setAttribute('x', middle[0]);
    node.label.setAttribute('y', middle[1]);
    node.label.textContent = todo.text.length > 3 ? todo.text.slice(0, 3) + '…' : todo.text;
  });
  arcNodes.forEach(function (node, index) {
    if (!used.has(index)) {
      node.group.remove();
      node.slice.remove();
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

// 추가 버튼: 빈 칸이면 아무것도 하지 않는다. 표에 먼저 넣고, 들어갔으면 목록에 보인다.
addButton.addEventListener('click', async function () {
  const text = todoInput.value.trim();
  if (text === '') {
    todoInput.focus();
    return;
  }
  const minutes = selectedMinutes();
  todoInput.value = '';
  todoInput.focus();
  try {
    const rows = await callSupabase('?select=' + COLUMNS, 'POST', {
      text: text,
      done: false,
      minutes: minutes,
      start_minute: null,
      star: 0
    });
    todos.push(toTodo(rows[0]));
    sortTodos();
    render();
  } catch (error) {
    todoInput.value = text;
    showError('추가한', error);
  }
});

// ---- 걸리는 시간 콤보 박스 ----
const timeOptions = Array.from(timeList.querySelectorAll('[role="option"]'));
let timeIndex = 0; // 고른 칸 (처음 값은 10분)
let activeIndex = 0; // 열린 목록에서 짚고 있는 칸

// 고른 시간(분)
function selectedMinutes() {
  return Number(timeOptions[timeIndex].dataset.value);
}

// 한 칸을 고른다
function chooseTime(index) {
  timeIndex = index;
  timeOptions.forEach(function (option, i) {
    option.setAttribute('aria-selected', i === index ? 'true' : 'false');
  });
  timeSelect.textContent = timeOptions[index].textContent;
}

// 열린 목록에서 짚고 있는 칸을 표시하고, 안 보이면 스크롤해서 보이게 한다
function markActive(index) {
  activeIndex = index;
  timeOptions.forEach(function (option, i) {
    option.classList.toggle('active', i === index);
  });
  const option = timeOptions[index];
  const top = option.offsetTop;
  const bottom = top + option.offsetHeight;
  if (top < timeList.scrollTop) {
    timeList.scrollTop = top;
  } else if (bottom > timeList.scrollTop + timeList.clientHeight) {
    timeList.scrollTop = bottom - timeList.clientHeight;
  }
}

function openTimeList() {
  timeList.hidden = false;
  timeSelect.setAttribute('aria-expanded', 'true');
  // 아래로 펼치면 화면 밖으로 나가는데 위에 자리가 더 있으면 위로 펼친다
  timeList.classList.remove('up');
  const button = timeSelect.getBoundingClientRect();
  const below = window.innerHeight - button.bottom;
  if (below < timeList.offsetHeight + 4 && button.top > below) {
    timeList.classList.add('up');
  }
  // 고른 칸이 목록 가운데쯤 보이게 한다
  const option = timeOptions[timeIndex];
  timeList.scrollTop = Math.max(0, option.offsetTop - (timeList.clientHeight - option.offsetHeight) / 2);
  markActive(timeIndex);
}

function closeTimeList() {
  timeList.hidden = true;
  timeSelect.setAttribute('aria-expanded', 'false');
}

// 콤보 박스를 누르면 목록이 열리고, 다시 누르면 닫힌다
timeSelect.addEventListener('click', function () {
  if (timeList.hidden) {
    openTimeList();
  } else {
    closeTimeList();
  }
});

// 목록에서 하나를 고르면 닫힌다
timeList.addEventListener('click', function (event) {
  const option = event.target.closest('[role="option"]');
  if (option) {
    chooseTime(timeOptions.indexOf(option));
    closeTimeList();
    timeSelect.focus();
  }
});

timeList.addEventListener('mouseover', function (event) {
  const option = event.target.closest('[role="option"]');
  if (option) {
    timeOptions.forEach(function (item) {
      item.classList.toggle('active', item === option);
    });
    activeIndex = timeOptions.indexOf(option);
  }
});

// 바깥을 누르면 닫힌다
document.addEventListener('click', function (event) {
  if (!timeList.hidden && !timeCombo.contains(event.target)) {
    closeTimeList();
  }
});

// 키보드: 위·아래 화살표로 고르고, Enter로 정하고, Esc로 닫는다
timeCombo.addEventListener('keydown', function (event) {
  const open = !timeList.hidden;
  if (event.key === 'Escape' && open) {
    event.preventDefault();
    closeTimeList();
    timeSelect.focus();
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    if (open) {
      markActive(Math.min(timeOptions.length - 1, Math.max(0, activeIndex + step)));
    } else {
      chooseTime(Math.min(timeOptions.length - 1, Math.max(0, timeIndex + step)));
    }
  } else if (event.key === 'Enter' && open) {
    event.preventDefault();
    chooseTime(activeIndex);
    closeTimeList();
  } else if (event.key === 'Tab' && open) {
    closeTimeList();
  }
});

// 콤보 박스 위에서 휠을 굴리면 한 칸씩 바꾼다 (아래로 굴리면 다음 칸, 위로 굴리면 이전 칸)
timeSelect.addEventListener('wheel', function (event) {
  event.preventDefault(); // 페이지가 같이 스크롤되지 않게 막는다
  const next = timeIndex + (event.deltaY > 0 ? 1 : -1);
  if (next >= 0 && next < timeOptions.length) {
    chooseTime(next);
    if (!timeList.hidden) {
      markActive(next);
    }
  }
}, { passive: false });

// 체크 상자: 완료 ↔ 안 함을 바꾼다. 표에 반영된 뒤에 화면을 다시 그린다.
todoList.addEventListener('change', async function (event) {
  if (event.target.classList.contains('done-check')) {
    const todo = todos[Number(event.target.dataset.index)];
    const done = event.target.checked;
    try {
      await changeRow('PATCH', todo.id, { done: done });
      todo.done = done;
    } catch (error) {
      showError('체크한', error);
    }
    render();
  }
});

// 즐겨찾기를 바꾸고 표에 저장한다. 화면을 먼저 바꾸고, 저장하지 못하면 되돌린다.
async function saveStar(todo, star) {
  const before = todo.star;
  todo.star = star;
  sortTodos();
  render();
  try {
    await changeRow('PATCH', todo.id, { star: star });
  } catch (error) {
    todo.star = before;
    sortTodos();
    render();
    showError('즐겨찾기', error);
  }
}

// 별표 버튼: 중요 표시를 켜고 끈다 (켤 때는 지금까지 누른 번호보다 큰 번호를 붙인다)
todoList.addEventListener('click', function (event) {
  const button = event.target.closest('.star-button');
  if (button) {
    const todo = todos[Number(button.dataset.index)];
    const biggest = Math.max(0, ...todos.map(function (item) {
      return item.star;
    }));
    saveStar(todo, todo.star > 0 ? 0 : biggest + 1);
  }
});

// 삭제 버튼: 표에서 지운 뒤에 목록에서도 지운다
todoList.addEventListener('click', async function (event) {
  if (event.target.classList.contains('delete-button')) {
    const todo = todos[Number(event.target.dataset.index)];
    try {
      await changeRow('DELETE', todo.id);
      todos.splice(todos.indexOf(todo), 1);
    } catch (error) {
      showError('삭제한', error);
    }
    render();
  }
});

// ---- 상자를 끌어서 시계판에 놓기 ----
let drag = null; // 끄는 중일 때만 { kind, index, grab, ghost, offsetX, offsetY, x, y, frame } (kind: 'box' 상자, 'arc' 띠)

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
  if (inside) {
    // 띠는 잡은 자리를 기준으로, 가운데 점을 중심으로 한 원 위에서 각도만 바뀐다
    const minutes = pointerMinutes(drag.x, drag.y, info) - drag.grab;
    preview = { index: drag.index, start: snapMinutes(((minutes % 1440) + 1440) % 1440) };
  } else if (drag.kind === 'arc') {
    // 시계 밖으로 끌어내는 중: 띠를 흐리게 해서 곧 빠진다는 걸 보여 준다
    preview = { index: drag.index, start: todos[drag.index].start, removing: true };
  } else {
    preview = null;
  }
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

// 시계 시작 시각을 바꾸고 표에 저장한다. 화면을 먼저 바꾸고, 저장하지 못하면 되돌린다.
async function saveStart(todo, start) {
  const before = todo.start;
  todo.start = start;
  render();
  try {
    await changeRow('PATCH', todo.id, { start_minute: start });
  } catch (error) {
    todo.start = before;
    render();
    showError('시계에 올린', error);
  }
}

// 끝내기: 시계 안에서 놓았으면 그 시각을 저장한다. 띠를 시계 밖에서 놓으면 시계에서 뺀다.
function endDrag(event, save) {
  cancelAnimationFrame(drag.frame);
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragUp);
  window.removeEventListener('pointercancel', onDragCancel);
  let change = null; // 바뀐 게 있으면 { todo, start }
  if (save) {
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (updateDrag()) {
      change = { todo: todos[drag.index], start: preview.start };
    } else if (drag.kind === 'arc') {
      change = { todo: todos[drag.index], start: null };
    }
  }
  drag.ghost.remove();
  clockFace.classList.remove('clock-active');
  preview = null;
  drag = null;
  if (change && change.start !== change.todo.start) {
    saveStart(change.todo, change.start);
  } else {
    render();
  }
}

function onDragUp(event) {
  endDrag(event, true);
}

function onDragCancel(event) {
  endDrag(event, false);
}

// 끌기 시작: 목록 상자 모양의 따라다니는 상자를 만든다
function startDrag(kind, index, event, grab) {
  const box = todoList.children[index];
  const rect = box.getBoundingClientRect();
  const ghost = box.cloneNode(true);
  ghost.classList.add('drag-ghost');
  ghost.style.width = rect.width + 'px';
  todoList.append(ghost);
  box.classList.add('dragging');
  drag = {
    kind: kind,
    index: index,
    grab: grab,
    ghost: ghost,
    offsetX: kind === 'box' ? event.clientX - rect.left : 24,
    offsetY: kind === 'box' ? event.clientY - rect.top : rect.height / 2,
    x: event.clientX,
    y: event.clientY,
    frame: 0
  };
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragUp);
  window.addEventListener('pointercancel', onDragCancel);
  updateDrag();
  drag.frame = requestAnimationFrame(dragFrame);
}

// 상자의 손잡이를 잡으면 끌기 시작
todoList.addEventListener('pointerdown', function (event) {
  const handle = event.target.closest('.drag-handle');
  if (!handle || drag || event.button > 0) {
    return;
  }
  event.preventDefault();
  startDrag('box', Number(handle.dataset.index), event, 0);
});

// 시계판의 띠를 잡으면 끌기 시작 (잡은 자리와 띠 시작 시각의 차이를 기억해서 띠가 튀지 않게 한다)
arcLayer.addEventListener('pointerdown', function (event) {
  const group = event.target.closest('.arc');
  if (!group || drag || event.button > 0) {
    return;
  }
  event.preventDefault();
  const index = Number(group.dataset.index);
  const minutes = pointerMinutes(event.clientX, event.clientY, clockInfo());
  const grab = ((minutes - todos[index].start + 2160) % 1440) - 720;
  startDrag('arc', index, event, grab);
});

// 처음 열면 빈 목록을 그려 두고, 표에서 목록을 불러온다
render();

async function loadFromSupabase() {
  try {
    const rows = await callSupabase('?select=' + COLUMNS + '&order=created_at.asc', 'GET');
    todos = rows.map(toTodo);
    sortTodos();
    render();
  } catch (error) {
    console.error(error);
    alert('할 일 목록을 Supabase에서 불러오지 못했어요. 인터넷 연결과 Supabase 설정을 확인해 주세요.');
  }
}

loadFromSupabase();
