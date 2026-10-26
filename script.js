// 화면에서 쓸 것들을 찾아 둔다
const todoList = document.getElementById('todo-list');
const remainingCount = document.getElementById('remaining-count');

// 목록에 있는 줄 수를 세어 남은 개수에 적는다
function updateCount() {
  remainingCount.textContent = todoList.querySelectorAll('li').length;
}

// 삭제 버튼을 누르면 그 줄을 지운다
todoList.addEventListener('click', function (event) {
  if (event.target.classList.contains('delete-button')) {
    event.target.closest('li').remove();
    updateCount();
  }
});

updateCount();
