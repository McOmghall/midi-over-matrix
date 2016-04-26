chrome.app.runtime.onLaunched.addListener(function () {
  chrome.app.window.create('index.html', {
    id: 'framelessWinID',
    innerBounds: {
      width: 600,
      height: 700,
      minWidth: 600,
      minHeight: 700
    },
    outerBounds: {
      left: 10,
      top: 10
    }
  })
})
