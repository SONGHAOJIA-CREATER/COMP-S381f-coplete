(() => {
  const form = document.getElementById('filterForm');
  if (form) {
    const debounce = (fn, delay = 400) => {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
      };
    };

    const searchInput = form.querySelector('input[name="search"]');
    if (searchInput) {
      searchInput.addEventListener(
        'input',
        debounce(() => form.submit())
      );
    }

    const selects = form.querySelectorAll('select');
    selects.forEach((select) => {
      select.addEventListener('change', () => form.submit());
    });
  }
})();

function confirmDelete() {
  const body = document.body;
  const message = body?.dataset?.confirmMessage || '确定要删除该物品吗？删除后无法恢复。';
  return window.confirm(message);
}

