function scanPage() {
  const elements = document.querySelectorAll('h1, h2, p');
  const texts = Array.from(elements).map(el => el.textContent.trim()).filter(text => text.length > 20);
  
  texts.forEach(text => {
    chrome.runtime.sendMessage({ action: 'analyze', text: text }, response => {
      if (response.isFake) {
        highlightElement(text, 'red');
      }
    });
  });
}

function highlightElement(text, color) {
  const elements = document.querySelectorAll('h1, h2, p');
  elements.forEach(el => {
    if (el.textContent.includes(text)) {
      el.style.backgroundColor = color;
      el.title = 'Potencjalny fake news!';
    }
  });
}

window.addEventListener('load', scanPage);