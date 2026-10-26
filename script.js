// 화면에서 쓸 것들을 찾아 둔다
const todoList = document.getElementById('todo-list');
const remainingCount = document.getElementById('remaining-count');
const doneCount = document.getElementById('done-count');

// 체크된 줄과 안 된 줄을 세어 개수에 적는다
function updateCount() {
  const total = todoList.querySelectorAll('li').length;
  const done = todoList.querySelectorAll('.done-check:checked').length;
  remainingCount.textContent = total - done;
  doneCount.textContent = done;
}

// 삭제 버튼을 누르면 그 줄을 지운다
todoList.addEventListener('click', function (event) {
  if (event.target.classList.contains('delete-button')) {
    event.target.closest('li').remove();
    updateCount();
  }
});

// 체크 상자를 누르면 개수를 다시 센다
todoList.addEventListener('change', function (event) {
  if (event.target.classList.contains('done-check')) {
    updateCount();
  }
});

updateCount();
