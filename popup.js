document.getElementById('scan').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'scan' }, response => {
      document.getElementById('result').textContent = response ? 'Znaleziono potencjalne fake newsy!' : 'Strona wydaje się OK';
    });
  });
});