// 화면에서 쓸 것들을 찾아 둔다
const todoInput = document.getElementById('todo-input');
const addButton = document.getElementById('add-button');
const todoList = document.getElementById('todo-list');
const remainingCount = document.getElementById('remaining-count');
const doneCount = document.getElementById('done-count');

// 브라우저에 저장할 때 쓰는 이름
const STORAGE_KEY = 'todos';

// 처음 열었을 때 보여 줄 목록
const START_TODOS = [
  { text: '영어', done: false },
  { text: '코딩', done: false },
  { text: '블렌더', done: false }
];

// 저장된 목록을 꺼낸다. 없으면 처음 목록을 쓴다.
function loadTodos() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    // 저장소를 못 쓰는 브라우저면 처음 목록으로 시작한다
  }
  return START_TODOS.map(function (todo) {
    return { text: todo.text, done: todo.done };
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

  const text = document.createElement('span');
  text.className = 'todo-text';
  text.textContent = todo.text;

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'delete-button';
  deleteButton.setAttribute('aria-label', '삭제');
  deleteButton.textContent = '×';
  deleteButton.dataset.index = index;

  label.append(check, text);
  li.append(label, deleteButton);
  return li;
}

// 목록과 개수를 다시 그린다
function render() {
  todoList.replaceChildren();
  todos.forEach(function (todo, index) {
    todoList.append(makeItem(todo, index));
  });

  const done = todos.filter(function (todo) {
    return todo.done;
  }).length;
  remainingCount.textContent = todos.length - done;
  doneCount.textContent = done;
}

// 추가 버튼: 빈 칸이면 아무것도 하지 않는다
addButton.addEventListener('click', function () {
  const text = todoInput.value.trim();
  if (text === '') {
    todoInput.focus();
    return;
  }
  todos.push({ text: text, done: false });
  saveTodos();
  render();
  todoInput.value = '';
  todoInput.focus();
});

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

render();
