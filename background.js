chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyze') {
    fetch('https://api.example.com/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_API_KEY'
      },
      body: JSON.stringify({ text: request.text })
    })
      .then(response => response.json())
      .then(data => {
        sendResponse({ isFake: data.isFake || false });
      })
      .catch(error => {
        console.error('Błąd API:', error);
        sendResponse({ isFake: false });
      });
    return true; // Umożliwia asynchroniczne sendResponse
  }
});